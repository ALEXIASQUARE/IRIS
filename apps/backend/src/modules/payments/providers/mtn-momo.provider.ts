import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, InitiatePaymentInput, PaymentResult } from './payment-provider.interface';

// Adaptateur réel MTN Mobile Money (Collections API), compte développeur
// sandbox (Cahier des charges §19). Repose sur les 3 identifiants fournis
// par le portail momodeveloper.mtn.com pour le produit "Collections" (pas
// "Collection Widget", qui est une API différente) : Subscription Key,
// API User, API Key — voir MTN_MOMO_* dans .env.
//
// Flux Collections : requestToPay renvoie 202 immédiatement (statut
// PENDING_CONFIRMATION) ; le résultat définitif s'obtient via
// GET .../requesttopay/{referenceId}, interrogé par checkStatus() —
// appelé par PaymentReconciliationScheduler (Addendum §5.4).
@Injectable()
export class MtnMomoProvider implements PaymentProvider {
  readonly code = 'mtn_momo';
  private readonly logger = new Logger('MtnMomoProvider');

  private readonly baseUrl: string;
  private readonly subscriptionKey: string;
  private readonly apiUser: string;
  private readonly apiKey: string;
  private readonly targetEnvironment: string;

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('MTN_MOMO_BASE_URL') ?? 'https://sandbox.momodeveloper.mtn.com';
    this.subscriptionKey = this.config.get<string>('MTN_MOMO_SUBSCRIPTION_KEY') ?? '';
    this.apiUser = this.config.get<string>('MTN_MOMO_API_USER') ?? '';
    this.apiKey = this.config.get<string>('MTN_MOMO_API_KEY') ?? '';
    this.targetEnvironment = this.config.get<string>('MTN_MOMO_TARGET_ENVIRONMENT') ?? 'sandbox';
  }

  private async getAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/collection/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });
    if (!res.ok) {
      throw new Error(`MTN MoMo : échec d'obtention du token (${res.status}).`);
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  // §5.5 : le numéro doit être au format MSISDN attendu par MTN (pas de "+").
  private normalizePhone(phone: string): string {
    return phone.replace(/^\+/, '');
  }

  async initiate(input: InitiatePaymentInput): Promise<PaymentResult> {
    const referenceId = randomUUID();

    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.targetEnvironment,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: String(input.amount),
          currency: input.currency,
          externalId: input.bookingId,
          payer: { partyIdType: 'MSISDN', partyId: this.normalizePhone(input.phone) },
          payerMessage: 'Paiement IRIS',
          payeeNote: `Commande ${input.bookingId}`,
        }),
      });

      if (res.status !== 202) {
        const text = await res.text().catch(() => '');
        this.logger.error(`Échec requestToPay MTN MoMo (${res.status}) : ${text}`);
        return { externalReference: referenceId, status: 'FAILED' };
      }

      return { externalReference: referenceId, status: 'PENDING_CONFIRMATION' };
    } catch (err) {
      this.logger.error('Échec initiation paiement MTN MoMo', err as Error);
      return { externalReference: referenceId, status: 'FAILED' };
    }
  }

  async checkStatus(externalReference: string): Promise<PaymentResult['status']> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay/${externalReference}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'X-Target-Environment': this.targetEnvironment,
        },
      });
      if (!res.ok) return 'PENDING_CONFIRMATION';

      const data = (await res.json()) as { status: string };
      if (data.status === 'SUCCESSFUL') return 'SUCCESS';
      if (data.status === 'FAILED') return 'FAILED';
      return 'PENDING_CONFIRMATION';
    } catch (err) {
      this.logger.error('Échec vérification statut MTN MoMo', err as Error);
      return 'PENDING_CONFIRMATION';
    }
  }
}
