import { MissionsService } from '../missions.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, OfferStatus } from '@prisma/client';

// Test central du module missions : garantit l'exigence du Cahier des
// charges §17 — "deux partenaires ne doivent pas accepter simultanément
// la même mission" — et valide le mécanisme décrit en Addendum §2.2.
//
// La garantie repose sur booking.updateMany({ where: { status: SEARCHING_PARTNER } }) :
// on simule ici son comportement (count=0 la deuxième fois) sans base de
// données réelle, pour tester la logique applicative en isolation.

describe('MissionsService — acceptOffer (verrou optimiste)', () => {
  function buildPrismaMock(bookingAlreadyAssigned: boolean) {
    return {
      offer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'offer-1',
          bookingId: 'booking-1',
          partnerProfileId: 'partner-1',
          status: OfferStatus.SENT,
          expiresAt: new Date(Date.now() + 60_000),
          partnerProfile: { userId: 'user-partner-1' },
          booking: { id: 'booking-1' },
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        // Simule exactement la garantie testée : la deuxième tentative
        // concurrente ne trouve plus de ligne au statut SEARCHING_PARTNER.
        updateMany: jest.fn().mockResolvedValue({ count: bookingAlreadyAssigned ? 0 : 1 }),
      },
      partnerProfile: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
  }

  it("attribue la mission au partenaire quand la ligne est encore SEARCHING_PARTNER", async () => {
    const prisma = buildPrismaMock(false);
    const notifications = { sendOfferLost: jest.fn() };
    const service = new MissionsService(prisma as any, notifications as any);

    const result = await service.acceptOffer('offer-1', 'user-partner-1');

    expect(result.bookingId).toBe('booking-1');
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.SEARCHING_PARTNER },
      data: { status: BookingStatus.PARTNER_ASSIGNED, assignedPartnerId: 'partner-1' },
    });
  });

  it('rend le partenaire indisponible dès qu\'il accepte une mission', async () => {
    const prisma = buildPrismaMock(false);
    const notifications = { sendOfferLost: jest.fn() };
    const service = new MissionsService(prisma as any, notifications as any);

    await service.acceptOffer('offer-1', 'user-partner-1');

    expect(prisma.partnerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: { isAvailable: false },
    });
  });

  it("rejette l'acceptation si la mission a déjà été assignée entre-temps (course concurrente)", async () => {
    const prisma = buildPrismaMock(true); // updateMany retourne count=0
    const notifications = { sendOfferLost: jest.fn() };
    const service = new MissionsService(prisma as any, notifications as any);

    await expect(service.acceptOffer('offer-1', 'user-partner-1')).rejects.toThrow(
      ConflictException,
    );

    // L'offre perdante doit être explicitement marquée LOST, pas laissée SENT.
    expect(prisma.offer.update).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
      data: { status: OfferStatus.LOST, respondedAt: expect.any(Date) },
    });
  });

  it("refuse l'acceptation d'une offre par un partenaire qui n'en est pas le destinataire", async () => {
    const prisma = buildPrismaMock(false);
    const notifications = { sendOfferLost: jest.fn() };
    const service = new MissionsService(prisma as any, notifications as any);

    await expect(service.acceptOffer('offer-1', 'un-autre-utilisateur')).rejects.toThrow();
  });
});

// Note d'implémentation pour la suite (Cahier des charges §17) :
// - Un test d'intégration séparé doit exercer deux appels HTTP concurrents
//   réels contre une base MariaDB de test pour valider que la contrainte
//   tient aussi au niveau du moteur de base de données, pas seulement dans
//   la logique applicative simulée ici.
// - Ajouter un test sur l'expiration d'offre et la relance du cycle de
//   diffusion (searchAndBroadcastPartner avec expansionCycle > 0).

