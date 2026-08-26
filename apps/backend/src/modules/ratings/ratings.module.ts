import { Module } from "@nestjs/common";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";

// Notation client -> partenaire après clôture de mission -- Cahier des
// charges S5.6. Notation partenaire -> client non couverte dans ce lot
// (Rating.bookingId est @unique : une seule évaluation par réservation).
@Module({
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
