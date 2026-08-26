import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// Module global : évite d'importer PrismaModule dans chaque module métier.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
