import { PricingService } from '../pricing.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Couvre §21.6 (formule laverie), §21.5 (règles tache), §21.12 (arrondi et
// grille active) — mentionné comme manquant dans le README ("reste à
// couvrir pricing").

function buildPrismaMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    zone: {
      findUnique: jest.fn().mockResolvedValue({ id: 'zone-1', countryId: 'country-1', isActive: true }),
    },
    country: {
      findUnique: jest.fn().mockResolvedValue({ id: 'country-1', currency: 'XAF' }),
    },
    pricingConfig: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'config-1',
        version: 1,
        config: { feesTravel: 500, feesPlatform: 200, urgencySupplementPercent: 15, roundingIncrement: 5 },
      }),
    },
    ...overrides,
  };
}

function buildCatalogMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    getServiceOption: jest.fn().mockResolvedValue({ id: 'option-1', basePrice: 2000 }),
    getGarmentType: jest.fn().mockResolvedValue({ id: 'g1', basePrice: 300 }),
    getFabricCategoryByCode: jest.fn().mockResolvedValue({ code: 'STANDARD', coefficient: 1.0 }),
    getWashMethodByCode: jest.fn().mockResolvedValue({ code: 'STANDARD', coefficient: 1.0 }),
    getStainTypeByCode: jest.fn().mockResolvedValue({ code: 'NORMAL', surchargeType: 'PERCENT', surchargeValue: 0 }),
    ...overrides,
  };
}

