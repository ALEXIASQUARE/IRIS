import { Module } from "@nestjs/common";
import { CountriesController } from "./countries.controller";
import { CountriesService } from "./countries.service";

// Lecture seule pour l'instant (liste pays/zones actifs — nécessaire à
// l'inscription et à la création d'adresse). CRUD administrateur complet
// (Addendum technique v1.1, section 5.1) reste à faire dans le module admin.
@Module({
  controllers: [CountriesController],
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}
