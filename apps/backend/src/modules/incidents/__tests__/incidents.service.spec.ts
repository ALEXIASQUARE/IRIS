import { BadRequestException } from '@nestjs/common';
import { IncidentsService, PAYMENT_NOT_MADE_INCIDENT_TYPE } from '../incidents.service';

// Décision produit : signaler un non-paiement (type dédié) annule
// automatiquement la mission et libère le partenaire — voir
// BookingsService.cancelForNonPayment pour le délai de carence de 30 min.
// La validation doit avoir lieu AVANT toute création d'incident.

describe('IncidentsService — report', () => {
  it('crée un incident classique sans toucher aux commandes', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'incident-1' });
    const prisma = { incident: { create } };
    const bookings = { cancelForNonPayment: jest.fn() };
    const service = new IncidentsService(prisma as any, bookings as any);

    await service.report(
      { type: 'RETARD', description: 'En retard de 20 min', bookingId: 'booking-1' } as any,
      'user-1',
    );

    expect(bookings.cancelForNonPayment).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });

  it('valide et annule la commande AVANT de créer l\'incident de non-paiement', async () => {
    const calls: string[] = [];
    const create = jest.fn().mockImplementation(async () => {
      calls.push('create');
      return { id: 'incident-1' };
    });
    const prisma = { incident: { create } };
    const bookings = {
      cancelForNonPayment: jest.fn().mockImplementation(async () => {
        calls.push('cancel');
      }),
    };
    const service = new IncidentsService(prisma as any, bookings as any);

    await service.report(
      { type: PAYMENT_NOT_MADE_INCIDENT_TYPE, description: 'Client injoignable', bookingId: 'booking-1' } as any,
      'partner-user-1',
    );

    expect(bookings.cancelForNonPayment).toHaveBeenCalledWith('booking-1', 'partner-user-1');
    expect(calls).toEqual(['cancel', 'create']);
  });

  it('refuse un incident de non-paiement sans bookingId, sans rien créer', async () => {
    const create = jest.fn();
    const prisma = { incident: { create } };
    const bookings = { cancelForNonPayment: jest.fn() };
    const service = new IncidentsService(prisma as any, bookings as any);

    await expect(
      service.report({ type: PAYMENT_NOT_MADE_INCIDENT_TYPE, description: 'x' } as any, 'partner-user-1'),
    ).rejects.toThrow(BadRequestException);
    expect(bookings.cancelForNonPayment).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("ne crée pas l'incident si la validation (ex: délai de carence) échoue", async () => {
    const create = jest.fn();
    const prisma = { incident: { create } };
    const bookings = {
      cancelForNonPayment: jest.fn().mockRejectedValue(new Error('trop tôt')),
    };
    const service = new IncidentsService(prisma as any, bookings as any);

    await expect(
      service.report(
        { type: PAYMENT_NOT_MADE_INCIDENT_TYPE, description: 'x', bookingId: 'booking-1' } as any,
        'partner-user-1',
      ),
    ).rejects.toThrow('trop tôt');
    expect(create).not.toHaveBeenCalled();
  });
});
