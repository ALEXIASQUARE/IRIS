// Libellés FR de BookingStatus — repris de
// apps/mobile/lib/models/booking_status_labels.dart.
const LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING_PAYMENT: 'Paiement en attente',
  PAID: 'Payée',
  SEARCHING_PARTNER: "Recherche d'un partenaire",
  PARTNER_ASSIGNED: 'Demande prise en charge',
  PARTNER_EN_ROUTE: 'Partenaire en route',
  ARRIVED: 'Partenaire arrivé',
  PRICE_REVISION_PENDING: 'Révision de prix à confirmer',
  IN_PROGRESS: 'Mission en cours',
  COMPLETION_REQUESTED: 'Fin de mission à confirmer',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  DISPUTED: 'Litige en cours',
}

export function bookingStatusLabel(status: string): string {
  return LABELS[status] ?? status
}

// PENDING_PAYMENT/PAID = paiement à l'arrivée (après ARRIVED, non annulable)
// -> exclus, cohérent avec le backend.
export const CANCELLABLE_STATUSES = new Set([
  'DRAFT',
  'SEARCHING_PARTNER',
  'PARTNER_ASSIGNED',
  'PARTNER_EN_ROUTE',
])
