import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';
import { BookingsService } from '../bookings/bookings.service';

// Addendum technique v1.1 §5.4 : les webhooks MTN/Orange peuvent se perdre.
// Ce job revérifie périodiquement le statut des transactions restées
// PENDING_CONFIRMATION au-delà d'un seuil raisonnable.
//
// Correctif : reconcilePendingTransactions() ne faisait que mettre à jour
// PaymentTransaction.status — la commande elle-même restait bloquée à
// PENDING_PAYMENT indéfiniment même une fois le paiement confirmé, faute
// d'appel à BookingsService. C'est ce scheduler (pas PaymentsService
// lui-même, pour éviter un couplage direct paiements -> commandes) qui
// referme la boucle : succès -> PAID, échec -> retour à ARRIVED pour que
// le partenaire puisse retenter, et purge des paiements restés bloqués trop
// longtemps (paiement à l'arrivée — voir bookings.service.ts).
@Injectable()
export class PaymentReconciliationScheduler {
  private readonly logger = new Logger('PaymentReconciliationScheduler');

  constructor(
    private paymentsService: PaymentsService,
    @Inject(forwardRef(() => BookingsService)) private bookingsService: BookingsService,
  ) {}

  // Toutes les 10s (et non 1 min) : le partenaire et le client attendent
  // activement la confirmation à l'écran une fois le paiement demandé — un
  // délai d'une minute avant d'afficher "Paiement effectué" se ressent
  // comme un bug plutôt qu'une latence normale.
  @Interval(10_000)
  async handleReconciliation() {
    try {
      const { succeeded, failed } = await this.paymentsService.reconcilePendingTransactions();
      for (const bookingId of succeeded) {
        try {
          await this.bookingsService.confirmArrivalPaymentSuccess(bookingId);
        } catch (err) {
          this.logger.error(`Échec de la confirmation de paiement pour ${bookingId}`, err as Error);
        }
      }
      for (const bookingId of failed) {
        try {
          await this.bookingsService.revertFailedArrivalPayment(bookingId);
        } catch (err) {
          this.logger.error(`Échec du retour à ARRIVED après paiement refusé pour ${bookingId}`, err as Error);
        }
      }
      await this.bookingsService.cancelStalePendingPayments();
    } catch (err) {
      this.logger.error('Échec de la réconciliation des paiements', err as Error);
    }
  }
}
