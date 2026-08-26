import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationChannel, NOTIFICATION_CHANNEL } from "./providers/notification-channel.interface";

// Abstraction de notification — Addendum §5.6 : le push notification ne
// peut pas être supposé fiable. Pour les événements critiques (offre de
// mission, PIN, révision de prix), un canal SMS de secours doit exister,
// configurable par pays/opérateur. L'envoi effectif est délégué à un
// NotificationChannel interchangeable (mock pour le MVP — voir
// providers/mock-notification.channel.ts) ; chaque envoi est néanmoins
// toujours persisté ici (voir modèle Notification) pour rester consultable
// via GET /notifications, quel que soit le canal réel branché.
@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
  ) {}

  private persist(userId: string, type: string, title: string, body: string, relatedBookingId?: string) {
    return this.prisma.notification.create({
      data: { userId, type, title, body, relatedBookingId },
    });
  }

  async sendMissionOffer(partnerUserId: string, offerId: string, bookingId: string): Promise<void> {
    const title = "Nouvelle offre de mission";
    const body = `Une mission est disponible près de chez vous (offre ${offerId}).`;
    await this.channel.send(partnerUserId, title, body, { critical: true });
    await this.persist(partnerUserId, "MISSION_OFFER", title, body, bookingId);
  }

  async sendOfferLost(partnerUserId: string, bookingId: string): Promise<void> {
    const title = "Mission déjà attribuée";
    const body = "Cette mission a été acceptée par un autre partenaire.";
    await this.channel.send(partnerUserId, title, body, { critical: false });
    await this.persist(partnerUserId, "OFFER_LOST", title, body, bookingId);
  }

  async sendPriceRevisionRequest(clientUserId: string, bookingId: string, revisionId: string): Promise<void> {
    const title = "Révision de prix proposée";
    const body = "Le partenaire propose un nouveau montant pour votre commande — confirmation requise.";
    await this.channel.send(clientUserId, title, body, { critical: true });
    await this.persist(clientUserId, "PRICE_REVISION_REQUEST", title, body, bookingId);
  }
}
