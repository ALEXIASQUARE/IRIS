import '../api/api_client.dart';
import '../models/partner_offer.dart';
import '../models/partner_profile.dart';

class PartnersRepository {
  final ApiClient _client;

  PartnersRepository(this._client);

  Future<void> upsertProfile({required String currentZoneId, String? emergencyContact}) {
    return _client.post('/partner/profile', body: {
      'currentZoneId': currentZoneId,
      if (emergencyContact != null && emergencyContact.isNotEmpty) 'emergencyContact': emergencyContact,
    });
  }

  Future<PartnerProfile> getProfile() async {
    final result = await _client.get('/partner/profile');
    return PartnerProfile.fromJson(result as Map<String, dynamic>);
  }

  Future<void> setAvailability({required bool isAvailable, String? currentZoneId}) {
    return _client.post('/partner/availability', body: {
      'isAvailable': isAvailable,
      if (currentZoneId != null) 'currentZoneId': currentZoneId,
    });
  }

  Future<List<PartnerOffer>> listOffers() async {
    final result = await _client.get('/partner/offers') as List<dynamic>;
    return result.map((e) => PartnerOffer.fromJson(e as Map<String, dynamic>)).toList();
  }

  // Mission assignée non terminée, s'il y en a une — pour la ré-afficher au
  // redémarrage de l'app (le backend ne présente aucune offre tant qu'une
  // mission est en cours : une seule à la fois).
  Future<String?> activeMissionBookingId() async {
    final result = await _client.get('/partner/active-mission');
    if (result == null) return null;
    return (result as Map<String, dynamic>)['bookingId'] as String?;
  }

  // Position GPS temps réel — pour la navigation (trajet vers le client),
  // pas pour le matching (toujours basé sur currentZoneId).
  Future<void> updateLocation({required double latitude, required double longitude}) {
    return _client.post('/partner/location', body: {
      'latitude': latitude,
      'longitude': longitude,
    });
  }
}
