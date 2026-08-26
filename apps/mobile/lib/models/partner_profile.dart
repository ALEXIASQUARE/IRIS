class PartnerProfile {
  final String id;
  final String status; // PENDING_REVIEW | APPROVED | REJECTED | ACTIVE | SUSPENDED | DEACTIVATED
  final bool isAvailable;
  final String? currentZoneId;

  PartnerProfile({
    required this.id,
    required this.status,
    required this.isAvailable,
    this.currentZoneId,
  });

  factory PartnerProfile.fromJson(Map<String, dynamic> json) => PartnerProfile(
        id: json['id'] as String,
        status: json['status'] as String,
        isAvailable: json['isAvailable'] as bool? ?? false,
        currentZoneId: json['currentZoneId'] as String?,
      );
}
