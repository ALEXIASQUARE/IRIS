double _num(dynamic v) => v == null ? 0 : double.parse(v.toString());

class PartnerOfferBooking {
  final String id;
  final String status;
  final double estimatedTotal;
  final String currency;
  final String scheduledAt;
  final String? addressLandmark;

  PartnerOfferBooking({
    required this.id,
    required this.status,
    required this.estimatedTotal,
    required this.currency,
    required this.scheduledAt,
    this.addressLandmark,
  });

  factory PartnerOfferBooking.fromJson(Map<String, dynamic> json) => PartnerOfferBooking(
        id: json['id'] as String,
        status: json['status'] as String,
        estimatedTotal: _num(json['estimatedTotal']),
        currency: json['currency'] as String,
        scheduledAt: json['scheduledAt'] as String,
        addressLandmark: (json['address'] as Map<String, dynamic>?)?['landmark'] as String?,
      );
}

class PartnerOffer {
  final String id;
  final String bookingId;
  final String status;
  final String expiresAt;
  final PartnerOfferBooking booking;

  PartnerOffer({
    required this.id,
    required this.bookingId,
    required this.status,
    required this.expiresAt,
    required this.booking,
  });

  factory PartnerOffer.fromJson(Map<String, dynamic> json) => PartnerOffer(
        id: json['id'] as String,
        bookingId: json['bookingId'] as String,
        status: json['status'] as String,
        expiresAt: json['expiresAt'] as String,
        booking: PartnerOfferBooking.fromJson(json['booking'] as Map<String, dynamic>),
      );
}
