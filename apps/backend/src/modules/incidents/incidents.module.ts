import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { BookingsModule } from "../bookings/bookings.module";

// Signalement d'incidents -- Cahier des charges S7, S9. Le traitement
// (résolution) se fait côté admin -- voir AdminModule.
// BookingsModule : l'incident "non-paiement" annule automatiquement la
// mission — voir IncidentsService.report / BookingsService.cancelForNonPayment.
@Module({
  imports: [BookingsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
