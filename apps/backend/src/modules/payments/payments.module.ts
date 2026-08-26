import { forwardRef, Module } from '@nestjs/common';
import { CashPaymentProvider } from './providers/cash.provider';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { MockOrangeMoneyProvider } from './providers/mock-orange-money.provider';
import { PaymentsService } from './payments.service';
import { PaymentReconciliationScheduler } from './payment-reconciliation.scheduler';
import { PAYMENT_PROVIDER_REGISTRY } from './payments.tokens';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  // BookingsModule importe déjà PaymentsModule (pour initier un paiement à
  // la création d'une commande) ; forwardRef casse le cycle pour permettre
  // au job de réconciliation de relancer markPaidAndStartSearch une fois un
  // paiement Mobile Money confirmé (voir payment-reconciliation.scheduler.ts).
  imports: [forwardRef(() => BookingsModule)],
  providers: [
    CashPaymentProvider,
    // Adaptateur MTN MoMo réel (compte sandbox développeur, §19) —
    // remplace MockMobileMoneyProvider maintenant que les identifiants
    // sont disponibles. Orange Money reste mocké (pas de compte fourni).
    MtnMomoProvider,
    MockOrangeMoneyProvider,
    PaymentsService,
    PaymentReconciliationScheduler,
    {
      provide: PAYMENT_PROVIDER_REGISTRY,
      useFactory: (
        cash: CashPaymentProvider,
        momo: MtnMomoProvider,
        om: MockOrangeMoneyProvider,
      ) => [cash, momo, om],
      inject: [CashPaymentProvider, MtnMomoProvider, MockOrangeMoneyProvider],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
