import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  // Une seule évaluation par réservation (Rating.bookingId est @unique) —
  // dans ce lot, seul le client note le partenaire assigné.
  async rateBooking(bookingId: string, dto: CreateRatingDto, clientUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignedPartner: true },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    if (booking.clientId !== clientUserId) {
      throw new ForbiddenException("Cette réservation n'appartient pas à ce client.");
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException('La mission doit être terminée pour être notée.');
    }
    if (!booking.assignedPartner) {
      throw new ConflictException('Aucun partenaire assigné à cette réservation.');
    }

    const existing = await this.prisma.rating.findUnique({ where: { bookingId } });
    if (existing) {
      throw new ConflictException('Cette réservation a déjà été notée.');
    }

    const partnerUserId = booking.assignedPartner.userId;

    const rating = await this.prisma.rating.create({
      data: {
        bookingId,
        fromUserId: clientUserId,
        toUserId: partnerUserId,
        score: dto.score,
        comment: dto.comment,
      },
    });

    const agg = await this.prisma.rating.aggregate({
      where: { toUserId: partnerUserId },
      _avg: { score: true },
    });
    await this.prisma.partnerProfile.update({
      where: { id: booking.assignedPartner.id },
      data: { averageRating: agg._avg.score ?? undefined },
    });

    return rating;
  }
}
