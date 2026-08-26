// PAIEMENT_NON_EFFECTUE : le signaler annule automatiquement la mission et
// libère le partenaire — possible seulement 30 min après l'arrivée (voir
// BookingsService.cancelForNonPayment côté backend).
const incidentTypeCodes = ['OBJET_ENDOMMAGE', 'RETARD', 'COMPORTEMENT', 'PAIEMENT_NON_EFFECTUE', 'AUTRE'];
const incidentSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

class Incident {
  final String id;
  final String? bookingId;
  final String type;
  final String severity;
  final String description;
  final String status;
  final String createdAt;

  Incident({
    required this.id,
    this.bookingId,
    required this.type,
    required this.severity,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  factory Incident.fromJson(Map<String, dynamic> json) => Incident(
        id: json['id'] as String,
        bookingId: json['bookingId'] as String?,
        type: json['type'] as String,
        severity: json['severity'] as String,
        description: json['description'] as String,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
      );
}
