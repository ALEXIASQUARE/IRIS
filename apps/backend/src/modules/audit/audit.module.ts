import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

// Journalisation des actions administratives sensibles -- Cahier des
// charges S9, S13. Appelée explicitement depuis AdminService (pas
// d'interceptor générique : le périmètre reste restreint aux quelques
// actions admin, pas à toute mutation).
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
