import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminCatalogController } from "./admin-catalog.controller";
import { AdminGeoController } from "./admin-geo.controller";
import { AdminServicesController } from "./admin-services.controller";
import { AdminService } from "./admin.service";
import { AuditModule } from "../audit/audit.module";
import { ServicesCatalogModule } from "../services-catalog/services-catalog.module";
import { CountriesModule } from "../countries/countries.module";
import { PricingModule } from "../pricing/pricing.module";

// Dashboard, agrément/suspension partenaires, incidents, journal d'audit,
// gestion du catalogue laverie, gestion pays/zones, gestion catégories de
// service/grille tarifaire -- Cahier des charges S7. Gestion clients/
// missions/paiements/promotions reste à faire.
@Module({
  imports: [AuditModule, ServicesCatalogModule, CountriesModule, PricingModule],
  controllers: [AdminController, AdminCatalogController, AdminGeoController, AdminServicesController],
  providers: [AdminService],
})
export class AdminModule {}
