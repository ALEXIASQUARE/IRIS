import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminService } from '../admin.service';

// Pendant de listPartners côté client — voir le retour utilisateur : "peux
// tu ajouter la liste des clients en admin ?".

function buildDeps(overrides: Partial<Record<string, any>> = {}) {
  const prisma: any = {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'client-1', role: UserRole.CLIENT }),
      update: jest.fn().mockResolvedValue({ id: 'client-1', isBlocked: true }),
      ...overrides.user,
    },
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      ...overrides.booking,
    },
  };
  const audit = { log: jest.fn() };
  return { prisma, audit };
}

// Répond au retour utilisateur : "permet qu'on puisse voir toutes les
// réservations d'un client en cliquant sur lui" (liste Clients, Testeur).
describe('AdminService — listBookings (filtre par client)', () => {
  it('filtre par clientId quand fourni', async () => {
    const { prisma, audit } = buildDeps();
    const service = new AdminService(prisma, audit as any);

    await service.listBookings({ clientId: 'client-1' });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'client-1' } }),
    );
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
  });

  it('combine clientId et status quand les deux sont fournis', async () => {
    const { prisma, audit } = buildDeps();
    const service = new AdminService(prisma, audit as any);

    await service.listBookings({ clientId: 'client-1', status: 'SEARCHING_PARTNER' as any });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'SEARCHING_PARTNER', clientId: 'client-1' } }),
    );
  });

  it('ne filtre pas quand ni clientId ni status ne sont fournis', async () => {
    const { prisma, audit } = buildDeps();
    const service = new AdminService(prisma, audit as any);

    await service.listBookings({});

    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });
});

describe('AdminService — clients', () => {
  it('listClients ne remonte que les comptes CLIENT', async () => {
    const { prisma, audit } = buildDeps();
    const service = new AdminService(prisma, audit as any);

    await service.listClients();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: UserRole.CLIENT } }),
    );
  });

  it('blockClient bloque le compte et journalise l\'action', async () => {
    const { prisma, audit } = buildDeps();
    const service = new AdminService(prisma, audit as any);

    await service.blockClient('client-1', 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'client-1' }, data: { isBlocked: true } });
    expect(audit.log).toHaveBeenCalledWith('admin-1', 'CLIENT_BLOCKED', 'User', 'client-1');
  });

  it('unblockClient débloque le compte', async () => {
    const { prisma, audit } = buildDeps({
      user: { update: jest.fn().mockResolvedValue({ id: 'client-1', isBlocked: false }) },
    });
    const service = new AdminService(prisma, audit as any);

    await service.unblockClient('client-1', 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'client-1' }, data: { isBlocked: false } });
    expect(audit.log).toHaveBeenCalledWith('admin-1', 'CLIENT_UNBLOCKED', 'User', 'client-1');
  });

  it('lève NotFoundException si le compte est introuvable', async () => {
    const { prisma, audit } = buildDeps({ user: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new AdminService(prisma, audit as any);

    await expect(service.blockClient('client-1', 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('lève NotFoundException si le compte ciblé est un partenaire, pas un client', async () => {
    const { prisma, audit } = buildDeps({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'p-1', role: UserRole.PARTNER }) },
    });
    const service = new AdminService(prisma, audit as any);

    await expect(service.blockClient('p-1', 'admin-1')).rejects.toThrow(NotFoundException);
  });
});
