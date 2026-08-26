import { PrismaClient } from '@prisma/client';

// Données de départ pour tester le parcours complet en local.
// Ne contient aucune valeur commerciale définitive — §21.2 du Cahier des
// charges : "Les valeurs suivantes sont des exemples de départ et ne
// constituent pas encore la grille commerciale définitive."

const prisma = new PrismaClient();

async function main() {
  const cameroon = await prisma.country.upsert({
    where: { isoCode: 'CM' },
    update: {},
    create: {
      isoCode: 'CM',
      name: 'Cameroun',
      currency: 'XAF',
      defaultLanguage: 'fr',
      isActive: true,
      healthModuleEnabled: false,
    },
  });

  const douala = await prisma.zone.create({
    data: {
      countryId: cameroon.id,
      cityName: 'Douala',
      name: 'Douala - Akwa',
      isActive: true,
      centerLat: 4.0511,
      centerLng: 9.7679,
      radiusMeters: 5000,
    },
  });

  const laundry = await prisma.serviceCategory.create({
    data: {
      countryId: cameroon.id,
      code: 'LAUNDRY',
      name: 'Laverie',
    },
  });

  const cleaning = await prisma.serviceCategory.create({
    data: {
      countryId: cameroon.id,
      code: 'CLEANING',
      name: 'Ménage',
    },
  });

  const ironing = await prisma.serviceCategory.create({
    data: {
      countryId: cameroon.id,
      code: 'IRONING',
      name: 'Repassage',
    },
  });

  // Services non itemisés, tarifés à l'heure — exemples de départ, §21.4.
  await prisma.serviceOption.createMany({
    data: [
      {
        serviceCategoryId: cleaning.id,
        code: 'CLEANING_HOURLY',
        name: 'Ménage à domicile (par heure)',
        basePrice: 1500,
        pricingUnit: 'HOURLY',
      },
      {
        serviceCategoryId: ironing.id,
        code: 'IRONING_HOURLY',
        name: 'Repassage à domicile (par heure)',
        basePrice: 1000,
        pricingUnit: 'HOURLY',
      },
    ],
  });

  // Catalogue laverie — exemples de départ, §21.2-21.5.
  await prisma.garmentType.createMany({
    data: [
      { code: 'TSHIRT', name: 'T-shirt', basePrice: 300 },
      { code: 'SHIRT', name: 'Chemise', basePrice: 400 },
      { code: 'JEANS', name: 'Jean', basePrice: 500 },
      { code: 'TROUSERS', name: 'Pantalon', basePrice: 450 },
      { code: 'UNDERWEAR', name: 'Sous-vêtement', basePrice: 150 },
    ],
  });

  await prisma.fabricCategory.createMany({
    data: [
      { code: 'STANDARD', name: 'Standard', coefficient: 1.0 },
      { code: 'DELICATE', name: 'Délicat', coefficient: 1.3 },
      { code: 'VERY_DELICATE', name: 'Très délicat / spécial', coefficient: 1.5 },
    ],
  });

  await prisma.washMethod.createMany({
    data: [
      { code: 'STANDARD', name: 'Lavage standard', coefficient: 1.0 },
      { code: 'HAND_ONLY', name: 'Lavage exclusivement à la main', coefficient: 1.2 },
      { code: 'DELICATE_HAND', name: 'Lavage délicat à la main', coefficient: 1.35 },
    ],
  });

  await prisma.stainType.createMany({
    data: [
      { code: 'NORMAL', name: 'Normal', surchargeType: 'PERCENT', surchargeValue: 0 },
      { code: 'VERY_DIRTY', name: 'Très sale', surchargeType: 'PERCENT', surchargeValue: 20 },
      { code: 'SPECIFIC_STAIN', name: 'Tache particulière', surchargeType: 'FIXED', surchargeValue: 150 },
    ],
  });

  // Grille tarifaire active — structure JSON documentée dans PricingService.
  await prisma.pricingConfig.create({
    data: {
      countryId: cameroon.id,
      version: 1,
      effectiveFrom: new Date(),
      isActive: true,
      config: {
        feesTravel: 500,
        feesPlatform: 200,
        urgencySupplementPercent: 15,
        roundingIncrement: 5,
      },
    },
  });

  console.log('Seed terminé :', { country: cameroon.isoCode, zone: douala.name, category: laundry.code });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
