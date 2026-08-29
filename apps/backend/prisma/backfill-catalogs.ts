import { PrismaClient, PricingUnit } from '@prisma/client';

// Backfill : donne à CHAQUE pays actif un catalogue de services minimal
// (Laverie / Ménage / Repassage + options horaires + grille tarifaire
// active), pour que la réservation ne renvoie plus "Aucun service
// disponible" hors du Cameroun.
//
// Les articles/tissus/lavages/salissures sont globaux (countryId null, voir
// seed.ts) et s'appliquent déjà à tous les pays — rien à créer de ce côté.
//
// Idempotent : relançable sans risque (upsert sur les catégories, création
// conditionnelle des options et de la grille).
//
// Valeurs = exemples de départ, §21.2 : PAS la grille commerciale
// définitive. À ajuster par pays via l'admin (onglet Catalogue).
//
// Lancement en prod :
//   railway ssh --service backend "npm run backfill:catalogs"

const prisma = new PrismaClient();

const CATEGORIES: { code: string; name: string }[] = [
  { code: 'LAUNDRY', name: 'Laverie' },
  { code: 'CLEANING', name: 'Ménage' },
  { code: 'IRONING', name: 'Repassage' },
];

// Barèmes indicatifs par devise. Devise inconnue -> repli sur XAF.
const PRICING: Record<
  string,
  { cleaning: number; ironing: number; feesTravel: number; feesPlatform: number; rounding: number }
> = {
  XAF: { cleaning: 1500, ironing: 1000, feesTravel: 500, feesPlatform: 200, rounding: 5 },
  XOF: { cleaning: 1500, ironing: 1000, feesTravel: 500, feesPlatform: 200, rounding: 5 },
  EUR: { cleaning: 20, ironing: 15, feesTravel: 5, feesPlatform: 2, rounding: 1 },
  USD: { cleaning: 22, ironing: 16, feesTravel: 6, feesPlatform: 3, rounding: 1 },
};

async function main() {
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  let created = 0;

  for (const country of countries) {
    const p = PRICING[country.currency] ?? PRICING.XAF;

    // 1. Catégories — upsert sur @@unique([countryId, code]).
    const catIdByCode: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      const row = await prisma.serviceCategory.upsert({
        where: { countryId_code: { countryId: country.id, code: cat.code } },
        update: {},
        create: { countryId: country.id, code: cat.code, name: cat.name },
      });
      catIdByCode[cat.code] = row.id;
    }

    // 2. Options horaires (ménage, repassage) — créées si absentes.
    const wanted = [
      {
        serviceCategoryId: catIdByCode.CLEANING,
        code: 'CLEANING_HOURLY',
        name: 'Ménage à domicile (par heure)',
        basePrice: p.cleaning,
        pricingUnit: PricingUnit.HOURLY,
      },
      {
        serviceCategoryId: catIdByCode.IRONING,
        code: 'IRONING_HOURLY',
        name: 'Repassage à domicile (par heure)',
        basePrice: p.ironing,
        pricingUnit: PricingUnit.HOURLY,
      },
    ];
    for (const opt of wanted) {
      const exists = await prisma.serviceOption.findFirst({
        where: { serviceCategoryId: opt.serviceCategoryId, code: opt.code },
      });
      if (!exists) await prisma.serviceOption.create({ data: opt });
    }

    // 3. Grille tarifaire active — créée seulement si le pays n'en a aucune.
    const hasActiveConfig = await prisma.pricingConfig.count({
      where: { countryId: country.id, isActive: true },
    });
    if (hasActiveConfig === 0) {
      await prisma.pricingConfig.create({
        data: {
          countryId: country.id,
          version: 1,
          effectiveFrom: new Date(),
          isActive: true,
          config: {
            feesTravel: p.feesTravel,
            feesPlatform: p.feesPlatform,
            urgencySupplementPercent: 15,
            roundingIncrement: p.rounding,
          },
        },
      });
      created += 1;
      console.log(`✓ ${country.isoCode} — ${country.name} : catalogue + grille (${country.currency})`);
    } else {
      console.log(`· ${country.isoCode} — ${country.name} : catégories OK, grille déjà présente`);
    }
  }

  console.log(`\nTerminé — ${countries.length} pays actifs traités, ${created} nouvelle(s) grille(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
