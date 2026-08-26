import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BookingStatus, OfferStatus, PartnerStatus, UserRole } from '@prisma/client';

// Test d'intégration explicitement demandé par la note laissée dans
// missions.service.spec.ts : exercer deux appels HTTP concurrents réels
// contre une vraie base (pas un mock), pour valider que la garantie du
// Cahier des charges §17 ("deux partenaires ne doivent jamais accepter
// simultanément la même mission") tient aussi au niveau du moteur SQL, pas
// seulement dans la logique applicative testée en isolation ailleurs.
//
// Tourne contre une base de test dédiée (voir test/setup-env.ts) — jamais
// contre la base de dev/démo.

const TEST_COUNTRY_ISO_CODE = 'E2';

// Supprime, dans l'ordre compatible avec les contraintes de clé étrangère,
// toutes les données créées par ce test — appelé avant (au cas où une
// exécution précédente aurait échoué avant afterAll) et après le test, pour
// que la suite reste ré-exécutable sans violer les contraintes uniques
// (isoCode du pays, numéros de téléphone).
async function cleanupTestData(prisma: PrismaService) {
  const country = await prisma.country.findUnique({ where: { isoCode: TEST_COUNTRY_ISO_CODE } });
  if (!country) return;

  const users = await prisma.user.findMany({ where: { countryId: country.id }, select: { id: true } });
  const userIds = users.map((u) => u.id);

  const partnerProfiles = await prisma.partnerProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const partnerProfileIds = partnerProfiles.map((p) => p.id);

  const bookings = await prisma.booking.findMany({ where: { clientId: { in: userIds } }, select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);

  await prisma.offer.deleteMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { partnerProfileId: { in: partnerProfileIds } }] },
  });
  await prisma.paymentTransaction.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.priceRevision.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.partnerProfile.deleteMany({ where: { id: { in: partnerProfileIds } } });
  await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
  // Notifications créées par NotificationService pendant le test (offre de
  // mission, offre perdue) référencent aussi ces utilisateurs.
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.pricingConfig.deleteMany({ where: { countryId: country.id } });
  await prisma.serviceCategory.deleteMany({ where: { countryId: country.id } });
  await prisma.zone.deleteMany({ where: { countryId: country.id } });
  await prisma.garmentType.deleteMany({ where: { code: 'TSHIRT_E2E' } });
  await prisma.country.delete({ where: { id: country.id } });
}

