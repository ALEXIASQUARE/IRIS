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
  // nom. Un pays avec des zones mais sans catégorie de service configurée
  // (ex: Bénin, Côte d'Ivoire — géographie ajoutée avant leur catalogue de
  // services) affichait "Aucun service disponible" côté client dès qu'il
  // était alphabétiquement avant le pays réellement prêt (Cameroun) — on
  // exige donc aussi au moins une catégorie de service active, pas
  // seulement une zone.
  Future<CountryWithZones> findFirstCountryWithZones() async {
    final countries = await listCountries();
    for (final country in countries) {
      final zones = await listZones(country.id);
      if (zones.isEmpty) continue;
      final services = await _client.get('/services?countryId=${country.id}') as List<dynamic>;
      if (services.isNotEmpty) {
        return CountryWithZones(country: country, zones: zones);
      }
    }
    throw Exception('Aucun pays avec un service configuré — service indisponible pour le moment.');
  }
}
