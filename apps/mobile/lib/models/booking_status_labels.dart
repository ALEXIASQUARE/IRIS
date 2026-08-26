// Libellés lisibles pour BookingStatus (schema.prisma côté backend) —
// utilisés côté client (BookingStatusScreen) et partenaire
// (PartnerMissionScreen) à la place du nom brut de l'enum.
const bookingStatusLabels = <String, String>{
  'DRAFT': 'Brouillon',
  'PENDING_PAYMENT': 'Paiement en attente',
  'PAID': 'Payée',
  'SEARCHING_PARTNER': 'Recherche d\'un partenaire',
  'PARTNER_ASSIGNED': 'Demande prise en charge',
  'PARTNER_EN_ROUTE': 'Partenaire en route',
  'ARRIVED': 'Partenaire arrivé',
  'PRICE_REVISION_PENDING': 'Révision de prix à confirmer',
  'IN_PROGRESS': 'Mission en cours',
  'COMPLETION_REQUESTED': 'Fin de mission à confirmer',
  'COMPLETED': 'Terminée',
  'CANCELLED': 'Annulée',
  'DISPUTED': 'Litige en cours',
};

String bookingStatusLabel(String status) => bookingStatusLabels[status] ?? status;
