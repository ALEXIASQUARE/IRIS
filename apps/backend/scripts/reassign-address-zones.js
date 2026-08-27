// Corrige les adresses (et réservations encore en recherche de partenaire)
// dont la zone ne correspond pas à la vraie localisation du client.
//
// Contexte : avant l'ajout d'un sélecteur ville/quartier explicite dans
// NewBookingScreen (mobile) et App.tsx (Testeur), toute nouvelle adresse
// héritait silencieusement de la première zone du pays — beaucoup
// d'adresses se sont retrouvées taguées "Ebolowa - Abang" quelle que soit
// la ville réelle du client, ce qui empêchait les partenaires de la vraie
// ville de recevoir l'offre (le matching filtre strictement par ville, voir
// MissionsService.findEligiblePartners).
//
// Trois méthodes de correction, dans l'ordre de confiance :
//   1. Géolocalisation réelle — si l'adresse a de vraies coordonnées GPS
//      (pas les valeurs par défaut du formulaire), on prend la zone dont le
//      centre est le plus proche, tous pays confondus (une adresse peut
//      être dans un pays différent de sa zone actuelle, ex: coordonnées
//      belges taguées sur une zone camerounaise par défaut).
//   2. Correspondance exacte — le nom de ville ou de quartier apparaît tel
//      quel dans le repère texte (ex: "zone foto" -> Dschang - Foto).
//   3. Correction floue (distance de Levenshtein, 2 passes) — pour les
//      fautes de frappe (ex: "fotto" -> Foto). On identifie d'abord la
//      ville, PUIS on ne cherche le quartier que parmi les zones de cette
//      ville : chercher directement parmi toutes les zones du pays confond
//      trop souvent deux quartiers homonymes de villes différentes (ex:
//      "fotto" est aussi proche de "Kotto" à Douala que de "Foto" à
//      Dschang en distance d'édition brute).
//
// N'écrase jamais une adresse dont le repère ne correspond à rien de
// connu (ex: une vraie adresse hors des pays couverts, comme une ville
// française sans zone équivalente en base) — laissée telle quelle plutôt
// que réassignée au hasard.
//
// Usage : node scripts/reassign-address-zones.js
//         node scripts/reassign-address-zones.js --dry-run
//
// Exécuté jusqu'ici via `railway ssh --service backend -- node
// scripts/reassign-address-zones.js` pour cibler la base de production.

const { PrismaClient, BookingStatus } = require('@prisma/client');

const prisma = new PrismaClient();

// Coordonnées pré-remplies par le formulaire de réservation quand le client
// n'a ni utilisé le GPS ni tapé de coordonnées réelles — voir
// NewBookingScreen._latController / ClientBooking.tsx. Pas une vraie
// position, donc écartée du rapprochement géographique.
const PLACEHOLDER_LAT = 4.05;
const PLACEHOLDER_LNG = 9.7;

const STOPWORDS = new Set([
  'entre', 'chez', 'vers', 'dans', 'avec', 'sans', 'pour', 'sur', 'sous',
  'coin', 'angle', 'carrefour', 'quartier', 'zone', 'rue', 'avenue',
  'portail', 'maison', 'residence', 'immeuble', 'face', 'derriere',
  'devant', 'pres', 'apres', 'avant', 'cote', 'route', 'voie', 'porte',
  'barriere', 'centre', 'ville', 'bloc', 'lot',
]);

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Tolérance : 1 faute pour un mot de 3-4 lettres, 2 à partir de 5 lettres.
function editThreshold(len) {
  if (len < 3) return 0;
  if (len <= 4) return 1;
  return 2;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function landmarkWords(landmark) {
  return normalize(landmark).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function nearestZoneByGeo(addr, allZones) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const z of allZones) {
    const d = haversineMeters(addr.latitude, addr.longitude, z.centerLat, z.centerLng);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = z;
    }
  }
  return nearest;
}