describe('PricingService — computeLaundryQuote', () => {
  it("calcule le total avec la formule exacte (prix_base × coef_tissu × coef_methode × coef_salete)", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock();
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeLaundryQuote({
      serviceCategoryId: 'cat-1',
      zoneId: 'zone-1',
      items: [{ garmentTypeId: 'g1', quantity: 2 }],
    } as any);

    // 300 * 1.0 * 1.0 * 1 * 2 = 600 ; +500 +200 = 1300, déjà multiple de 5.
    expect(result.subtotal).toBe(600);
    expect(result.total).toBe(1300);
    expect(result.requiresManualQuote).toBe(false);
  });

  it("ajoute le supplément d'urgence en pourcentage du sous-total quand urgent=true", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock();
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeLaundryQuote({
      serviceCategoryId: 'cat-1',
      zoneId: 'zone-1',
      items: [{ garmentTypeId: 'g1', quantity: 2 }],
      urgent: true,
    } as any);

    // subtotal 600, supplément urgence 15% = 90 ; total = 600+500+200+90 = 1390.
    expect(result.urgencySupplement).toBe(90);
    expect(result.total).toBe(1390);
  });

  it("arrondit le total au multiple de roundingIncrement le plus proche", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getGarmentType: jest.fn().mockResolvedValue({ id: 'g1', basePrice: 333 }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeLaundryQuote({
      serviceCategoryId: 'cat-1',
      zoneId: 'zone-1',
      items: [{ garmentTypeId: 'g1', quantity: 1 }],
    } as any);

    // subtotal 333 + 500 + 200 = 1033 -> 1033/5 = 206.6 -> arrondi à 207*5 = 1035.
    expect(result.total).toBe(1035);
  });

  it("applique le coefficient TRÈS SALE de façon multiplicative sur la pièce (pas en supplément additif)", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getStainTypeByCode: jest
        .fn()
        .mockResolvedValue({ code: 'VERY_DIRTY', surchargeType: 'PERCENT', surchargeValue: 20 }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeLaundryQuote({
      serviceCategoryId: 'cat-1',
      zoneId: 'zone-1',
      items: [{ garmentTypeId: 'g1', quantity: 1, stainTypeCode: 'VERY_DIRTY' }],
    } as any);

    // 300 * 1 * 1 * 1.2 = 360 ; aucun supplément additif séparé.
    expect(result.subtotal).toBe(360);
    expect(result.stainSupplements).toBe(0);
    expect(result.lines![0].dirtCoefficient).toBe(1.2);
  });

  it("applique une TACHE PARTICULIÈRE comme supplément fixe additif, séparé du sous-total", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getStainTypeByCode: jest
        .fn()
        .mockResolvedValue({ code: 'SPECIFIC_STAIN', surchargeType: 'FIXED', surchargeValue: 150 }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeLaundryQuote({
      serviceCategoryId: 'cat-1',
      zoneId: 'zone-1',
      items: [{ garmentTypeId: 'g1', quantity: 2, stainTypeCode: 'SPECIFIC_STAIN' }],
    } as any);

    // sous-total pièces inchangé (dirtCoefficient=1), supplément = 150*2 = 300 à part.
    expect(result.subtotal).toBe(600);
    expect(result.stainSupplements).toBe(300);
  });

  it("signale requiresManualQuote quand une tache exige un devis manuel, sans lever d'exception", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getStainTypeByCode: jest.fn().mockResolvedValue({ code: 'UNKNOWN_STAIN', surchargeType: 'QUOTE' }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeLaundryQuote({
      serviceCategoryId: 'cat-1',
      zoneId: 'zone-1',
      items: [{ garmentTypeId: 'g1', quantity: 1, stainTypeCode: 'UNKNOWN_STAIN' }],
    } as any);

    expect(result.requiresManualQuote).toBe(true);
  });

  it('refuse un panier vide', async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock();
    const service = new PricingService(prisma as any, catalog as any);

    await expect(
      service.computeLaundryQuote({ serviceCategoryId: 'cat-1', zoneId: 'zone-1', items: [] } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('lève NotFoundException si la zone est introuvable', async () => {
    const prisma = buildPrismaMock({ zone: { findUnique: jest.fn().mockResolvedValue(null) } });
    const catalog = buildCatalogMock();
    const service = new PricingService(prisma as any, catalog as any);

    await expect(
      service.computeLaundryQuote({
        serviceCategoryId: 'cat-1',
        zoneId: 'zone-inconnue',
        items: [{ garmentTypeId: 'g1', quantity: 1 }],
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("lève NotFoundException si aucune grille tarifaire active n'existe pour le pays", async () => {
    const prisma = buildPrismaMock({ pricingConfig: { findFirst: jest.fn().mockResolvedValue(null) } });
    const catalog = buildCatalogMock();
    const service = new PricingService(prisma as any, catalog as any);

    await expect(
      service.computeLaundryQuote({
        serviceCategoryId: 'cat-1',
        zoneId: 'zone-1',
        items: [{ garmentTypeId: 'g1', quantity: 1 }],
      } as any),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PricingService — computeGenericQuote', () => {
  it('calcule le total pour un service forfaitaire (ménage/repassage)', async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock();
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeGenericQuote({
      serviceOptionId: 'option-1',
      zoneId: 'zone-1',
    } as any);

    // 2000 + 500 + 200 = 2700, déjà multiple de 5.
    expect(result.subtotal).toBe(2000);
    expect(result.total).toBe(2700);
  });

  it("refuse une option de service sans prix de base configuré", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getServiceOption: jest.fn().mockResolvedValue({ id: 'option-1', basePrice: null }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    await expect(
      service.computeGenericQuote({ serviceOptionId: 'option-1', zoneId: 'zone-1' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('multiplie le prix de base par le nombre d\'heures pour une option HOURLY (ménage, repassage)', async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getServiceOption: jest.fn().mockResolvedValue({ id: 'option-1', basePrice: 1500, pricingUnit: 'HOURLY' }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    const result = await service.computeGenericQuote({
      serviceOptionId: 'option-1',
      zoneId: 'zone-1',
      hours: 3,
    } as any);

    // 1500 * 3 = 4500 ; +500 +200 = 5200, déjà multiple de 5.
    expect(result.subtotal).toBe(4500);
    expect(result.total).toBe(5200);
  });

  it("refuse une option HOURLY sans nombre d'heures indiqué", async () => {
    const prisma = buildPrismaMock();
    const catalog = buildCatalogMock({
      getServiceOption: jest.fn().mockResolvedValue({ id: 'option-1', basePrice: 1500, pricingUnit: 'HOURLY' }),
    });
    const service = new PricingService(prisma as any, catalog as any);

    await expect(
      service.computeGenericQuote({ serviceOptionId: 'option-1', zoneId: 'zone-1' } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
