import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Regroupe les accès au catalogue de services et au catalogue laverie
// (§21.2-21.4 du Cahier des charges). Utilisé à la fois par les endpoints
// GET publics (§21.11) et par PricingService pour le calcul de devis.
@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async listServiceCategories(countryId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { countryId, isActive: true },
      include: { options: { where: { isActive: true } } },
    });
  }

  async getServiceCategory(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!category || !category.isActive) {
      throw new NotFoundException('Catégorie de service introuvable.');
    }
    return category;
  }

  async getServiceOption(id: string) {
    const option = await this.prisma.serviceOption.findUnique({ where: { id } });
    if (!option || !option.isActive) {
      throw new NotFoundException('Option de service introuvable.');
    }
    return option;
  }

  // ── Gestion admin des catégories de service ─────────────────────────
  listAllServiceCategoriesForCountry(countryId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { countryId },
      orderBy: { name: 'asc' },
    });
  }

  createServiceCategory(countryId: string, data: { code: string; name: string; isActive?: boolean }) {
    return this.prisma.serviceCategory.create({ data: { ...data, countryId } });
  }

  async updateServiceCategory(id: string, data: { name?: string; isActive?: boolean }) {
    const existing = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Catégorie de service introuvable.');
    return this.prisma.serviceCategory.update({ where: { id }, data });
  }

  // ── Gestion admin des options de service (ménage, repassage — forfait ou
  // tarifées à l'heure via pricingUnit) ────────────────────────────────
  listServiceOptions(serviceCategoryId: string) {
    return this.prisma.serviceOption.findMany({
      where: { serviceCategoryId },
      orderBy: { name: 'asc' },
    });
  }

  async createServiceOption(
    serviceCategoryId: string,
    data: { code: string; name: string; basePrice: number; pricingUnit?: 'FLAT' | 'HOURLY' },
  ) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!category) throw new NotFoundException('Catégorie de service introuvable.');
    return this.prisma.serviceOption.create({ data: { ...data, serviceCategoryId } });
  }

  async updateServiceOption(
    id: string,
    data: { name?: string; basePrice?: number; pricingUnit?: 'FLAT' | 'HOURLY'; isActive?: boolean },
  ) {
    const existing = await this.prisma.serviceOption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Option de service introuvable.');
    return this.prisma.serviceOption.update({ where: { id }, data });
  }

  // Catalogue laverie — chaque lookup retombe sur une valeur neutre
  // (coefficient 1.00 / pas de supplément) si le code n'est pas fourni,
  // conformément à §21.4 : "Lavage standard : coefficient 1,00" par défaut.
  async listGarmentTypes(countryId: string) {
    return this.prisma.garmentType.findMany({
      where: { isActive: true, OR: [{ countryId }, { countryId: null }] },
    });
  }

  async getGarmentType(id: string) {
    const garment = await this.prisma.garmentType.findUnique({ where: { id } });
    if (!garment || !garment.isActive) {
      throw new NotFoundException('Type de vêtement introuvable.');
    }
    return garment;
  }

  // ── Gestion admin du catalogue laverie ──────────────────────────────
  listAllGarmentTypes() {
    return this.prisma.garmentType.findMany({ orderBy: { name: 'asc' } });
  }

  createGarmentType(data: { code: string; name: string; basePrice: number; countryId?: string }) {
    return this.prisma.garmentType.create({ data });
  }

  async updateGarmentType(id: string, data: { name?: string; basePrice?: number; isActive?: boolean }) {
    const existing = await this.prisma.garmentType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Type de vêtement introuvable.');
    return this.prisma.garmentType.update({ where: { id }, data });
  }

  listAllStainTypes() {
    return this.prisma.stainType.findMany({ orderBy: { name: 'asc' } });
  }

  createStainType(data: { code: string; name: string; surchargeType: string; surchargeValue?: number }) {
    return this.prisma.stainType.create({ data });
  }

  async updateStainType(
    id: string,
    data: { name?: string; surchargeType?: string; surchargeValue?: number },
  ) {
    const existing = await this.prisma.stainType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Type de tache introuvable.');
    return this.prisma.stainType.update({ where: { id }, data });
  }

  async listFabricCategories() {
    return this.prisma.fabricCategory.findMany();
  }

  async getFabricCategoryByCode(code = 'STANDARD') {
    const fabric = await this.prisma.fabricCategory.findUnique({ where: { code } });
    if (!fabric) throw new NotFoundException(`Catégorie de tissu inconnue : ${code}`);
    return fabric;
  }

  async listWashMethods() {
    return this.prisma.washMethod.findMany();
  }

  async getWashMethodByCode(code = 'STANDARD') {
    const method = await this.prisma.washMethod.findUnique({ where: { code } });
    if (!method) throw new NotFoundException(`Méthode de lavage inconnue : ${code}`);
    return method;
  }

  async listStainTypes() {
    return this.prisma.stainType.findMany();
  }

  async getStainTypeByCode(code = 'NORMAL') {
    const stain = await this.prisma.stainType.findUnique({ where: { code } });
    if (!stain) throw new NotFoundException(`Type de tache inconnu : ${code}`);
    return stain;
  }

  async listPackageDeals(countryId: string) {
    return this.prisma.packageDeal.findMany({
      where: { OR: [{ countryId }, { countryId: null }] },
    });
  }
}
