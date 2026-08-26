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

  // Position GPS temps réel — pour la navigation (trajet vers le client),
  // pas pour le matching (toujours basé sur currentZoneId).
  Future<void> updateLocation({required double latitude, required double longitude}) {
    return _client.post('/partner/location', body: {
      'latitude': latitude,
      'longitude': longitude,
    });
  }
}
