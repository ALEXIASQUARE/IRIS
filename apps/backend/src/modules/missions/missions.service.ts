import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { BookingStatus, OfferStatus, OfferChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CreatePriceRevisionDto } from './dto/create-price-revision.dto';
import { ACTIVE_MISSION_STATUSES } from '../../common/mission-status';

// ─────────────────────────────────────────────────────────────────────────
// MissionsService — implémente l'algorithme de matching décrit dans
// l'Addendum technique v1.1, §2 : broadcast avec verrou optimiste.
//
// C'est la pièce identifiée comme la plus risquée de tout le système
// (concurrence entre partenaires sur une même mission). Elle est donc codée
// avec le plus de rigueur, avant le reste du flux de réservation.
// ─────────────────────────────────────────────────────────────────────────

@Injectable()
export class MissionsService {
  private readonly logger = new Logger('MissionsService');

  // Valeurs de départ configurables — Addendum §7 "points restant à valider".
  // À terme, sortir vers PricingConfig/AdminConfig plutôt que des constantes.
  private readonly OFFER_TTL_SECONDS = 50;
  private readonly BROADCAST_POOL_SIZE = 8;
  private readonly MAX_EXPANSION_CYCLES = 3;
  private readonly RADIUS_EXPANSION_FACTOR = 1.5;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // ── Étape 1-3 : lancement de la recherche et diffusion des offres ──────
  // Addendum §2.2, étapes 1 à 4.
  async searchAndBroadcastPartner(bookingId: string, expansionCycle = 0): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.status !== BookingStatus.SEARCHING_PARTNER) {
      // Idempotence : si la mission n'est plus en recherche (déjà assignée,
      // annulée...), on ne relance pas de diffusion.
      return;
    }

    const radiusMultiplier = Math.pow(this.RADIUS_EXPANSION_FACTOR, expansionCycle);
    const eligiblePartners = await this.findEligiblePartners(booking.zoneId, radiusMultiplier);

    if (eligiblePartners.length === 0) {
      if (expansionCycle >= this.MAX_EXPANSION_CYCLES) {
        await this.flagProlongedSearch(bookingId);
        return;
      }
      // Aucun partenaire dans le pool actuel : élargir sans attendre le TTL.
      await this.searchAndBroadcastPartner(bookingId, expansionCycle + 1);
      return;
    }

    const pool = eligiblePartners.slice(0, this.BROADCAST_POOL_SIZE);
    const expiresAt = new Date(Date.now() + this.OFFER_TTL_SECONDS * 1000);

    const offers = await this.prisma.$transaction(
      pool.map((partner) =>
        this.prisma.offer.create({
          data: {
            bookingId,
            partnerProfileId: partner.id,
            status: OfferStatus.SENT,
            channel: OfferChannel.PUSH,
            expiresAt,
          },
        }),
      ),
    );

    // Diffusion effective — push avec repli SMS si non confirmé reçu
    // (Addendum §5.6). Best-effort : un échec de notification individuel ne
    // doit pas faire échouer tout le cycle de diffusion.
    await Promise.allSettled(
      offers.map((offer, i) =>
        this.notifications.sendMissionOffer(pool[i].userId, offer.id, bookingId),
      ),
    );

    this.logger.log(
      `Diffusion mission ${bookingId} à ${offers.length} partenaire(s), cycle ${expansionCycle}, expire à ${expiresAt.toISOString()}`,
    );

    // Le TTL est purgé par un job planifié (voir expireStaleOffers ci-dessous),
    // pas par un setTimeout en mémoire — un redémarrage du process ne doit
    // jamais laisser une offre expirée sans traitement.
  }

  // Sélection du pool éligible — statut agréé/actif, disponible, ville.
  // Un partenaire est éligible s'il est déclaré dans n'importe quel quartier
  // de la MÊME VILLE que la commande, pas seulement le quartier exact —
  // décision produit : ne pas rater un partenaire disponible juste à côté
  // faute de correspondance exacte de quartier. Le filtre géographique reste
  // simple pour le MVP et migre vers une recherche géospatiale
  // (PostGIS/Redis GEOSEARCH, rayon réel) quand le volume de partenaires
  // actifs le justifiera — Addendum §2.4.
  private async findEligiblePartners(zoneId: string, _radiusMultiplier: number) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) return [];

    const cityZones = await this.prisma.zone.findMany({
      where: { countryId: zone.countryId, cityName: zone.cityName },
      select: { id: true },
    });

    return this.prisma.partnerProfile.findMany({
      where: {
        status: 'ACTIVE',
        isAvailable: true,
        currentZoneId: { in: cityZones.map((z) => z.id) },
      },
      orderBy: { averageRating: 'desc' },
      take: this.BROADCAST_POOL_SIZE * 2, // marge avant application du take final
    });
  }

  private async flagProlongedSearch(bookingId: string) {
    this.logger.warn(`Mission ${bookingId} : recherche prolongée sans partenaire disponible.`);
    // TODO : notifier le dashboard admin (§7 Administration Web — "missions
    // en recherche depuis > X min", cf. Addendum §2.2 étape 7).
  }

  // ── Étape 5-6 : acceptation — le cœur du verrou optimiste ──────────────
  // Addendum §2.2, étape 5 : une seule mise à jour conditionnelle peut
  // réussir. C'est ce mécanisme, et non un verrou applicatif distribué, qui
  // garantit qu'un seul partenaire obtient la mission — testé explicitement
  // en §17 du Cahier des charges ("deux partenaires ne doivent pas accepter
  // simultanément la même mission").
  async acceptOffer(offerId: string, partnerUserId: string): Promise<{ bookingId: string }> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { partnerProfile: true, booking: true },
    });
    if (!offer) throw new NotFoundException('Offre introuvable.');
    if (offer.partnerProfile.userId !== partnerUserId) {
      throw new ForbiddenException("Cette offre n'appartient pas à ce partenaire.");
    }
    if (offer.status !== OfferStatus.SENT && offer.status !== OfferStatus.VIEWED) {
      throw new ConflictException('Cette offre n\'est plus disponible.');
    }
    if (offer.expiresAt < new Date()) {
      throw new ConflictException('Cette offre a expiré.');
    }

    // Une seule mission à la fois : un partenaire déjà engagé sur une
    // mission non terminée ne peut pas en accepter une autre. `isAvailable`
    // le protège des NOUVELLES diffusions, mais pas d'une offre reçue avant
    // l'acceptation (client obsolète, course, admin-web…).
    const ongoing = await this.prisma.booking.findFirst({
      where: {
        assignedPartnerId: offer.partnerProfileId,
        status: { in: ACTIVE_MISSION_STATUSES },
      },
      select: { id: true },
    });
    if (ongoing) {
      throw new ConflictException(
        "Vous avez déjà une mission en cours — terminez-la ou abandonnez-la avant d'en accepter une autre.",
      );
    }

    // La requête conditionnelle : updateMany avec un WHERE sur le statut
    // courant garantit qu'une seule transaction concurrente peut réussir.
    // Un moteur SQL relationnel (MariaDB comme PostgreSQL) applique cette
    // contrainte au niveau ligne — aucun verrou distribué (Redis, etc.)
    // n'est nécessaire pour cette garantie.
    const result = await this.prisma.booking.updateMany({
      where: { id: offer.bookingId, status: BookingStatus.SEARCHING_PARTNER },
      data: {
        status: BookingStatus.PARTNER_ASSIGNED,
        assignedPartnerId: offer.partnerProfileId,
      },
    });

    if (result.count === 0) {
      // La mission a déjà été assignée par un autre partenaire entre-temps.
      await this.prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.LOST, respondedAt: new Date() },
      });
      throw new ConflictException('Mission déjà attribuée à un autre partenaire.');
    }

    // Assignation réussie : marquer cette offre ACCEPTED, toutes les offres
    // concurrentes encore en attente sur la même mission comme LOST, et le
    // partenaire indisponible pour de nouvelles offres tant que cette
    // mission n'est pas terminée (ou annulée — voir BookingsService.cancelBooking).
    await this.prisma.$transaction([
      this.prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED, respondedAt: new Date() },
      }),
      this.prisma.offer.updateMany({
        where: {
          bookingId: offer.bookingId,
          id: { not: offerId },
          status: { in: [OfferStatus.SENT, OfferStatus.VIEWED] },
        },
        data: { status: OfferStatus.LOST, respondedAt: new Date() },
      }),
      this.prisma.partnerProfile.update({
        where: { id: offer.partnerProfileId },
        data: { isAvailable: false },
      }),
    ]);

    // Notifier les partenaires perdants — Addendum §2.2 étape 6.
    await this.notifyLosingPartners(offer.bookingId, offerId);

    return { bookingId: offer.bookingId };
  }

  private async notifyLosingPartners(bookingId: string, winningOfferId: string) {
    const losingOffers = await this.prisma.offer.findMany({
      where: { bookingId, id: { not: winningOfferId }, status: OfferStatus.LOST },
      include: { partnerProfile: true },
    });
    await Promise.allSettled(
      losingOffers.map((o) => this.notifications.sendOfferLost(o.partnerProfile.userId, bookingId)),
    );
  }

  async rejectOffer(offerId: string, partnerUserId: string): Promise<void> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { partnerProfile: true },
    });
    if (!offer) throw new NotFoundException('Offre introuvable.');
    if (offer.partnerProfile.userId !== partnerUserId) {
      throw new ForbiddenException("Cette offre n'appartient pas à ce partenaire.");
    }
    await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.REJECTED, respondedAt: new Date() },
    });
  }

  // ── Job planifié : purge des offres expirées et relance si nécessaire ──
  // Addendum §2.2 étape 7. À appeler depuis un cron/scheduler (ex: @nestjs/schedule),
  // pas depuis un setTimeout en mémoire de process.
  async expireStaleOffersAndRetry(): Promise<void> {
    const now = new Date();
    const staleOffers = await this.prisma.offer.findMany({
      where: { status: { in: [OfferStatus.SENT, OfferStatus.VIEWED] }, expiresAt: { lt: now } },
      select: { id: true, bookingId: true },
    });

    if (staleOffers.length > 0) {
      const bookingIds = [...new Set(staleOffers.map((o) => o.bookingId))];

      await this.prisma.offer.updateMany({
        where: { id: { in: staleOffers.map((o) => o.id) } },
        data: { status: OfferStatus.EXPIRED },
      });

      for (const bookingId of bookingIds) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (booking?.status === BookingStatus.SEARCHING_PARTNER) {
          // Personne n'a accepté dans ce cycle : relancer avec un rayon élargi.
          await this.searchAndBroadcastPartner(bookingId, 1);
        }
      }
    }

    // Filet de sécurité : commandes bloquées en SEARCHING_PARTNER sans
    // aucune offre en cours — cas d'une commande créée alors qu'aucun
    // partenaire n'était encore disponible dans la zone. searchAndBroadcastPartner
    // abandonne silencieusement après §MAX_EXPANSION_CYCLES sans jamais se
    // relancer de lui-même ; ce filet reprend ces commandes à chaque
    // exécution du job (voir aussi retryStuckBookings, appelé en plus dès
    // qu'un partenaire se rend disponible — PartnersService.setAvailability).
    await this.retryStuckBookings();
  }

  // Recherche les commandes SEARCHING_PARTNER sans offre SENT/VIEWED encore
  // valide, et relance la diffusion pour chacune. `zoneId` restreint la
  // recherche à la VILLE de cette zone (cohérent avec findEligiblePartners,
  // qui matche aussi par ville — utilisé quand un partenaire vient de se
  // rendre disponible) ; omis, la recherche porte sur toutes les villes
  // (utilisé par le job planifié).
  async retryStuckBookings(zoneId?: string): Promise<void> {
    let cityFilter: { in: string[] } | undefined;
    if (zoneId) {
      const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) return;
      const cityZones = await this.prisma.zone.findMany({
        where: { countryId: zone.countryId, cityName: zone.cityName },
        select: { id: true },
      });
      cityFilter = { in: cityZones.map((z) => z.id) };
    }

    const stuckBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.SEARCHING_PARTNER,
        ...(cityFilter ? { zoneId: cityFilter } : {}),
        offers: {
          none: { status: { in: [OfferStatus.SENT, OfferStatus.VIEWED] }, expiresAt: { gt: new Date() } },
        },
      },
      select: { id: true },
    });

    for (const booking of stuckBookings) {
      await this.searchAndBroadcastPartner(booking.id);
    }
  }

  // ── Progression sur site (assigné → en route → arrivé) ─────────────────
  // Ces deux transitions n'existaient sur aucune route jusqu'ici — sans
  // elles, ARRIVED n'était jamais atteignable et generateMissionPin()
  // n'était donc jamais appelé.
  async markEnRoute(bookingId: string, partnerUserId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException('Ce partenaire n\'est pas assigné à cette mission.');
    }
    if (booking.status !== BookingStatus.PARTNER_ASSIGNED) {
      throw new ConflictException('La mission doit être au statut PARTNER_ASSIGNED.');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PARTNER_EN_ROUTE },
    });
  }

  async markArrived(bookingId: string, partnerUserId: string): Promise<{ pin: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException('Ce partenaire n\'est pas assigné à cette mission.');
    }
    if (booking.status !== BookingStatus.PARTNER_EN_ROUTE) {
      throw new ConflictException('La mission doit être au statut PARTNER_EN_ROUTE.');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ARRIVED, arrivedAt: new Date() },
    });

    const pin = await this.generateMissionPin(bookingId);
    return { pin };
  }

  // ── PIN de mission (§9, §5.6) ───────────────────────────────────────────
  // Généré côté serveur, à usage unique, avec expiration — jamais côté client.
  async generateMissionPin(bookingId: string): Promise<string> {
    const pin = String(Math.floor(1000 + Math.random() * 9000)); // 4 chiffres
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        missionPin: pin,
        missionPinExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });
    return pin;
  }

  async startMission(bookingId: string, pin: string, partnerUserId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException('Ce partenaire n\'est pas assigné à cette mission.');
    }
    if (booking.status === BookingStatus.PRICE_REVISION_PENDING) {
      throw new ConflictException(
        'Une révision de prix est en attente de confirmation client avant de démarrer.',
      );
    }
    if (booking.status === BookingStatus.ARRIVED || booking.status === BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException(
        'Le paiement du client doit être confirmé avant de démarrer la mission — voir POST /bookings/:id/request-payment.',
      );
    }
    if (booking.status !== BookingStatus.PAID) {
      throw new ConflictException('La mission doit être au statut PAID pour démarrer.');
    }
    if (!booking.missionPin || !booking.missionPinExpiresAt || booking.missionPinExpiresAt < new Date()) {
      throw new BadRequestException('PIN expiré ou non généré. Demander un nouveau PIN.');
    }
    if (booking.missionPin !== pin) {
      throw new BadRequestException('PIN incorrect.');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.IN_PROGRESS,
        missionStartedAt: new Date(),
        missionPin: null, // usage unique — invalidé immédiatement après validation
      },
    });
  }

  // ── Abandon de mission (avant paiement) ─────────────────────────────────
  // Si le partenaire abandonne en chemin (imprévu, changement d'avis...)
  // avant que le client ait payé, la mission doit redevenir disponible
  // pour les autres partenaires au lieu de rester bloquée indéfiniment sur
  // ce partenaire — retour utilisateur explicite : seule l'absence de
  // paiement du client passé les 30 minutes prescrites
  // (BookingsService.cancelForNonPayment) doit annuler la réservation ;
  // un abandon côté partenaire doit la remettre en recherche, jamais
  // l'annuler.
  async abandonMission(bookingId: string, partnerUserId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException("Ce partenaire n'est pas assigné à cette mission.");
    }

    const abandonableStatuses: BookingStatus[] = [
      BookingStatus.PARTNER_ASSIGNED,
      BookingStatus.PARTNER_EN_ROUTE,
      BookingStatus.ARRIVED,
      BookingStatus.PENDING_PAYMENT,
    ];
    if (!abandonableStatuses.includes(booking.status)) {
      throw new ConflictException("Cette mission ne peut plus être abandonnée à ce stade.");
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.SEARCHING_PARTNER,
          assignedPartnerId: null,
          arrivedAt: null,
          missionPin: null,
          missionPinExpiresAt: null,
        },
      }),
      // Redevient disponible pour de nouvelles offres — même logique que
      // completeMission/BookingsService.cancelBooking.
      this.prisma.partnerProfile.update({
        where: { id: booking.assignedPartnerId! },
        data: { isAvailable: true },
      }),
    ]);

    // Relance la diffusion immédiatement, sans attendre le prochain cycle
    // du job planifié (expireStaleOffersAndRetry) — le client ne doit pas
    // attendre inutilement qu'un partenaire abandonne sans recours.
    await this.searchAndBroadcastPartner(bookingId).catch((err) => {
      this.logger.error(`Échec de la relance après abandon de la mission ${bookingId}`, err as Error);
    });
  }

  // ── Fin de mission ───────────────────────────────────────────────────
  // On saute l'état intermédiaire COMPLETION_REQUESTED (prévu par le
  // schéma pour une confirmation client) pour rester simple — même logique
  // pragmatique que pour en-route/arrive/start.
  async completeMission(bookingId: string, partnerUserId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException('Ce partenaire n\'est pas assigné à cette mission.');
    }
    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new ConflictException('La mission doit être au statut IN_PROGRESS pour être terminée.');
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.COMPLETED },
      }),
      // Redevient disponible pour de nouvelles offres — voir acceptOffer.
      this.prisma.partnerProfile.update({
        where: { id: booking.assignedPartnerId! },
        data: { isAvailable: true },
      }),
    ]);
  }

  // ── Révision de prix à l'arrivée (§21.8, Addendum §4) ───────────────────
  async declarePriceRevision(bookingId: string, dto: CreatePriceRevisionDto, partnerUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.assignedPartner?.userId !== partnerUserId) {
      throw new ForbiddenException('Ce partenaire n\'est pas assigné à cette mission.');
    }
    if (booking.status !== BookingStatus.ARRIVED) {
      throw new ConflictException('Une révision de prix ne peut être déclarée qu\'au statut ARRIVED.');
    }

    const [revision] = await this.prisma.$transaction([
      this.prisma.priceRevision.create({
        data: {
          bookingId,
          previousTotal: booking.estimatedTotal,
          newTotal: dto.newTotal,
          reason: dto.reason,
          detail: dto.detail as Prisma.InputJsonValue,
        },
      }),
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.PRICE_REVISION_PENDING },
      }),
    ]);

    await this.notifications.sendPriceRevisionRequest(booking.clientId, bookingId, revision.id);
    return revision;
  }

  // §21.8 étape 6 : après confirmation explicite du client, le prix devient
  // définitif et la mission peut redescendre vers ARRIVED (prête à démarrer).
  async confirmPriceRevision(bookingId: string, revisionId: string, clientUserId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Mission introuvable.');
    if (booking.clientId !== clientUserId) {
      throw new ForbiddenException('Cette mission n\'appartient pas à ce client.');
    }
    if (booking.status !== BookingStatus.PRICE_REVISION_PENDING) {
      throw new ConflictException('Aucune révision de prix en attente pour cette mission.');
    }

    const revision = await this.prisma.priceRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.bookingId !== bookingId) {
      throw new NotFoundException('Révision de prix introuvable.');
    }

    await this.prisma.$transaction([
      this.prisma.priceRevision.update({
        where: { id: revisionId },
        data: { confirmedByClientAt: new Date() },
      }),
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.ARRIVED, finalTotal: revision.newTotal },
      }),
    ]);
  }
}
