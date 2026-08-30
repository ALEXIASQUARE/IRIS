import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createAddress(dto: CreateAddressDto, userId: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone || !zone.isActive) {
      throw new BadRequestException('Zone introuvable ou inactive.');
    }

    return this.prisma.address.create({
      data: {
        userId,
        zoneId: dto.zoneId,
        landmark: dto.landmark,
        latitude: dto.latitude,
        longitude: dto.longitude,
        // Repli sur le repère si un client (mobile pas à jour) n'envoie pas
        // de nom — la liste des adresses affiche toujours quelque chose.
        label: dto.label?.trim() || dto.landmark,
        district: dto.district,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
