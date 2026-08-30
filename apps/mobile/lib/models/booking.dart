double _num(dynamic v) => v == null ? 0 : double.parse(v.toString());

// PENDING_PAYMENT/PAID désignent le paiement à l'arrivée (après ARRIVED,
// lui-même non annulable) — exclus pour rester cohérent avec le backend.
const cancellableStatuses = {
  'DRAFT',
  'SEARCHING_PARTNER',
  'PARTNER_ASSIGNED',
  'PARTNER_EN_ROUTE',
};

class PriceRevision {
  final String id;
  final double previousTotal;
  final double newTotal;
  final String reason;
  final String? confirmedByClientAt;

  PriceRevision({
    required this.id,
    required this.previousTotal,
    required this.newTotal,
    required this.reason,
    this.confirmedByClientAt,
  });

  factory PriceRevision.fromJson(Map<String, dynamic> json) => PriceRevision(
        id: json['id'] as String,
        previousTotal: _num(json['previousTotal']),
        newTotal: _num(json['newTotal']),
        reason: json['reason'] as String,
        confirmedByClientAt: json['confirmedByClientAt'] as String?,
      );
}

class BookingAddress {
  final String landmark;
  final double latitude;
  final double longitude;

  BookingAddress({required this.landmark, required this.latitude, required this.longitude});

  factory BookingAddress.fromJson(Map<String, dynamic> json) => BookingAddress(
        landmark: json['landmark'] as String? ?? '',
        latitude: _num(json['latitude']),
        longitude: _num(json['longitude']),
      );
}

// Position GPS temps réel du partenaire assigné — pour la navigation
// (trajet en direct), voir LocationTracker côté partenaire.
class AssignedPartnerInfo {
  final double? currentLat;
  final double? currentLng;
  final String? locationUpdatedAt;

  AssignedPartnerInfo({this.currentLat, this.currentLng, this.locationUpdatedAt});

  bool get hasLocation => currentLat != null && currentLng != null;

  factory AssignedPartnerInfo.fromJson(Map<String, dynamic> json) => AssignedPartnerInfo(
        currentLat: json['currentLat'] != null ? _num(json['currentLat']) : null,
        currentLng: json['currentLng'] != null ? _num(json['currentLng']) : null,
        locationUpdatedAt: json['locationUpdatedAt'] as String?,
      );
}

class Booking {
  final String id;
  final String status;
  final double estimatedTotal;
  final double? finalTotal;
  final String currency;
  final String scheduledAt;
  final String? missionPin;
  final List<PriceRevision> priceRevisions;
  final BookingAddress? address;
  final AssignedPartnerInfo? assignedPartner;
  // Point de destination réel pour la navigation du partenaire — rafraîchi
  // par le client à l'assignation (voir PATCH /bookings/:id/location).
  final double? clientLat;
  final double? clientLng;
  final String? clientLocationUpdatedAt;

  Booking({
    required this.id,
    required this.status,
    required this.estimatedTotal,
    this.finalTotal,
    required this.currency,
    required this.scheduledAt,
    this.missionPin,
    this.priceRevisions = const [],
    this.address,
    this.assignedPartner,
    this.clientLat,
    this.clientLng,
    this.clientLocationUpdatedAt,
  });

  double get displayTotal => finalTotal ?? estimatedTotal;

  // Point vers lequel guider le partenaire : la position rafraîchie par le
  // client si disponible, sinon celle de l'adresse.
  double? get destLat => clientLat ?? address?.latitude;
  double? get destLng => clientLng ?? address?.longitude;
  bool get isCancellable => cancellableStatuses.contains(status);

  // §21.8 — la révision en attente de confirmation client, s'il y en a une.
  PriceRevision? get pendingPriceRevision {
    for (final r in priceRevisions) {
      if (r.confirmedByClientAt == null) return r;
    }
    return null;
  }

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        id: json['id'] as String,
        status: json['status'] as String,
        estimatedTotal: _num(json['estimatedTotal']),
        finalTotal: json['finalTotal'] != null ? _num(json['finalTotal']) : null,
        currency: json['currency'] as String,
        scheduledAt: json['scheduledAt'] as String,
        missionPin: json['missionPin'] as String?,
        priceRevisions: ((json['priceRevisions'] as List<dynamic>?) ?? [])
            .map((e) => PriceRevision.fromJson(e as Map<String, dynamic>))
            .toList(),
        address: json['address'] != null ? BookingAddress.fromJson(json['address'] as Map<String, dynamic>) : null,
        assignedPartner: json['assignedPartner'] != null
            ? AssignedPartnerInfo.fromJson(json['assignedPartner'] as Map<String, dynamic>)
            : null,
        clientLat: json['clientLat'] != null ? _num(json['clientLat']) : null,
        clientLng: json['clientLng'] != null ? _num(json['clientLng']) : null,
        clientLocationUpdatedAt: json['clientLocationUpdatedAt'] as String?,
      );
}
