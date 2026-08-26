import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

// Gestion des adresses en place. Gestion du profil utilisateur lui-même
// reste à faire -- Cahier des charges S5.1.
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
