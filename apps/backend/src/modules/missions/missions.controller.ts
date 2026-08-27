import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { MissionsService } from "./missions.service";
import { CreatePriceRevisionDto } from "./dto/create-price-revision.dto";
import { StartMissionDto } from "./dto/start-mission.dto";

// §11 — routes /offers/*, /missions/*, /bookings/{id}/price-revisions/*
// JwtAuthGuard est appliqué globalement (voir app.module.ts) ; RolesGuard
// restreint chaque route au rôle attendu.
@UseGuards(RolesGuard)
@Controller()
export class MissionsController {
  constructor(private missionsService: MissionsService) {}

  @Roles(UserRole.PARTNER)
  @Post("offers/:offerId/accept")
  acceptOffer(@Param("offerId") offerId: string, @CurrentUser() user: { id: string }) {
    return this.missionsService.acceptOffer(offerId, user.id);
  }

  @Roles(UserRole.PARTNER)
  @Post("offers/:offerId/reject")
  rejectOffer(@Param("offerId") offerId: string, @CurrentUser() user: { id: string }) {
    return this.missionsService.rejectOffer(offerId, user.id);
  }

  @Roles(UserRole.PARTNER)
  @Post("missions/:bookingId/en-route")
  async markEnRoute(@Param("bookingId") bookingId: string, @CurrentUser() user: { id: string }) {
    await this.missionsService.markEnRoute(bookingId, user.id);
  }

  @Roles(UserRole.PARTNER)
  @Post("missions/:bookingId/arrive")
  async markArrived(@Param("bookingId") bookingId: string, @CurrentUser() user: { id: string }) {
    // Le PIN généré n'est pas renvoyé au partenaire ici : le client le
    // consulte sur GET /bookings/:id (même logique que dans le vrai
    // produit — c'est le client qui communique le code au partenaire).
    await this.missionsService.markArrived(bookingId, user.id);
  }

  @Roles(UserRole.PARTNER)
  @Post("missions/:bookingId/complete")
  async completeMission(@Param("bookingId") bookingId: string, @CurrentUser() user: { id: string }) {
    await this.missionsService.completeMission(bookingId, user.id);
  }

  // Le partenaire abandonne la mission avant paiement — elle redevient
  // disponible pour les autres partenaires au lieu d'être annulée. Voir
  // MissionsService.abandonMission.
  @Roles(UserRole.PARTNER)
  @Post("missions/:bookingId/abandon")
  async abandonMission(@Param("bookingId") bookingId: string, @CurrentUser() user: { id: string }) {
    await this.missionsService.abandonMission(bookingId, user.id);
  }

  @Roles(UserRole.PARTNER)
  @Post("missions/:bookingId/start")
  startMission(
    @Param("bookingId") bookingId: string,
    @Body() dto: StartMissionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.missionsService.startMission(bookingId, dto.pin, user.id);
  }

  @Roles(UserRole.PARTNER)
  @Post("bookings/:bookingId/price-revisions")
  declarePriceRevision(
    @Param("bookingId") bookingId: string,
    @Body() dto: CreatePriceRevisionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.missionsService.declarePriceRevision(bookingId, dto, user.id);
  }

  @Roles(UserRole.CLIENT)
  @Post("bookings/:bookingId/price-revisions/:revisionId/confirm")
  confirmPriceRevision(
    @Param("bookingId") bookingId: string,
    @Param("revisionId") revisionId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.missionsService.confirmPriceRevision(bookingId, revisionId, user.id);
  }
}
