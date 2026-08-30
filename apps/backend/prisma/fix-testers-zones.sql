-- Correctif ponctuel : les clients Lalas (Paris) et Kendy (Libramont) et
-- leurs réservations étaient rattachés à une zone du Cameroun (Ebolowa —
-- Abang), donc invisibles pour les partenaires réellement sur place.
--
--   railway connect MySQL
--   puis coller ce fichier (ou :  SOURCE apps/backend/prisma/fix-testers-zones.sql)
--
-- Idempotent. Ne touche ni l'historique (réservations terminées/annulées)
-- ni les offres acceptées.

SET @paris := '568f4830-d9f5-403f-836c-1b5164913c97';   -- Paris — 1er arrondissement (FR)
SET @libra := 'e55329a6-a79d-480c-b67e-e0c641e97938';   -- Libramont-Chevigny — Centre (BE)
SET @lalas := (SELECT id FROM users WHERE phone = '+33659860905');   -- Lalas Lalas
SET @kendy := (SELECT id FROM users WHERE phone = '+393715196089');  -- eurol kindy lemofack voukeng

-- ── AVANT ────────────────────────────────────────────────────────────────
SELECT 'AVANT' AS phase, u.firstName, u.lastName, u.phone,
       CONCAT(zh.cityName,' / ',zh.name) AS home_zone,
       (SELECT COUNT(*) FROM bookings b WHERE b.clientId = u.id AND b.status = 'SEARCHING_PARTNER') AS resa_en_recherche
FROM users u LEFT JOIN zones zh ON zh.id = u.homeZoneId
WHERE u.id IN (@lalas, @kendy);

-- ── 1. Zone par défaut du profil ────────────────────────────────────────
UPDATE users SET homeZoneId = @paris WHERE id = @lalas;
UPDATE users SET homeZoneId = @libra WHERE id = @kendy;

-- ── 2. Adresses enregistrées (zone + centre) ────────────────────────────
UPDATE addresses a JOIN zones z ON z.id = @paris
   SET a.zoneId = @paris, a.latitude = z.centerLat, a.longitude = z.centerLng
 WHERE a.userId = @lalas;
UPDATE addresses a JOIN zones z ON z.id = @libra
   SET a.zoneId = @libra, a.latitude = z.centerLat, a.longitude = z.centerLng
 WHERE a.userId = @kendy;

-- ── 3. Réservations encore en cours -> bonne zone ───────────────────────
UPDATE bookings SET zoneId = @paris
 WHERE clientId = @lalas
   AND status IN ('SEARCHING_PARTNER','PARTNER_ASSIGNED','PARTNER_EN_ROUTE','ARRIVED','PRICE_REVISION_PENDING');
UPDATE bookings SET zoneId = @libra
 WHERE clientId = @kendy
   AND status IN ('SEARCHING_PARTNER','PARTNER_ASSIGNED','PARTNER_EN_ROUTE','ARRIVED','PRICE_REVISION_PENDING');

-- ── 4. Purger les offres obsolètes (diffusion vers Abang) pour forcer ───
--       une nouvelle diffusion vers la bonne ville au prochain passage du
--       job planifié (retryStuckBookings).
DELETE o FROM offers o
  JOIN bookings b ON b.id = o.bookingId
 WHERE b.clientId IN (@lalas, @kendy)
   AND b.status = 'SEARCHING_PARTNER'
   AND o.status <> 'ACCEPTED';

-- ── APRÈS ──────────────────────────────────────────────────────────────
SELECT 'APRES' AS phase, u.lastName, b.status,
       CONCAT(z.cityName,' / ',z.name) AS zone, COUNT(*) AS nb
FROM bookings b
  JOIN users u ON u.id = b.clientId
  JOIN zones z ON z.id = b.zoneId
WHERE b.clientId IN (@lalas, @kendy)
GROUP BY u.lastName, b.status, zone
ORDER BY u.lastName, b.status;

-- Partenaires positionnés sur Paris / Libramont (vérifie que ton compte y est,
-- ACTIVE et disponible) :
SELECT pu.firstName, pu.lastName, pu.phone, p.status, p.isAvailable,
       CONCAT(z.cityName,' / ',z.name) AS zone
FROM partner_profiles p
  JOIN users pu ON pu.id = p.userId
  LEFT JOIN zones z ON z.id = p.currentZoneId
WHERE p.currentZoneId IN (@paris, @libra);
