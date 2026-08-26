import { Module } from "@nestjs/common";
import { MissionsController } from "./missions.controller";
import { MissionsService } from "./missions.service";
import { NotificationModule } from "../notifications/notification.module";
import { OfferExpiryScheduler } from "./offer-expiry.scheduler";

@Module({
  imports: [NotificationModule],
  controllers: [MissionsController],
  providers: [MissionsService, OfferExpiryScheduler],
  exports: [MissionsService],
})
export class MissionsModule {}
