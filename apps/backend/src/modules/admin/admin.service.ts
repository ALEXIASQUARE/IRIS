import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { BookingStatus, IncidentStatus, PartnerStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getDashboard() {
    const [bookingsByStatus, partnersByStatus, usersByRole, ratingAvg] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.partnerProfile.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.rating.aggregate({ _avg: { score: true }, _count: { _all: true } }),
    ]);

    return {
      bookingsByStatus: bookingsByStatus.map((b) => ({ status: b.status, count: b._count._all })),
      partnersByStatus: partnersByStatus.map((p) => ({ status: p.status, count: p._count._all })),
      usersByRole: usersByRole.map((u) => ({ role: u.role, count: u._count._all })),
      averageRating: ratingAvg._avg.score,
      ratingCount: ratingAvg._count._all,
    };
  }

  listPartners(status?: PartnerStatus) {
    return this.prisma.partnerProfile.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { firstName: true, lastName: true, phone: true, email: true } },
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approvePartner(partnerId: string, adminUserId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Profil partenaire introuvable.');

    const updated = await this.prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { status: PartnerStatus.ACTIVE, approvedAt: new Date(), approvedByAdminId: adminUserId },
    });

    await this.audit.log(adminUserId, 'PARTNER_APPROVED', 'PartnerProfile', partnerId);
    return updated;
  }

  async suspendPartner(partnerId: string, adminUserId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Profil partenaire introuvable.');

    const updated = await this.prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { status: PartnerStatus.SUSPENDED, isAvailable: false },
    });

    await this.audit.log(adminUserId, 'PARTNER_SUSPENDED', 'PartnerProfile', partnerId);
    return updated;
  }

  // Vue d'ensemble des comptes client — pendant de listPartners, sans les
  // statuts d'agrément (un client n'a rien à approuver) mais avec le même
  // besoin de voir qui a un compte et de pouvoir en bloquer un abusif.
  listClients() {
    return this.prisma.user.findMany({
      where: { role: UserRole.CLIENT },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        isBlocked: true,
        createdAt: true,
        homeZone: { select: { cityName: true, name: true } },
        _count: { select: { bookingsAsClient: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async blockClient(userId: string, adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Client introuvable.');
    if (user.role !== UserRole.CLIENT) throw new NotFoundException('Client introuvable.');

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isBlocked: true } });
    await this.audit.log(adminUserId, 'CLIENT_BLOCKED', 'User', userId);
    return updated;
  }

  async unblockClient(userId: string, adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Client introuvable.');
    if (user.role !== UserRole.CLIENT) throw new NotFoundException('Client introuvable.');

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isBlocked: false } });
    await this.audit.log(adminUserId, 'CLIENT_UNBLOCKED', 'User', userId);
    return updated;
  }

  listIncidents(status?: IncidentStatus) {
    return this.prisma.incident.findMany({
      where: status ? { status } : undefined,
      include: { reporter: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveIncident(incidentId: string, dto: ResolveIncidentDto, adminUserId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException('Incident introuvable.');
    if (incident.status === IncidentStatus.RESOLVED || incident.status === IncidentStatus.CLOSED) {
      throw new ConflictException('Cet incident est déjà résolu ou clôturé.');
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        internalNotes: dto.notes,
      },
    });

    await this.audit.log(adminUserId, 'INCIDENT_RESOLVED', 'Incident', incidentId);
    return updated;
  }

  listAuditLogs() {
    return this.audit.listRecent();
  }

  // Vue d'ensemble pour l'admin : toutes les réservations, statut courant
  // (client comme partenaire), moyen/état de paiement — répond au besoin
  // "voir tous les états de toutes les réservations côté client et
  // partenaire" et "visualiser les transactions de bout en bout".
  async listBookings(params: { status?: BookingStatus; page?: number; pageSize?: number }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25;

    const where = params.status ? { status: params.status } : undefined;

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          client: { select: { firstName: true, lastName: true, phone: true } },
          assignedPartner: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
          payment: true,
          zone: { select: { cityName: true, name: true } },
          serviceCategory: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getBookingDetail(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true, email: true } },
        assignedPartner: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        payment: true,
        priceRevisions: { orderBy: { createdAt: 'desc' } },
        offers: {
          include: { partnerProfile: { include: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { sentAt: 'desc' },
        },
        incidents: true,
        rating: true,
        zone: { select: { cityName: true, name: true } },
        address: true,
        serviceCategory: { select: { name: true, code: true } },
      },
    });
    if (!booking) throw new NotFoundException('Commande introuvable.');
    return booking;
  }
}