describe('E2E — acceptation concurrente d’une offre de mission (§17)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let clientToken: string;
  let partner1Token: string;
  let partner2Token: string;
  let partner1UserId: string;
  let partner2UserId: string;
  let addressId: string;
  let serviceCategoryId: string;
  let garmentTypeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await cleanupTestData(prisma);

    // ── Référentiel minimal (pays / zone / catalogue / tarification) ──────
    const country = await prisma.country.create({
      data: { isoCode: TEST_COUNTRY_ISO_CODE, name: 'Pays Test E2E', currency: 'XAF', defaultLanguage: 'fr', isActive: true },
    });
    const zone = await prisma.zone.create({
      data: {
        countryId: country.id,
        cityName: 'Ville Test',
        name: 'Zone Test',
        isActive: true,
        centerLat: 0,
        centerLng: 0,
        radiusMeters: 5000,
      },
    });
    const serviceCategory = await prisma.serviceCategory.create({
      data: { countryId: country.id, code: 'LAUNDRY_E2E', name: 'Laverie (test)', isActive: true },
    });
    serviceCategoryId = serviceCategory.id;

    const garment = await prisma.garmentType.create({
      data: { code: 'TSHIRT_E2E', name: 'T-shirt (test)', basePrice: 300 },
    });
    garmentTypeId = garment.id;

    await prisma.fabricCategory.upsert({
      where: { code: 'STANDARD' },
      update: {},
      create: { code: 'STANDARD', name: 'Standard', coefficient: 1.0 },
    });
    await prisma.washMethod.upsert({
      where: { code: 'STANDARD' },
      update: {},
      create: { code: 'STANDARD', name: 'Standard', coefficient: 1.0 },
    });
    await prisma.stainType.upsert({
      where: { code: 'NORMAL' },
      update: {},
      create: { code: 'NORMAL', name: 'Normal', surchargeType: 'PERCENT', surchargeValue: 0 },
    });

    await prisma.pricingConfig.create({
      data: {
        countryId: country.id,
        version: 1,
        effectiveFrom: new Date(),
        isActive: true,
        config: { feesTravel: 100, feesPlatform: 50, urgencySupplementPercent: 10, roundingIncrement: 5 },
      },
    });

    // ── Utilisateurs : 1 client, 2 partenaires actifs/disponibles dans la zone ──
    const passwordHash = await argon2.hash('Test1234!');

    const client = await prisma.user.create({
      data: {
        countryId: country.id,
        phone: '+000E2E0001',
        passwordHash,
        firstName: 'Client',
        lastName: 'Test',
        role: UserRole.CLIENT,
        phoneVerifiedAt: new Date(),
      },
    });
    const address = await prisma.address.create({
      data: { userId: client.id, zoneId: zone.id, landmark: 'Repère test', latitude: 0, longitude: 0 },
    });
    addressId = address.id;

    const partner1 = await prisma.user.create({
      data: {
        countryId: country.id,
        phone: '+000E2E0002',
        passwordHash,
        firstName: 'Partenaire',
        lastName: 'Un',
        role: UserRole.PARTNER,
        phoneVerifiedAt: new Date(),
      },
    });
    const partner2 = await prisma.user.create({
      data: {
        countryId: country.id,
        phone: '+000E2E0003',
        passwordHash,
        firstName: 'Partenaire',
        lastName: 'Deux',
        role: UserRole.PARTNER,
        phoneVerifiedAt: new Date(),
      },
    });
    partner1UserId = partner1.id;
    partner2UserId = partner2.id;

    await prisma.partnerProfile.create({
      data: { userId: partner1.id, status: PartnerStatus.ACTIVE, isAvailable: true, currentZoneId: zone.id },
    });
    await prisma.partnerProfile.create({
      data: { userId: partner2.id, status: PartnerStatus.ACTIVE, isAvailable: true, currentZoneId: zone.id },
    });

    // Tokens émis directement (même forme de payload que AuthService.issueTokens)
    // pour isoler ce test du flux OTP/login, déjà couvert ailleurs.
    const sign = (userId: string, role: string) => jwtService.signAsync({ sub: userId, role }, { expiresIn: '15m' });
    clientToken = await sign(client.id, UserRole.CLIENT);
    partner1Token = await sign(partner1.id, UserRole.PARTNER);
    partner2Token = await sign(partner2.id, UserRole.PARTNER);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  it('diffuse une offre aux deux partenaires disponibles puis, sur acceptation concurrente réelle, assigne la mission à un seul', async () => {
    const httpServer = app.getHttpServer();

    const bookingRes = await request(httpServer)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceCategoryId,
        addressId,
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        paymentProviderCode: 'cash',
        laundryItems: [{ garmentTypeId, quantity: 1 }],
      });

    expect(bookingRes.status).toBe(201);
    const bookingId = bookingRes.body.id;
    // Paiement cash -> SUCCESS immédiat -> recherche partenaire déjà lancée
    // et attendue avant que la réponse HTTP ne soit renvoyée (voir
    // BookingsService.createBooking).
    expect(bookingRes.body.status).toBe(BookingStatus.SEARCHING_PARTNER);

    const offers = await prisma.offer.findMany({
      where: { bookingId },
      include: { partnerProfile: true },
    });
    expect(offers).toHaveLength(2);

    const offer1 = offers.find((o) => o.partnerProfile.userId === partner1UserId)!;
    const offer2 = offers.find((o) => o.partnerProfile.userId === partner2UserId)!;
    expect(offer1).toBeDefined();
    expect(offer2).toBeDefined();

    // Les deux vrais appels HTTP concurrents — le cœur du test.
    const [res1, res2] = await Promise.all([
      request(httpServer).post(`/api/v1/offers/${offer1.id}/accept`).set('Authorization', `Bearer ${partner1Token}`),
      request(httpServer).post(`/api/v1/offers/${offer2.id}/accept`).set('Authorization', `Bearer ${partner2Token}`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Un seul des deux appels réussit (201), l'autre échoue avec un conflit (409) —
    // jamais les deux à 201, jamais les deux à 409.
    expect(statuses).toEqual([201, 409]);

    const winner = res1.status === 201 ? res1 : res2;
    expect(winner.body.bookingId).toBe(bookingId);

    const finalBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(finalBooking!.status).toBe(BookingStatus.PARTNER_ASSIGNED);
    expect(finalBooking!.assignedPartnerId).not.toBeNull();

    const finalOffers = await prisma.offer.findMany({ where: { bookingId } });
    const accepted = finalOffers.filter((o) => o.status === OfferStatus.ACCEPTED);
    const lost = finalOffers.filter((o) => o.status === OfferStatus.LOST);
    expect(accepted).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(finalBooking!.assignedPartnerId).toBe(
      offers.find((o) => o.id === accepted[0].id)!.partnerProfileId,
    );
  }, 15000);
});
