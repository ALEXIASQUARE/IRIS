class Address {
  final String id;
  final String zoneId;
  final String landmark;
  final double latitude;
  final double longitude;
  final String? label;
  final String? district;
  final bool isDefault;

  Address({
    required this.id,
    required this.zoneId,
    required this.landmark,
    required this.latitude,
    required this.longitude,
    this.label,
    this.district,
    required this.isDefault,
  });

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: json['id'] as String,
        zoneId: json['zoneId'] as String,
        landmark: json['landmark'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        label: json['label'] as String?,
        district: json['district'] as String?,
        isDefault: json['isDefault'] as bool? ?? false,
      );
}
