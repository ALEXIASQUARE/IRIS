import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';

// Ville/quartier par défaut du client — pendant de PartnersModule côté
// client (voir client.service.ts).
@Module({
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
