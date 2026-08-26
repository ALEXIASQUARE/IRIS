import '../api/api_client.dart';
import '../models/country.dart';
import '../models/zone.dart';

class CountryWithZones {
  final Country country;
  final List<Zone> zones;

  CountryWithZones({required this.country, required this.zones});
}

class CountriesRepository {
  final ApiClient _client;

  CountriesRepository(this._client);

  Future<List<Country>> listCountries() async {
    final result = await _client.get('/countries') as List<dynamic>;
    return result.map((e) => Country.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Zone>> listZones(String countryId) async {
    final result = await _client.get('/countries/$countryId/zones') as List<dynamic>;
    return result.map((e) => Zone.fromJson(e as Map<String, dynamic>)).toList();
  }

  // Pas de sélecteur pays/zone dans l'app (voir NewBookingScreen,
  // PartnerHomeScreen) : /countries renvoie tous les pays actifs triés par
  // nom, mais la plupart n'ont encore aucune zone configurée (seuls
  // Cameroun et Sénégal en ont à ce jour) — prendre `countries.first`
  // aveuglément casse dès qu'un pays alphabétiquement antérieur (ex:
  // Bénin) est actif sans zone. On cherche donc le premier pays qui a
  // réellement au moins une zone.
  Future<CountryWithZones> findFirstCountryWithZones() async {
    final countries = await listCountries();
    for (final country in countries) {
      final zones = await listZones(country.id);
      if (zones.isNotEmpty) {
        return CountryWithZones(country: country, zones: zones);
      }
    }
    throw Exception('Aucun pays avec une zone active — service indisponible pour le moment.');
  }
}