// Correctif : une commande créée alors qu'aucun partenaire n'était encore
// disponible dans la zone restait bloquée en SEARCHING_PARTNER pour
// toujours — searchAndBroadcastPartner abandonne silencieusement après
// quelques cycles sans jamais se relancer de lui-même. retryStuckBookings
// est le filet de rattrapage (appelé par le job planifié et par
// PartnersService dès qu'un partenaire se rend disponible).
// Décision produit : un partenaire doit être notifié dès qu'une commande
// apparaît n'importe où dans SA VILLE, pas seulement dans son quartier
// exact — auparavant, un partenaire déclaré dans un quartier voisin de
// celui de la commande ne recevait jamais l'offre.
describe('MissionsService — searchAndBroadcastPartner (diffusion à l’échelle de la ville)', () => {
  it('interroge les partenaires de tous les quartiers de la même ville, pas seulement le quartier exact de la commande', async () => {
    const partnerFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      booking: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'booking-1', status: BookingStatus.SEARCHING_PARTNER, zoneId: 'zone-A' }),
      },
      zone: {
        findUnique: jest.fn().mockResolvedValue({ id: 'zone-A', countryId: 'country-1', cityName: 'Douala' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'zone-A' }, { id: 'zone-B' }, { id: 'zone-C' }]),
      },
      partnerProfile: { findMany: partnerFindMany },
    };
    const service = new MissionsService(prisma as any, {} as any);

    await service.searchAndBroadcastPartner('booking-1');

    expect(prisma.zone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: 'country-1', cityName: 'Douala' } }),
    );
    expect(partnerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currentZoneId: { in: ['zone-A', 'zone-B', 'zone-C'] } }),
      }),
    );
  });
});

