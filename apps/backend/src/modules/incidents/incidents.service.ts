import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

// Type d'incident dédié au non-paiement — décision produit : le signaler
// annule automatiquement la mission et libère le partenaire, voir
// BookingsService.cancelForNonPayment pour le délai de carence (30 min).
export const PAYMENT_NOT_MADE_INCIDENT_TYPE = 'PAIEMENT_NON_EFFECTUE';

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private bookings: BookingsService,
  ) {}

  async report(dto: CreateIncidentDto, reporterId: string) {
    if (dto.type === PAYMENT_NOT_MADE_INCIDENT_TYPE) {
      if (!dto.bookingId) {
        throw new BadRequestException('Un incident de non-paiement doit être rattaché à une commande.');
      }
      // Valide (partenaire assigné, délai de 30 min écoulé) et annule la
      // mission AVANT d'enregistrer l'incident — si la validation échoue,
      // rien n'est créé (voir cancelForNonPayment).
      await this.bookings.cancelForNonPayment(dto.bookingId, reporterId);
    }

    return this.prisma.incident.create({
      data: {
        bookingId: dto.bookingId,
        reporterId,
        type: dto.type,
        severity: dto.severity,
        description: dto.description,
      },
    });
  }

  listOwn(reporterId: string) {
    return this.prisma.incident.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
