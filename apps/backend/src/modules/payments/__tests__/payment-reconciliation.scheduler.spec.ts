import { PaymentReconciliationScheduler } from '../payment-reconciliation.scheduler';

// Couvre le bug corrigé : reconcilePendingTransactions() ne faisait que
// mettre à jour PaymentTransaction.status, sans jamais refermer la boucle
// côté commande. Paiement à l'arrivée : succès -> PAID, échec -> retour à
// ARRIVED (le partenaire peut retenter), et purge des paiements restés
// bloqués trop longtemps.

function buildBookings(overrides: Partial<Record<string, any>> = {}) {
  return {
    confirmArrivalPaymentSuccess: jest.fn().mockResolvedValue(undefined),
    revertFailedArrivalPayment: jest.fn().mockResolvedValue(undefined),
    cancelStalePendingPayments: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PaymentReconciliationScheduler', () => {
  it('confirme le paiement (PAID) pour chaque commande nouvellement réussie', async () => {
    const payments = {
      reconcilePendingTransactions: jest.fn().mockResolvedValue({ succeeded: ['booking-1', 'booking-2'], failed: [] }),
    };
    const bookings = buildBookings();
    const scheduler = new PaymentReconciliationScheduler(payments as any, bookings as any);

    await scheduler.handleReconciliation();

    expect(bookings.confirmArrivalPaymentSuccess).toHaveBeenCalledWith('booking-1');
    expect(bookings.confirmArrivalPaymentSuccess).toHaveBeenCalledWith('booking-2');
    expect(bookings.confirmArrivalPaymentSuccess).toHaveBeenCalledTimes(2);
  });

  it('repasse à ARRIVED (pour retenter) chaque commande dont le paiement a échoué', async () => {
    const payments = {
      reconcilePendingTransactions: jest.fn().mockResolvedValue({ succeeded: [], failed: ['booking-3'] }),
    };
    const bookings = buildBookings();
    const scheduler = new PaymentReconciliationScheduler(payments as any, bookings as any);

    await scheduler.handleReconciliation();

    expect(bookings.revertFailedArrivalPayment).toHaveBeenCalledWith('booking-3');
  });

  it('appelle systématiquement cancelStalePendingPayments, même sans succès ni échec', async () => {
    const payments = {
      reconcilePendingTransactions: jest.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    };
    const bookings = buildBookings();
    const scheduler = new PaymentReconciliationScheduler(payments as any, bookings as any);

    await scheduler.handleReconciliation();

    expect(bookings.confirmArrivalPaymentSuccess).not.toHaveBeenCalled();
    expect(bookings.revertFailedArrivalPayment).not.toHaveBeenCalled();
    expect(bookings.cancelStalePendingPayments).toHaveBeenCalledTimes(1);
  });

  it("continue de traiter les autres commandes si l'une d'elles échoue", async () => {
    const payments = {
      reconcilePendingTransactions: jest.fn().mockResolvedValue({ succeeded: ['booking-1', 'booking-2'], failed: [] }),
    };
    const bookings = buildBookings({
      confirmArrivalPaymentSuccess: jest
        .fn()
        .mockRejectedValueOnce(new Error('échec inattendu'))
        .mockResolvedValueOnce(undefined),
    });
    const scheduler = new PaymentReconciliationScheduler(payments as any, bookings as any);

    await expect(scheduler.handleReconciliation()).resolves.not.toThrow();
    expect(bookings.confirmArrivalPaymentSuccess).toHaveBeenCalledTimes(2);
  });
});