function exactTextMatch(landmark, allZones) {
  const text = normalize(landmark);
  let best = null;
  for (const z of allZones) {
    const zoneNameNorm = normalize(z.name);
    const cityNorm = normalize(z.cityName);
    if (zoneNameNorm.length >= 3 && text.includes(zoneNameNorm)) return z;
    if (cityNorm.length >= 3 && text.includes(cityNorm) && !best) best = z;
  }
  return best;
}

function fuzzyTextMatch(landmark, allZones) {
  const ws = landmarkWords(landmark);
  if (ws.length === 0) return null;

  // Passe 1 : ville.
  const cities = [...new Set(allZones.map((z) => z.cityName))];
  let bestCity = null;
  let bestCityDist = Infinity;
  for (const city of cities) {
    const cityNorm = normalize(city);
    if (STOPWORDS.has(cityNorm)) continue;
    for (const w of ws) {
      const d = levenshtein(w, cityNorm);
      const t = editThreshold(Math.min(w.length, cityNorm.length));
      if (d <= t && d < bestCityDist) {
        bestCityDist = d;
        bestCity = city;
      }
    }
  }
  if (!bestCity) return null;

  // Passe 2 : quartier, restreint aux zones de la ville identifiée.
  const zonesInCity = allZones.filter((z) => z.cityName === bestCity);
  let bestZone = null;
  let bestZoneDist = Infinity;
  for (const z of zonesInCity) {
    const zoneNameNorm = normalize(z.name);
    if (zoneNameNorm === 'centre' || STOPWORDS.has(zoneNameNorm)) continue;
    for (const w of ws) {
      const d = levenshtein(w, zoneNameNorm);
      const t = editThreshold(Math.min(w.length, zoneNameNorm.length));
      if (d <= t && d < bestZoneDist) {
        bestZoneDist = d;
        bestZone = z;
      }
    }
  }
  return bestZone ?? zonesInCity[0] ?? null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const addresses = await prisma.address.findMany({ include: { zone: true } });
  const allZones = await prisma.zone.findMany();

  let fixed = 0;
  let bookingsFixed = 0;
  let skipped = 0;

  for (const addr of addresses) {
    if (!addr.zone) continue;
    const isPlaceholder = addr.latitude === PLACEHOLDER_LAT && addr.longitude === PLACEHOLDER_LNG;

    let target = null;
    let method = null;
    if (!isPlaceholder) {
      target = nearestZoneByGeo(addr, allZones);
      method = 'geo';
    } else {
      target = exactTextMatch(addr.landmark, allZones);
      method = 'texte exact';
      if (!target) {
        target = fuzzyTextMatch(addr.landmark, allZones);
        method = 'texte flou';
      }
    }

    if (!target || target.id === addr.zoneId) {
      if (isPlaceholder && !target) {
        skipped++;
        console.log(`NON RÉSOLU  ${addr.id.slice(0, 8)}  "${addr.landmark}"`);
      }
      continue;
    }

    const matchingBookings = await prisma.booking.count({
      where: { addressId: addr.id, status: BookingStatus.SEARCHING_PARTNER },
    });

    console.log(
      `${dryRun ? '[dry-run] ' : 'OK '}${addr.id.slice(0, 8)}  "${addr.landmark}"  (${method})  ` +
        `${addr.zone.cityName} - ${addr.zone.name}  ->  ${target.cityName} - ${target.name}` +
        (matchingBookings > 0 ? `  [${matchingBookings} réservation(s)]` : ''),
    );
    fixed++;
    bookingsFixed += matchingBookings;

    if (dryRun) continue;

    await prisma.address.update({ where: { id: addr.id }, data: { zoneId: target.id } });
    await prisma.booking.updateMany({
      where: { addressId: addr.id, status: BookingStatus.SEARCHING_PARTNER },
      data: { zoneId: target.id },
    });
  }

  console.log('---');
  console.log(`Adresses ${dryRun ? 'à corriger' : 'corrigées'} : ${fixed}`);
  console.log(`Réservations en recherche de partenaire ${dryRun ? 'à corriger' : 'corrigées'} : ${bookingsFixed}`);
  console.log(`Adresses laissées telles quelles (aucun repérage fiable) : ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
