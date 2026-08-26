import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { OfferStatus, PartnerStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionsService } from '../missions/missions.service';
import { UpsertPartnerProfileDto } from './dto/upsert-partner-profile.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger('PartnersService');

  constructor(
    private prisma: PrismaService,
    private missions: MissionsService,
  ) {}

  // Le profil est créé au statut par défaut du schéma (PENDING_REVIEW) —
  // un admin doit l'approuver via POST /admin/partners/:id/approve avant
  // que le partenaire ne reçoive des offres (voir AdminModule).
  async upsertProfile(dto: UpsertPartnerProfileDto, userId: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.currentZoneId } });
    if (!zone || !zone.isActive) {
      throw new BadRequestException('Zone introuvable ou inactive.');
    }

    return this.prisma.partnerProfile.upsert({
      where: { userId },
      create: {
        userId,
        currentZoneId: dto.currentZoneId,
        emergencyContact: dto.emergencyContact,
      },
      update: {
        currentZoneId: dto.currentZoneId,
        emergencyContact: dto.emergencyContact,
      },
    });
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.partnerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Profil partenaire introuvable — créez d'abord votre profil.");
    }
    return profile;
  }

  async setAvailability(dto: SetAvailabilityDto, userId: string) {
    const profile = await this.prisma.partnerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Profil partenaire introuvable — créez d'abord votre profil.");
    }

    const updated = await this.prisma.partnerProfile.update({
      where: { userId },
      data: {
        isAvailable: dto.isAvailable,
        currentZoneId: dto.currentZoneId ?? profile.currentZoneId,
      },
    });

    // Sans ce déclenchement, une commande créée alors qu'aucun partenaire
    // n'était disponible dans la zone restait bloquée en SEARCHING_PARTNER
    // indéfiniment — searchAndBroadcastPartner abandonne silencieusement
    // après quelques cycles sans jamais se relancer de lui-même. Le job
    // planifié (MissionsService.expireStaleOffersAndRetry) rattrape aussi
    // ce cas en filet de sécurité, mais avec un délai ; ici c'est immédiat.
    if (dto.isAvailable && updated.status === PartnerStatus.ACTIVE && updated.currentZoneId) {
      await this.missions.retryStuckBookings(updated.currentZoneId).catch((err) => {
        this.logger.error('Échec de la relance des commandes bloquées après mise à disponibilité', err as Error);
      });
    }

    return updated;
  }

  // Position GPS temps réel — utilisée pour la navigation (trajet vers le
  // client), pas pour le matching (toujours basé sur currentZoneId). Le
  // partenaire l'envoie en direct via un ping périodique côté app pendant
  // PARTNER_ASSIGNED/PARTNER_EN_ROUTE.
  async updateLocation(dto: UpdateLocationDto, userId: string): Promise<void> {
    const result = await this.prisma.partnerProfile.updateMany({
      where: { userId },
      data: { currentLat: dto.latitude, currentLng: dto.longitude, locationUpdatedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException("Profil partenaire introuvable — créez d'abord votre profil.");
    }
  }

  async listOffers(userId: string) {
    const profile = await this.prisma.partnerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Profil partenaire introuvable — créez d'abord votre profil.");
    }

    return this.prisma.offer.findMany({
      where: {
        partnerProfileId: profile.id,
        status: { in: [OfferStatus.SENT, OfferStatus.VIEWED] },
        expiresAt: { gt: new Date() },
      },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            estimatedTotal: true,
            currency: true,
            scheduledAt: true,
            address: { select: { landmark: true } },
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });
  }
}
