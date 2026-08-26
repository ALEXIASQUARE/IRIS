import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogService } from '../services-catalog/catalog.service';
import { GenericQuoteDto, LaundryQuoteDto } from './dto/quote.dto';

// ─────────────────────────────────────────────────────────────────────────
// PricingService — moteur de tarification, §21 du Cahier des charges +
// instruction §21.14 : "éviter les valeurs tarifaires codées en dur,
// utiliser une configuration persistée en base, versionnée et administrable.
// Le calcul du devis et du prix définitif doit être réalisé côté serveur."
//
// Forme attendue de PricingConfig.config (JSON, administrable — §21.12) :
// {
//   "feesTravel": number,              // frais_deplacement
//   "feesPlatform": number,            // frais_plateforme
//   "urgencySupplementPercent": number,// supplement_urgence, en % du sous-total
//   "roundingIncrement": number        // ex: 5 -> arrondi au multiple de 5
// }
// ─────────────────────────────────────────────────────────────────────────

export interface QuoteLine {
  garmentTypeId: string;
  quantity: number;
  unitPrice: number;
  fabricCoefficient: number;
  washCoefficient: number;
  dirtCoefficient: number;
  lineSubtotal: number;
  stainSupplement: number;
  stainRequiresQuote: boolean;
}

export interface QuoteResult {
  pricingConfigId: string;
  currency: string;
  lines?: QuoteLine[];
  subtotal: number;
  stainSupplements: number;
  feesTravel: number;
  feesPlatform: number;
  urgencySupplement: number;
  discount: number;
  total: number;
  requiresManualQuote: boolean;
}

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private catalog: CatalogService,
  ) {}

  // §21.6, §21.12 : toujours la grille active à l'instant du calcul —
  // jamais une valeur mise en cache côté client.
  async getActivePricingConfig(countryId: string) {
    const config = await this.prisma.pricingConfig.findFirst({
      where: { countryId, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!config) {
      throw new NotFoundException('Aucune grille tarifaire active pour ce pays.');
    }
    return config;
  }

  // ── Gestion admin de la grille tarifaire ────────────────────────────
  // Versionnée par conception (§21.12) : pas de route de modification,
  // seulement la publication d'une nouvelle version qui devient active.
  listPricingConfigs(countryId: string) {
    return this.prisma.pricingConfig.findMany({
      where: { countryId },
      orderBy: { version: 'desc' },
    });
  }

  async createPricingConfig(
    countryId: string,
    data: { feesTravel: number; feesPlatform: number; urgencySupplementPercent: number; roundingIncrement: number },
  ) {
    const latest = await this.prisma.pricingConfig.findFirst({
      where: { countryId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const [, created] = await this.prisma.$transaction([
      this.prisma.pricingConfig.updateMany({
        where: { countryId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.pricingConfig.create({
        data: {
          countryId,
          version: nextVersion,
          effectiveFrom: new Date(),
          isActive: true,
          config: data,
        },
      }),
    ]);
    return created;
  }

  private round(amount: number, increment: number): number {
    if (!increment || increment <= 0) return Math.round(amount);
    return Math.round(amount / increment) * increment;
  }

  // Services non itemisés (ménage, repassage) — §5.4. Forfait (FLAT) ou
  // tarification à l'heure (HOURLY) selon ServiceOption.pricingUnit.
  async computeGenericQuote(dto: GenericQuoteDto): Promise<QuoteResult> {
    const option = await this.catalog.getServiceOption(dto.serviceOptionId);
    if (option.basePrice == null) {
      throw new BadRequestException(
        "Cette option de service n'a pas de prix de base configuré — utiliser le devis laverie pour une tarification à la pièce.",
      );
    }
    if (option.pricingUnit === 'HOURLY' && (!dto.hours || dto.hours < 1)) {
      throw new BadRequestException(
        "Cette option est tarifée à l'heure — indiquer un nombre d'heures (hours >= 1).",
      );
    }
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone) throw new NotFoundException('Zone introuvable.');

    const pricingConfig = await this.getActivePricingConfig(zone.countryId);
    const country = await this.prisma.country.findUnique({ where: { id: zone.countryId } });
    const cfg = pricingConfig.config as {
      feesTravel: number;
      feesPlatform: number;
      urgencySupplementPercent: number;
      roundingIncrement: number;
    };

    const subtotal =
      option.pricingUnit === 'HOURLY' ? Number(option.basePrice) * dto.hours! : Number(option.basePrice);
    const urgencySupplement = dto.urgent ? (subtotal * cfg.urgencySupplementPercent) / 100 : 0;
    const discount = 0; // promotions — Phase 2, §15

    const rawTotal = subtotal + cfg.feesTravel + cfg.feesPlatform + urgencySupplement - discount;

    return {
      pricingConfigId: pricingConfig.id,
      currency: country!.currency,
      subtotal,
      stainSupplements: 0,
      feesTravel: cfg.feesTravel,
      feesPlatform: cfg.feesPlatform,
      urgencySupplement,
      discount,
      total: this.round(rawTotal, cfg.roundingIncrement),
      requiresManualQuote: false,
    };
  }

  // Laverie — formule exacte §21.6 :
  //   prix_piece = prix_base × coefficient_tissu × coefficient_methode × coefficient_salete
  //   sous_total_linge = somme(prix_piece × quantité)
  //   total = sous_total_linge + suppléments_taches + frais_deplacement
  //         + frais_plateforme + supplement_urgence - remise
  async computeLaundryQuote(dto: LaundryQuoteDto): Promise<QuoteResult> {
    if (dto.items.length === 0) {
      throw new BadRequestException('Le panier ne peut pas être vide.');
    }

    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone) throw new NotFoundException('Zone introuvable.');

    const pricingConfig = await this.getActivePricingConfig(zone.countryId);
    const country = await this.prisma.country.findUnique({ where: { id: zone.countryId } });
    const cfg = pricingConfig.config as {
      feesTravel: number;
      feesPlatform: number;
      urgencySupplementPercent: number;
      roundingIncrement: number;
    };

    let requiresManualQuote = false;
    const lines: QuoteLine[] = [];

    for (const item of dto.items) {
      const garment = await this.catalog.getGarmentType(item.garmentTypeId);
      const fabric = await this.catalog.getFabricCategoryByCode(item.fabricCategoryCode);
      const method = await this.catalog.getWashMethodByCode(item.washMethodCode);
      const stain = await this.catalog.getStainTypeByCode(item.stainTypeCode);

      // §21.5 : "TRÈS SALE" agit comme un coefficient multiplicatif sur la
      // pièce ; "TACHE PARTICULIÈRE" est un supplément additif séparé
      // (suppléments_taches), pas mélangé dans le coefficient.
      const isMultiplicativeDirt = stain.code === 'VERY_DIRTY';
      const dirtCoefficient =
        isMultiplicativeDirt && stain.surchargeType === 'PERCENT'
          ? 1 + Number(stain.surchargeValue ?? 0) / 100
          : 1;

      const unitPrice = Number(garment.basePrice);
      const linePriceBeforeQty =
        unitPrice * Number(fabric.coefficient) * Number(method.coefficient) * dirtCoefficient;
      const lineSubtotal = linePriceBeforeQty * item.quantity;

      let stainSupplement = 0;
      let stainRequiresQuote = false;
      if (stain.code !== 'NORMAL' && !isMultiplicativeDirt) {
        if (stain.surchargeType === 'FIXED') {
          stainSupplement = Number(stain.surchargeValue ?? 0) * item.quantity;
        } else if (stain.surchargeType === 'QUOTE') {
          stainRequiresQuote = true;
          requiresManualQuote = true;
        }
      }

      lines.push({
        garmentTypeId: item.garmentTypeId,
        quantity: item.quantity,
        unitPrice,
        fabricCoefficient: Number(fabric.coefficient),
        washCoefficient: Number(method.coefficient),
        dirtCoefficient,
        lineSubtotal,
        stainSupplement,
        stainRequiresQuote,
      });
    }

    const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
    const stainSupplements = lines.reduce((sum, l) => sum + l.stainSupplement, 0);
    const urgencySupplement = dto.urgent ? (subtotal * cfg.urgencySupplementPercent) / 100 : 0;
    const discount = 0;

    const rawTotal =
      subtotal + stainSupplements + cfg.feesTravel + cfg.feesPlatform + urgencySupplement - discount;

    return {
      pricingConfigId: pricingConfig.id,
      currency: country!.currency,
      lines,
      subtotal,
      stainSupplements,
      feesTravel: cfg.feesTravel,
      feesPlatform: cfg.feesPlatform,
      urgencySupplement,
      discount,
      total: this.round(rawTotal, cfg.roundingIncrement),
      requiresManualQuote,
    };
  }
}
