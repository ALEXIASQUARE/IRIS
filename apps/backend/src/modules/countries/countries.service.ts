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

  // Résout une zone par son id, quel que soit son pays — nécessaire pour
  // afficher/résoudre la zone déjà enregistrée d'un partenaire ou d'un
  // client, qui peut appartenir à un pays sans catalogue de services actif
  // (ex: Belgique/France, géographie ajoutée pour test uniquement) et donc
  // ne jamais apparaître dans le résultat de findFirstCountryWithZones côté
  // app. Utiliser listZones(country.id) pour ce cas revenait à chercher la
  // zone dans la mauvaise liste et retombait silencieusement sur la
  // première zone du pays "prêt" — voir PartnerHomeScreen._init.
  async getZone(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      select: { id: true, name: true, cityName: true, centerLat: true, centerLng: true, countryId: true, isActive: true },
    });
    if (!zone) throw new NotFoundException('Zone introuvable.');
    return zone;
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
