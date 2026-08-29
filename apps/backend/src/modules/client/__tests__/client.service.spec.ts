import { BadRequestException } from '@nestjs/common';
import { ClientService } from '../client.service';

// Pendant de PartnersService.upsertProfile côté client (ville/quartier par
// défaut) — voir le retour utilisateur : "comme le partenaire, le client
// peut changer de ville ou de quartier".
function buildPrisma(overrides: Partial<Record<string, any>> = {}) {
  return {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ homeZoneId: 'zone-1', phone: '+237600000001' }),
      update: jest.fn().mockResolvedValue({ homeZoneId: 'zone-2' }),
      ...overrides.user,
    },
    zone: {
      findUnique: jest.fn().mockResolvedValue({ id: 'zone-2', isActive: true }),
      ...overrides.zone,
    },
  };
}

describe('ClientService', () => {
  it('getProfile renvoie la zone par défaut du client', async () => {
    const prisma = buildPrisma();
    const service = new ClientService(prisma as any);

    const result = await service.getProfile('user-1');

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { homeZoneId: true, phone: true },
    });
    expect(result).toEqual({ homeZoneId: 'zone-1', phone: '+237600000001' });
  });

  it('updateHomeZone met à jour la zone quand elle est valide', async () => {
    const prisma = buildPrisma();
    const service = new ClientService(prisma as any);

    const result = await service.updateHomeZone('user-1', 'zone-2');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { homeZoneId: 'zone-2' },
      select: { homeZoneId: true },
    });
    expect(result).toEqual({ homeZoneId: 'zone-2' });
  });

  it('lève BadRequestException si la zone est introuvable ou inactive', async () => {
    const prisma = buildPrisma({ zone: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new ClientService(prisma as any);

    await expect(service.updateHomeZone('user-1', 'zone-2')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
