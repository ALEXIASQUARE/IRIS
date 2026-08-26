import { Module } from "@nestjs/common";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { MissionsModule } from "../missions/missions.module";

// Profil (raccourci test : agrément auto-ACTIVE), disponibilité, liste des
// offres en place. Dossier KYC / gains restent à faire -- Cahier des
// charges S6.
@Module({
  imports: [MissionsModule],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
