import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, InitiatePaymentInput, PaymentResult } from './payment-provider.interface';

// Second adaptateur Mobile Money -- meme comportement mock que MTN pour le
// MVP, code distinct pour que l'administration puisse activer/desactiver
// chaque provider independamment par pays (CountryPaymentProvider).
@Injectable()
export class MockOrangeMoneyProvider implements PaymentProvider {
  readonly code = 'orange_money';
  private readonly logger = new Logger('MockOrangeMoneyProvider');

  async initiate(input: InitiatePaymentInput): Promise<PaymentResult> {
    this.logger.log(`[MOCK] Paiement Orange Money initie : ${input.amount} ${input.currency} (${input.phone})`);
    return { externalReference: `OM-MOCK-${Date.now()}`, status: 'PENDING_CONFIRMATION' };
  }

  async checkStatus(): Promise<PaymentResult['status']> {
    return 'SUCCESS';
  }
}
