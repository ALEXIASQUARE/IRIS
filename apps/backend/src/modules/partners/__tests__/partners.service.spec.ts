import { NotFoundException } from '@nestjs/common';
import { PartnerStatus } from '@prisma/client';
import { PartnersService } from '../partners.service';

// Couvre le déclenchement immédiat de retryStuckBookings quand un
// partenaire se rend disponible — voir la note dans missions.service.ts /
// retryStuckBookings pour le contexte du bug corrigé.

function buildProfile(overrides: Partial<Record<string, any>> = {}) {
  return { status: PartnerStatus.ACTIVE, currentZoneId: 'zone-1', isAvailable: false, ...overrides };
}

describe('PartnersService — setAvailability', () => {
  it('relance les commandes bloquées de la zone quand le partenaire devient disponible et actif', async () => {
    const profile = buildProfile();
    const prisma = {
      partnerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockResolvedValue({ ...profile, isAvailable: true }),
      },
    };
    const missions = { retryStuckBookings: jest.fn().mockResolvedValue(undefined) };
    const service = new PartnersService(prisma as any, missions as any);

    await service.setAvailability({ isAvailable: true } as any, 'user-1');

    expect(missions.retryStuckBookings).toHaveBeenCalledWith('zone-1');
  });

  it('ne relance rien quand le partenaire se rend indisponible', async () => {
    const profile = buildProfile({ isAvailable: true });
    const prisma = {
      partnerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockResolvedValue({ ...profile, isAvailable: false }),
      },
    };
    const missions = { retryStuckBookings: jest.fn() };
    const service = new PartnersService(prisma as any, missions as any);

    await service.setAvailability({ isAvailable: false } as any, 'user-1');

    expect(missions.retryStuckBookings).not.toHaveBeenCalled();
  });

  it("ne relance rien tant que le profil n'est pas ACTIVE (ex: PENDING_REVIEW)", async () => {
    const profile = buildProfile({ status: PartnerStatus.PENDING_REVIEW });
    const prisma = {
      partnerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockResolvedValue({ ...profile, isAvailable: true }),
      },
    };
    const missions = { retryStuckBookings: jest.fn() };
    const service = new PartnersService(prisma as any, missions as any);

    await service.setAvailability({ isAvailable: true } as any, 'user-1');

    expect(missions.retryStuckBookings).not.toHaveBeenCalled();
  });

  it("ne relance rien si le partenaire n'a pas encore de zone déclarée", async () => {
    const profile = buildProfile({ currentZoneId: null });
    const prisma = {
      partnerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockResolvedValue({ ...profile, isAvailable: true }),
      },
    };
    const missions = { retryStuckBookings: jest.fn() };
    const service = new PartnersService(prisma as any, missions as any);

    await service.setAvailability({ isAvailable: true } as any, 'user-1');

    expect(missions.retryStuckBookings).not.toHaveBeenCalled();
  });

  it('lève NotFoundException si le profil est introuvable', async () => {
    const prisma = { partnerProfile: { findUnique: jest.fn().mockResolvedValue(null) } };
    const missions = { retryStuckBookings: jest.fn() };
    const service = new PartnersService(prisma as any, missions as any);

    await expect(service.setAvailability({ isAvailable: true } as any, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("n'interrompt pas la requête si la relance échoue", async () => {
    const profile = buildProfile();
    const prisma = {
      partnerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockResolvedValue({ ...profile, isAvailable: true }),
      },
    };
    const missions = { retryStuckBookings: jest.fn().mockRejectedValue(new Error('boom')) };
    const service = new PartnersService(prisma as any, missions as any);

    await expect(service.setAvailability({ isAvailable: true } as any, 'user-1')).resolves.toBeDefined();
  });
});

// Position GPS temps réel — pour la navigation (trajet vers le client),
// distincte du matching qui reste basé sur currentZoneId.
describe('PartnersService — updateLocation', () => {
  it('enregistre la position GPS envoyée par le partenaire', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { partnerProfile: { updateMany } };
    const service = new PartnersService(prisma as any, {} as any);

    await service.updateLocation({ latitude: 4.05, longitude: 9.7 } as any, 'user-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { currentLat: 4.05, currentLng: 9.7, locationUpdatedAt: expect.any(Date) },
    });
  });

  it('lève NotFoundException si le profil est introuvable', async () => {
    const prisma = { partnerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new PartnersService(prisma as any, {} as any);

    await expect(
      service.updateLocation({ latitude: 4.05, longitude: 9.7 } as any, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