describe('MissionsService — retryStuckBookings', () => {
  it('relance searchAndBroadcastPartner pour chaque commande bloquée sans offre en cours', async () => {
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([{ id: 'booking-1' }, { id: 'booking-2' }]),
      },
    };
    const service = new MissionsService(prisma as any, {} as any);
    const spy = jest.spyOn(service, 'searchAndBroadcastPartner').mockResolvedValue(undefined);

    await service.retryStuckBookings();

    expect(spy).toHaveBeenCalledWith('booking-1');
    expect(spy).toHaveBeenCalledWith('booking-2');
  });

  it('restreint la recherche à toute la ville (pas seulement le quartier exact) quand un zoneId est fourni', async () => {
    const bookingFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      zone: {
        findUnique: jest.fn().mockResolvedValue({ id: 'zone-1', countryId: 'country-1', cityName: 'Douala' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'zone-1' }, { id: 'zone-2' }]),
      },
      booking: { findMany: bookingFindMany },
    };
    const service = new MissionsService(prisma as any, {} as any);
    jest.spyOn(service, 'searchAndBroadcastPartner').mockResolvedValue(undefined);

    await service.retryStuckBookings('zone-1');

    expect(prisma.zone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: 'country-1', cityName: 'Douala' } }),
    );
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ zoneId: { in: ['zone-1', 'zone-2'] } }) }),
    );
  });

  it("ne relance rien s'il n'y a aucune commande bloquée", async () => {
    const service = new MissionsService({ booking: { findMany: jest.fn().mockResolvedValue([]) } } as any, {} as any);
    const spy = jest.spyOn(service, 'searchAndBroadcastPartner').mockResolvedValue(undefined);

    await service.retryStuckBookings();

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('MissionsService — expireStaleOffersAndRetry (filet de sécurité)', () => {
  it('appelle retryStuckBookings même en l’absence de toute offre expirée', async () => {
    const service = new MissionsService(
      { offer: { findMany: jest.fn().mockResolvedValue([]) } } as any,
      {} as any,
    );
    const spy = jest.spyOn(service, 'retryStuckBookings').mockResolvedValue(undefined);

    await service.expireStaleOffersAndRetry();

    expect(spy).toHaveBeenCalledWith();
  });
});

// Paiement à l'arrivée : le PIN ne suffit plus, le paiement doit être
// confirmé (statut PAID) avant que la mission ne puisse démarrer.
describe('MissionsService — startMission (gate paiement à l\'arrivée)', () => {
  function buildPrisma(bookingOverrides: Partial<Record<string, any>> = {}) {
    return {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PAID,
          missionPin: '1234',
          missionPinExpiresAt: new Date(Date.now() + 60_000),
          assignedPartner: { userId: 'partner-user-1' },
          ...bookingOverrides,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it('démarre la mission quand le statut est PAID et le PIN correct', async () => {
    const prisma = buildPrisma();
    const service = new MissionsService(prisma as any, {} as any);

    await service.startMission('booking-1', '1234', 'partner-user-1');

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.IN_PROGRESS }) }),
    );
  });

  it('refuse de démarrer tant que le paiement n\'est pas confirmé (statut ARRIVED)', async () => {
    const prisma = buildPrisma({ status: BookingStatus.ARRIVED });
    const service = new MissionsService(prisma as any, {} as any);

    await expect(service.startMission('booking-1', '1234', 'partner-user-1')).rejects.toThrow(ConflictException);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('refuse de démarrer tant que le paiement est en cours de traitement (statut PENDING_PAYMENT)', async () => {
    const prisma = buildPrisma({ status: BookingStatus.PENDING_PAYMENT });
    const service = new MissionsService(prisma as any, {} as any);

    await expect(service.startMission('booking-1', '1234', 'partner-user-1')).rejects.toThrow(ConflictException);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});

// Décision produit : un partenaire ne doit plus recevoir de nouvelles
// offres tant qu'une mission en cours ne s'est pas terminée — voir
// acceptOffer (isAvailable: false) et BookingsService.cancelBooking (qui le
// libère si la commande est annulée après assignation).
describe('MissionsService — completeMission (libération du partenaire)', () => {
  it('rend le partenaire de nouveau disponible une fois la mission terminée', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.IN_PROGRESS,
          assignedPartnerId: 'partner-1',
          assignedPartner: { userId: 'partner-user-1' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      partnerProfile: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const service = new MissionsService(prisma as any, {} as any);

    await service.completeMission('booking-1', 'partner-user-1');

    expect(prisma.partnerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: { isAvailable: true },
    });
  });
});

// Retour utilisateur explicite : si le partenaire abandonne en chemin
// avant paiement, la mission doit redevenir disponible pour les autres
// partenaires (SEARCHING_PARTNER) — jamais être annulée. Seule l'absence
// de paiement du client passé les 30 minutes prescrites
// (BookingsService.cancelForNonPayment) doit annuler la réservation.
describe('MissionsService — abandonMission (remise en recherche, jamais annulation)', () => {
  function buildPrisma(status: BookingStatus) {
    return {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status,
          assignedPartnerId: 'partner-1',
          assignedPartner: { userId: 'partner-user-1' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      offer: { create: jest.fn().mockResolvedValue({ id: 'offer-x' }), findMany: jest.fn().mockResolvedValue([]) },
      zone: { findUnique: jest.fn().mockResolvedValue(null) },
      partnerProfile: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
  }

  it.each([
    BookingStatus.PARTNER_ASSIGNED,
    BookingStatus.PARTNER_EN_ROUTE,
    BookingStatus.ARRIVED,
    BookingStatus.PENDING_PAYMENT,
  ])('remet la mission en SEARCHING_PARTNER et libère le partenaire depuis %s', async (status) => {
    const prisma = buildPrisma(status);
    const service = new MissionsService(prisma as any, {} as any);
    jest.spyOn(service, 'searchAndBroadcastPartner').mockResolvedValue(undefined);

    await service.abandonMission('booking-1', 'partner-user-1');

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        status: BookingStatus.SEARCHING_PARTNER,
        assignedPartnerId: null,
        arrivedAt: null,
        missionPin: null,
        missionPinExpiresAt: null,
      },
    });
    expect(prisma.partnerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: { isAvailable: true },
    });
  });

  it('relance immédiatement la diffusion après un abandon', async () => {
    const prisma = buildPrisma(BookingStatus.PARTNER_EN_ROUTE);
    const service = new MissionsService(prisma as any, {} as any);
    const spy = jest.spyOn(service, 'searchAndBroadcastPartner').mockResolvedValue(undefined);

    await service.abandonMission('booking-1', 'partner-user-1');

    expect(spy).toHaveBeenCalledWith('booking-1');
  });

  it('refuse si le partenaire ne correspond pas à celui assigné', async () => {
    const prisma = buildPrisma(BookingStatus.PARTNER_EN_ROUTE);
    const service = new MissionsService(prisma as any, {} as any);

    await expect(service.abandonMission('booking-1', 'un-autre-partenaire')).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([BookingStatus.PAID, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.SEARCHING_PARTNER])(
    "refuse l'abandon une fois passé le statut %s",
    async (status) => {
      const prisma = buildPrisma(status);
      const service = new MissionsService(prisma as any, {} as any);

      await expect(service.abandonMission('booking-1', 'partner-user-1')).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
