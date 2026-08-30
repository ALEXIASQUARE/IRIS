-- Correctif ponctuel : les clients Lalas (Paris) et Kendy (Libramont) et
-- surtout leurs réservations étaient rattachés à une zone du Cameroun
-- (Ebolowa — Abang / Douala) → invisibles pour les partenaires sur place.
--
--   railway connect MySQL < apps/backend/prisma/fix-testers-zones.sql
--   (ou :  railway connect MySQL  puis  SOURCE .../fix-testers-zones.sql)
--
-- Idempotent. Ne touche ni l'historique (réservations terminées/annulées)
-- ni les offres acceptées. Identifiants de zone inlinés (les variables
-- utilisateur MySQL provoquaient un « Illegal mix of collations »).

-- ── AVANT ────────────────────────────────────────────────────────────────
SELECT 'AVANT' AS phase, u.firstName, u.lastName, u.phone,
       CONCAT(zh.cityName,' / ',zh.name) AS home_zone,
       (SELECT COUNT(*) FROM bookings b WHERE b.clientId = u.id AND b.status = 'SEARCHING_PARTNER') AS resa_en_recherche
FROM users u LEFT JOIN zones zh ON zh.id = u.homeZoneId
WHERE u.phone IN ('+33659860905', '+393715196089');

-- ── 1. Zone par défaut du profil ───────────────────────────────────────
UPDATE users SET homeZoneId = '568f4830-d9f5-403f-836c-1b5164913c97'
 WHERE phone = '+33659860905';
UPDATE users SET homeZoneId = 'e55329a6-a79d-480c-b67e-e0c641e97938'
 WHERE phone = '+393715196089';

-- ── 2. Adresses enregistrées (zone + centre de la zone) ────────────────
UPDATE addresses a
  JOIN users u ON u.id = a.userId
  JOIN zones z ON z.id = '568f4830-d9f5-403f-836c-1b5164913c97'
   SET a.zoneId = z.id, a.latitude = z.centerLat, a.longitude = z.centerLng
 WHERE u.phone = '+33659860905';
UPDATE addresses a
  JOIN users u ON u.id = a.userId
  JOIN zones z ON z.id = 'e55329a6-a79d-480c-b67e-e0c641e97938'
   SET a.zoneId = z.id, a.latitude = z.centerLat, a.longitude = z.centerLng
 WHERE u.phone = '+393715196089';

-- ── 3. Réservations encore en cours → bonne zone ──────────────────────
UPDATE bookings b JOIN users u ON u.id = b.clientId
   SET b.zoneId = '568f4830-d9f5-403f-836c-1b5164913c97'
 WHERE u.phone = '+33659860905'
   AND b.status IN ('SEARCHING_PARTNER','PARTNER_ASSIGNED','PARTNER_EN_ROUTE','ARRIVED','PRICE_REVISION_PENDING');
UPDATE bookings b JOIN users u ON u.id = b.clientId
   SET b.zoneId = 'e55329a6-a79d-480c-b67e-e0c641e97938'
 WHERE u.phone = '+393715196089'
   AND b.status IN ('SEARCHING_PARTNER','PARTNER_ASSIGNED','PARTNER_EN_ROUTE','ARRIVED','PRICE_REVISION_PENDING');

-- ── 4. Purger les offres obsolètes (diffusion vers Abang) → une nouvelle
--       diffusion vers la bonne ville se fera au prochain passage du job
--       planifié (retryStuckBookings).
DELETE o FROM offers o
  JOIN bookings b ON b.id = o.bookingId
  JOIN users u ON u.id = b.clientId
 WHERE u.phone IN ('+33659860905', '+393715196089')
   AND b.status = 'SEARCHING_PARTNER'
   AND o.status <> 'ACCEPTED';

-- ── APRÈS ────────────────────────────────────────────────────────────────
SELECT 'APRES' AS phase, u.lastName, b.status,
       CONCAT(z.cityName,' / ',z.name) AS zone, COUNT(*) AS nb
FROM bookings b
  JOIN users u ON u.id = b.clientId
  JOIN zones z ON z.id = b.zoneId
WHERE u.phone IN ('+33659860905', '+393715196089')
GROUP BY u.lastName, b.status, zone
ORDER BY u.lastName, b.status;

-- Partenaires positionnés sur Paris 1er / Libramont Centre (vérifie que ton
-- compte partenaire y est, ACTIVE et disponible) :
SELECT pu.firstName, pu.lastName, pu.phone, p.status, p.isAvailable,
       CONCAT(z.cityName,' / ',z.name) AS zone
FROM partner_profiles p
  JOIN users pu ON pu.id = p.userId
  LEFT JOIN zones z ON z.id = p.currentZoneId
WHERE p.currentZoneId IN ('568f4830-d9f5-403f-836c-1b5164913c97',
                          'e55329a6-a79d-480c-b67e-e0c641e97938');
