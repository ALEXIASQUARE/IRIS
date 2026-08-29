-- Équivalent SQL de prisma/backfill-catalogs.ts — à lancer directement sur
-- la base quand on ne peut pas redéployer le backend pour utiliser le
-- script TypeScript.
--
--   railway connect MySQL        (ouvre un shell mysql sur la prod)
--   puis coller ce fichier, ou :  SOURCE apps/backend/prisma/backfill-catalogs.sql
--
-- Idempotent : ne crée que ce qui manque. Le Cameroun (déjà pourvu) est
-- ignoré par les NOT EXISTS. Barème indicatif par devise (EUR/USD vs
-- autres) — exemples de départ, à affiner via l'admin.

-- 1. Catégories Laverie / Ménage / Repassage pour chaque pays actif.
INSERT INTO service_categories (id, countryId, code, name, isActive)
SELECT UUID(), c.id, x.code, x.name, 1
FROM countries c
CROSS JOIN (
  SELECT 'LAUNDRY'  AS code, 'Laverie'   AS name
  UNION ALL SELECT 'CLEANING', 'Ménage'
  UNION ALL SELECT 'IRONING',  'Repassage'
) x
WHERE c.isActive = 1
  AND NOT EXISTS (
    SELECT 1 FROM service_categories sc
    WHERE sc.countryId = c.id AND sc.code = x.code
  );

-- 2. Options horaires (ménage, repassage).
INSERT INTO service_options (id, serviceCategoryId, code, name, basePrice, pricingUnit, isActive)
SELECT UUID(), sc.id, o.code, o.name,
       CASE WHEN c.currency IN ('EUR', 'USD') THEN o.price_eur ELSE o.price_xaf END,
       'HOURLY', 1
FROM service_categories sc
JOIN countries c ON c.id = sc.countryId
JOIN (
  SELECT 'CLEANING' AS cat, 'CLEANING_HOURLY' AS code,
         'Ménage à domicile (par heure)' AS name, 1500 AS price_xaf, 20 AS price_eur
  UNION ALL
  SELECT 'IRONING', 'IRONING_HOURLY',
         'Repassage à domicile (par heure)', 1000, 15
) o ON o.cat = sc.code
WHERE NOT EXISTS (
  SELECT 1 FROM service_options so
  WHERE so.serviceCategoryId = sc.id AND so.code = o.code
);

-- 3. Grille tarifaire active pour chaque pays actif qui n'en a aucune.
INSERT INTO pricing_configs (id, countryId, version, effectiveFrom, isActive, config)
SELECT UUID(), c.id, 1, NOW(3), 1,
  JSON_OBJECT(
    'feesTravel',                CASE WHEN c.currency IN ('EUR','USD') THEN 5   ELSE 500 END,
    'feesPlatform',              CASE WHEN c.currency IN ('EUR','USD') THEN 2   ELSE 200 END,
    'urgencySupplementPercent',  15,
    'roundingIncrement',         CASE WHEN c.currency IN ('EUR','USD') THEN 1   ELSE 5   END
  )
FROM countries c
WHERE c.isActive = 1
  AND NOT EXISTS (SELECT 1 FROM pricing_configs pc WHERE pc.countryId = c.id);

-- Contrôle
SELECT c.isoCode, c.name, c.currency,
       (SELECT COUNT(*) FROM service_categories sc WHERE sc.countryId = c.id) AS categories,
       (SELECT COUNT(*) FROM pricing_configs pc WHERE pc.countryId = c.id AND pc.isActive = 1) AS grille_active
FROM countries c
WHERE c.isActive = 1
ORDER BY c.name;
