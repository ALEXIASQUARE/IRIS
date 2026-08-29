import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Ville/quartier par défaut du client — pendant de PartnersService pour la
// zone du partenaire (currentZoneId), mais ici un simple champ sur User
// plutôt qu'un profil dédié : contrairement au partenaire, le client n'a
// pas d'autre donnée de profil spécifique (pas d'agrément, pas de
// disponibilité).
@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { homeZoneId: true, phone: true },
    });
    return user;
  }

  async updateHomeZone(userId: string, zoneId: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      throw new BadRequestException('Zone introuvable ou inactive.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { homeZoneId: zoneId },
      select: { homeZoneId: true },
    });
  }
}
