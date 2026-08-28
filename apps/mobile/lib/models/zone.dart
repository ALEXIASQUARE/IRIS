class Zone {
  final String id;
  final String name;
  final String cityName;
  final double centerLat;
  final double centerLng;
  // Présent uniquement sur la réponse de CountriesRepository.getZone (pas
  // sur listZones, où il est déjà implicite dans l'URL) — nécessaire pour
  // résoudre le pays d'une zone déjà enregistrée sans supposer qu'elle
  // appartient au seul pays "prêt" (voir ClientProfileScreen/
  // PartnerProfileScreen : sélecteur Pays explicite).
  final String? countryId;
  // Présent uniquement sur la réponse de CountriesRepository.getZone —
  // évite un second appel réseau (listCountries + recherche par id) rien
  // que pour afficher le nom du pays (ex: PartnerHomeScreen : "Pays / Ville
  // / Quartier" au lieu de la seule "Zone : X").
  final String? countryName;

  Zone({
    required this.id,
    required this.name,
    required this.cityName,
    required this.centerLat,
    required this.centerLng,
    this.countryId,
    this.countryName,
  });

  factory Zone.fromJson(Map<String, dynamic> json) => Zone(
        id: json['id'] as String,
        name: json['name'] as String,
        cityName: json['cityName'] as String,
        centerLat: (json['centerLat'] as num).toDouble(),
        centerLng: (json['centerLng'] as num).toDouble(),
        countryId: json['countryId'] as String?,
        countryName: json['countryName'] as String?,
      );
}
