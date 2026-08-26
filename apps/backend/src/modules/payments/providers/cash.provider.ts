import { Injectable } from '@nestjs/common';
import { PaymentProvider, InitiatePaymentInput, PaymentResult } from './payment-provider.interface';

// Espèces autorisées : une transaction est tout de même créée et tracée
// dans le système, conformément au Cahier des charges. Le statut passe
// directement à SUCCESS car il n'y a pas de confirmation externe à
// attendre ; la validation réelle de l'encaissement reste une procédure
// opérationnelle (par exemple confirmation partenaire à la clôture de mission).
@Injectable()
export class CashPaymentProvider implements PaymentProvider {
  readonly code = 'cash';

  async initiate(input: InitiatePaymentInput): Promise<PaymentResult> {
    return { externalReference: `CASH-${input.bookingId}`, status: 'SUCCESS' };
  }

  async checkStatus(): Promise<PaymentResult['status']> {
    return 'SUCCESS';
  }
}
