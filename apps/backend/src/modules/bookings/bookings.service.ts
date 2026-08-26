import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { MissionsService } from '../missions/missions.service';
import { CreateBookingDto } from './dto/create-booking.dto';

// ─────────────────────────────────────────────────────────────────────────
// BookingsService — orchestre le parcours §5.3 du Cahier des charges :
// devis (revalidé serveur) -> création DRAFT -> paiement -> SEARCHING_PARTNER
// -> déclenchement du matching (MissionsService, Addendum §2).
//
// Ce service ne contient aucune règle de calcul de prix ni de logique de
// matching lui-même : il orchestre les autres services, chacun responsable
// de son domaine.
// ─────────────────────────────────────────────────────────────────────────

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private payments: PaymentsService,
    private missions: MissionsService,
  ) {}

  async createBooking(dto: CreateBookingDto, clientId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: dto.addressId },
      include: { zone: true },
    });
    if (!address || address.userId !== clientId) {
      throw new ForbiddenException("Cette adresse n'appartient pas à ce client.");
    }
    if (!address.zone.isActive) {
      throw new BadRequestException("IRIS n'est pas encore disponible dans cette zone.");
    }

    const serviceCategory = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.serviceCategoryId },
    });
    if (!serviceCategory || !serviceCategory.isActive) {
      throw new NotFoundException('Catégorie de service introuvable.');
    }

    // Le devis est toujours recalculé côté serveur à partir de la grille
    // active, jamais accepté depuis le client — §21.14.
    const quote =
      dto.laundryItems && dto.laundryItems.length > 0
        ? await this.pricing.computeLaundryQuote({
            serviceCategoryId: dto.serviceCategoryId,
            zoneId: address.zoneId,
            items: dto.laundryItems,
            urgent: dto.urgent,
          })
        : await this.pricing.computeGenericQuote({
            serviceOptionId: dto.serviceOptionId!,
            zoneId: address.zoneId,
            urgent: dto.urgent,
            hours: dto.hours,
          });

    if (quote.requiresManualQuote) {
      throw new BadRequestException(
        'Une ou plusieurs pièces déclarées nécessitent un devis manuel avant confirmation (traitement spécial) — §21.5.',
      );
    }

    // Paiement à l'arrivée (décision produit) : le client choisit son moyen
    // mobile money à la confirmation mais n'est débité qu'une fois le
    // partenaire arrivé et le prix définitif connu (voir requestArrivalPayment
    // ci-dessous) — jamais avant, pour ne pas immobiliser l'argent du client
    // pendant toute la recherche de partenaire, parfois infructueuse.
    const booking = await this.prisma.booking.create({
      data: {
        clientId,
        addressId: dto.addressId,
        zoneId: address.zoneId,
        serviceCategoryId: dto.serviceCategoryId,
        pricingConfigId: quote.pricingConfigId,
        paymentProviderCode: dto.paymentProviderCode,
        status: BookingStatus.SEARCHING_PARTNER,
        scheduledAt: new Date(dto.scheduledAt),
        currency: quote.currency,
        pricingSnapshot: quote as any, // figé définitivement — §21.6
        estimatedTotal: quote.total,
      },
    });

    await this.missions.searchAndBroadcastPartner(booking.id);

    return this.getBooking(booking.id, clientId, 'CLIENT');
  }

  // ── Paiement à l'arrivée ────────────────────────────────────────────────
  // Déclenché par le partenaire une fois sur place (statut ARRIVED) et toute
  // révision de prix réglée (§21.8) — jamais avant, le montant définitif
  // n'étant connu qu'à ce moment-là. Un tiers du sous-total révisé (delta de
  // la révision imputé entièrement au sous-total service, cf. commission
  // §21.12) constitue la commission plateforme.
  async requestArrivalPayment(bookingId: string, partnerUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Commande introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException("Ce partenaire n'est pas assigné à cette commande.");
    }
    if (booking.status !== BookingStatus.ARRIVED) {
      throw new ConflictException(
        "Le paiement ne peut être demandé qu'une fois le partenaire arrivé et toute révision de prix réglée.",
      );
    }

    const client = await this.prisma.user.findUnique({
      where: { id: booking.clientId },
      select: { phone: true },
    });
    if (!client) throw new NotFoundException('Client introuvable.');

    const snapshot = booking.pricingSnapshot as unknown as { subtotal: number };
    const finalAmount = Number(booking.finalTotal ?? booking.estimatedTotal);
    const revisedSubtotal = snapshot.subtotal + (finalAmount - Number(booking.estimatedTotal));
    const platformCommission = revisedSubtotal / 3;
    const partnerPayout = finalAmount - platformCommission;

    const locked = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.ARRIVED },
      data: { status: BookingStatus.PENDING_PAYMENT },
    });
    if (locked.count === 0) {
      throw new ConflictException('Le paiement a déjà été demandé pour cette commande.');
    }

    const transaction = await this.payments.initiatePayment({
      bookingId,
      providerCode: booking.paymentProviderCode,
      amount: finalAmount,
      currency: booking.currency,
      phone: client.phone,
      platformCommission,
      partnerPayout,
    });

    if (transaction.status === PaymentStatus.SUCCESS) {
      await this.confirmArrivalPaymentSuccess(booking.id);
    }

    return this.getBooking(booking.id, partnerUserId, 'PARTNER');
  }

  // Appelé par le job de réconciliation une fois la confirmation Mobile
  // Money reçue (webhook perdu ou non branché — voir PaymentReconciliationScheduler).
  async confirmArrivalPaymentSuccess(bookingId: string): Promise<void> {
    await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
      data: { status: BookingStatus.PAID },
    });
  }

  // Le paiement a échoué (refus, timeout côté fournisseur...) : on redonne
  // la main au partenaire pour retenter, plutôt que d'annuler direct.
  async revertFailedArrivalPayment(bookingId: string): Promise<void> {
    await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
      data: { status: BookingStatus.ARRIVED },
    });
  }

  // Filet de sécurité : si le client ne confirme jamais le paiement (prompt
  // Mobile Money ignoré...), la commande reste bloquée en PENDING_PAYMENT
  // indéfiniment — on l'annule après un délai raisonnable pour libérer le
  // partenaire.
  async cancelStalePendingPayments(timeoutMinutes = 15): Promise<void> {
    const threshold = new Date(Date.now() - timeoutMinutes * 60_000);
    const stale = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDING_PAYMENT, updatedAt: { lt: threshold } },
      select: { id: true },
    });

    for (const b of stale) {
      await this.prisma.booking.updateMany({
        where: { id: b.id, status: BookingStatus.PENDING_PAYMENT },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: "Paiement non confirmé dans le délai imparti après l'arrivée du partenaire.",
        },
      });
    }
  }

  async getBooking(bookingId: string, requesterId: string, requesterRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true, payment: true, priceRevisions: true, address: true },
    });
    if (!booking) throw new NotFoundException('Commande introuvable.');

    const isOwner = booking.clientId === requesterId;
    const isAssignedPartner = booking.assignedPartner?.userId === requesterId;
    const isStaff = requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN';

    if (!isOwner && !isAssignedPartner && !isStaff) {
      throw new ForbiddenException("Vous n'avez pas accès à cette commande.");
    }

    return booking;
  }

  // Annulation — §9 : "prévoir un mécanisme d'annulation avec motifs et
  // règles configurables". Politique de départ simple : annulable tant que
  // le partenaire n'est pas encore arrivé. PENDING_PAYMENT/PAID désignent
  // désormais le paiement à l'arrivée (après ARRIVED, lui-même non
  // annulable) — les en exclure pour rester cohérent.
  private readonly CANCELLABLE_STATUSES: BookingStatus[] = [
    BookingStatus.DRAFT,
    BookingStatus.SEARCHING_PARTNER,
    BookingStatus.PARTNER_ASSIGNED,
    BookingStatus.PARTNER_EN_ROUTE,
  ];

  async cancelBooking(bookingId: string, clientId: string, reason: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Commande introuvable.');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException("Cette commande n'appartient pas à ce client.");
    }
    if (!this.CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new ConflictException(
        'Cette commande ne peut plus être annulée à ce stade — contacter le support.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      }),
      // Si un partenaire était déjà assigné (PARTNER_ASSIGNED/EN_ROUTE), il
      // avait été rendu indisponible à l'acceptation — le libérer, la
      // mission n'a plus lieu (voir MissionsService.acceptOffer).
      ...(booking.assignedPartnerId
        ? [
            this.prisma.partnerProfile.update({
              where: { id: booking.assignedPartnerId },
              data: { isAvailable: true },
            }),
          ]
        : []),
    ]);
  }

  // Non-paiement signalé par le partenaire (incident dédié — voir
  // IncidentsService.report) : le partenaire doit attendre un délai de
  // carence après son arrivée avant de pouvoir le signaler — ce délai EST
  // la protection contre un signalement abusif/précipité, pas une simple
  // formalité après coup. La validation ci-dessous a donc lieu AVANT toute
  // annulation ou création de l'incident.
  private readonly NON_PAYMENT_WAIT_MINUTES = 30;

  async cancelForNonPayment(bookingId: string, partnerUserId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Commande introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException("Ce partenaire n'est pas assigné à cette commande.");
    }
    if (booking.status !== BookingStatus.ARRIVED && booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException(
        "Le non-paiement ne peut être signalé qu'après l'arrivée sur place, tant que le paiement n'est pas confirmé.",
      );
    }
    if (!booking.arrivedAt) {
      throw new ConflictException("Heure d'arrivée introuvable pour cette commande.");
    }
    const waitUntil = new Date(booking.arrivedAt.getTime() + this.NON_PAYMENT_WAIT_MINUTES * 60_000);
    if (waitUntil > new Date()) {
      const remainingMinutes = Math.ceil((waitUntil.getTime() - Date.now()) / 60_000);
      throw new ConflictException(
        `Vous devez attendre encore ${remainingMinutes} min après votre arrivée avant de signaler un non-paiement.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Non-paiement du client signalé par le partenaire après arrivée.',
        },
      }),
      // Libère immédiatement le partenaire pour les autres missions en
      // attente — même logique que cancelBooking.
      this.prisma.partnerProfile.update({
        where: { id: booking.assignedPartnerId! },
        data: { isAvailable: true },
      }),
    ]);
  }
}
