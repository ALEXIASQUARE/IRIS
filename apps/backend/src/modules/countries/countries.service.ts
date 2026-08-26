import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CountriesService {
  constructor(private prisma: PrismaService) {}

  listCountries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      select: { id: true, isoCode: true, name: true, currency: true, defaultLanguage: true },
      orderBy: { name: 'asc' },
    });
  }

  listZones(countryId: string) {
    return this.prisma.zone.findMany({
      where: { countryId, isActive: true },
      select: { id: true, name: true, cityName: true, centerLat: true, centerLng: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Gestion admin pays/zones ─────────────────────────────────────────
  listAllCountries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  createCountry(data: {
    isoCode: string;
    name: string;
    currency: string;
    defaultLanguage: string;
    isActive?: boolean;
  }) {
    return this.prisma.country.create({
      data: { ...data, isActive: data.isActive ?? true },
    });
  }

  async updateCountry(
    id: string,
    data: { name?: string; currency?: string; defaultLanguage?: string; isActive?: boolean },
  ) {
    const existing = await this.prisma.country.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pays introuvable.');
    return this.prisma.country.update({ where: { id }, data });
  }

  listAllZonesForCountry(countryId: string) {
    return this.prisma.zone.findMany({ where: { countryId }, orderBy: { name: 'asc' } });
  }

  createZone(
    countryId: string,
    data: { name: string; cityName: string; centerLat: number; centerLng: number; radiusMeters?: number },
  ) {
    return this.prisma.zone.create({ data: { ...data, countryId } });
  }

  async updateZone(
    id: string,
    data: {
      name?: string;
      cityName?: string;
      centerLat?: number;
      centerLng?: number;
      radiusMeters?: number;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.zone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Zone introuvable.');
    return this.prisma.zone.update({ where: { id }, data });
  }
}
