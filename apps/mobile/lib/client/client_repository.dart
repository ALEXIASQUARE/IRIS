import '../api/api_client.dart';
import '../models/client_profile.dart';

// Ville/quartier par défaut du client — pendant de PartnersRepository côté
// client (voir client/client.controller.ts).
class ClientRepository {
  final ApiClient _client;

  ClientRepository(this._client);

  Future<ClientProfile> getProfile() async {
    final result = await _client.get('/client/profile');
    return ClientProfile.fromJson(result as Map<String, dynamic>);
  }

  Future<ClientProfile> updateHomeZone(String zoneId) async {
    final result = await _client.patch('/client/profile', body: {'zoneId': zoneId});
    return ClientProfile.fromJson(result as Map<String, dynamic>);
  }
}
