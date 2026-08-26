class Zone {
  final String id;
  final String name;
  final String cityName;
  final double centerLat;
  final double centerLng;

  Zone({required this.id, required this.name, required this.cityName, required this.centerLat, required this.centerLng});

  factory Zone.fromJson(Map<String, dynamic> json) => Zone(
        id: json['id'] as String,
        name: json['name'] as String,
        cityName: json['cityName'] as String,
        centerLat: (json['centerLat'] as num).toDouble(),
        centerLng: (json['centerLng'] as num).toDouble(),
      );
}
