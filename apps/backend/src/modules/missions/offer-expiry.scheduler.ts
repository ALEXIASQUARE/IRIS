import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MissionsService } from "./missions.service";

// Job planifié — purge des offres expirées et relance du matching.
// Addendum §2.2 étape 7. Volontairement séparé de MissionsService pour que
// la logique métier reste testable indépendamment du scheduler.
@Injectable()
export class OfferExpiryScheduler {
  private readonly logger = new Logger("OfferExpiryScheduler");

  constructor(private missionsService: MissionsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleExpiredOffers() {
    try {
      await this.missionsService.expireStaleOffersAndRetry();
    } catch (err) {
      this.logger.error("Échec du traitement des offres expirées", err as Error);
    }
  }
}
