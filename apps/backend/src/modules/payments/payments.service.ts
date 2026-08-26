import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { PAYMENT_PROVIDER_REGISTRY } from './payments.tokens';

// ─────────────────────────────────────────────────────────────────────────
// PaymentsService — orchestration au-dessus des adaptateurs PaymentProvider.
// Le domaine métier ne connaît que cette classe, jamais un provider
// concret : §5.5 du Cahier des charges ("jamais couplés directement au
// domaine").
// ─────────────────────────────────────────────────────────────────────────

const PROVIDER_STATUS_MAP: Record<string, PaymentStatus> = {
  PENDING: PaymentStatus.PENDING,
  PENDING_CONFIRMATION: PaymentStatus.PENDING_CONFIRMATION,
  SUCCESS: PaymentStatus.SUCCESS,
  FAILED: PaymentStatus.FAILED,
};

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_REGISTRY) private providers: PaymentProvider[],
  ) {}

  private resolveProvider(code: string): PaymentProvider {
    const provider = this.providers.find((p) => p.code === code);
    if (!provider) {
      throw new BadRequestException(`Moyen de paiement non pris en charge : ${code}`);
    }
    return provider;
  }

  // §5.5 : "un paiement en espèces autorisé doit tout de même générer une
  // transaction dans le système" — cette méthode est le point de passage
  // unique, quel que soit le provider, garantissant que cette règle est
  // respectée par construction (pas de contournement possible côté appelant).
  async initiatePayment(params: {
    bookingId: string;
    providerCode: string;
    amount: number;
    currency: string;
    phone: string;
    platformCommission: number;
    partnerPayout: number;
  }) {
    const provider = this.resolveProvider(params.providerCode);

    const result = await provider.initiate({
      bookingId: params.bookingId,
      amount: params.amount,
      currency: params.currency,
      phone: params.phone,
    });

    // upsert plutôt que create : une commande n'a qu'une seule transaction
    // "courante" (contrainte bookingId unique) — un nouvel appel (retenter
    // après échec, cf. BookingsService.requestArrivalPayment) doit pouvoir
    // réinitialiser la transaction existante plutôt que d'échouer sur la
    // contrainte d'unicité.
    const data = {
      provider: params.providerCode,
      status: PROVIDER_STATUS_MAP[result.status],
      amount: params.amount,
      currency: params.currency,
      platformCommission: params.platformCommission,
      partnerPayout: params.partnerPayout,
      externalReference: result.externalReference,
      isCash: params.providerCode === 'cash',
    };

    const transaction = await this.prisma.paymentTransaction.upsert({
      where: { bookingId: params.bookingId },
      create: { bookingId: params.bookingId, ...data },
      update: data,
    });

    return transaction;
  }

  // Utilisé par le job de réconciliation (Addendum §5.4) : les webhooks
  // MTN/Orange peuvent se perdre, donc on revérifie périodiquement le statut
  // des transactions restées PENDING_CONFIRMATION au-delà d'un seuil.
  // Renvoie les bookingId dont le paiement vient de passer à SUCCESS, pour
  // que l'appelant relance la commande (voir PaymentReconciliationScheduler
  // — cette méthode ne connaît volontairement pas BookingsService, §5.5 :
  // le domaine métier ne doit jamais dépendre d'un provider concret, et
  // inversement les providers/paiements ne pilotent pas directement les
  // commandes).
  async reconcilePendingTransactions(): Promise<{ succeeded: string[]; failed: string[] }> {
    const pending = await this.prisma.paymentTransaction.findMany({
      where: { status: PaymentStatus.PENDING_CONFIRMATION },
    });

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const tx of pending) {
      const provider = this.resolveProvider(tx.provider);
      const status = await provider.checkStatus(tx.externalReference ?? '');
      const mapped = PROVIDER_STATUS_MAP[status];
      if (mapped && mapped !== tx.status) {
        await this.prisma.paymentTransaction.update({
          where: { id: tx.id },
          data: { status: mapped },
        });
        if (mapped === PaymentStatus.SUCCESS) succeeded.push(tx.bookingId);
        if (mapped === PaymentStatus.FAILED) failed.push(tx.bookingId);
      }
    }

    return { succeeded, failed };
  }

  // Appelé par un webhook fournisseur réel une fois branché.
  async handleWebhookConfirmation(externalReference: string, status: 'SUCCESS' | 'FAILED') {
    const tx = await this.prisma.paymentTransaction.findFirst({ where: { externalReference } });
    if (!tx) throw new NotFoundException('Transaction introuvable pour cette référence.');

    await this.prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: status === 'SUCCESS' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED },
    });

    return tx.bookingId;
  }

  async getTransactionByBooking(bookingId: string) {
    return this.prisma.paymentTransaction.findUnique({ where: { bookingId } });
  }
}
