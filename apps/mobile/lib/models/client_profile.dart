class ClientProfile {
  final String? homeZoneId;

  ClientProfile({this.homeZoneId});

  factory ClientProfile.fromJson(Map<String, dynamic> json) => ClientProfile(
        homeZoneId: json['homeZoneId'] as String?,
      );
}
