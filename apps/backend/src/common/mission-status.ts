import { BookingStatus } from '@prisma/client';

// Statuts pendant lesquels un partenaire est considéré « en mission » : il ne
// doit recevoir aucune nouvelle offre et ne peut pas en accepter une autre
// tant qu'il n'a pas terminé ou abandonné celle-ci. Exclut les états finaux
// (COMPLETED / CANCELLED / DISPUTED) et la recherche (SEARCHING_PARTNER).
export const ACTIVE_MISSION_STATUSES: BookingStatus[] = [
  BookingStatus.PARTNER_ASSIGNED,
  BookingStatus.PARTNER_EN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID,
  BookingStatus.PRICE_REVISION_PENDING,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETION_REQUESTED,
];
