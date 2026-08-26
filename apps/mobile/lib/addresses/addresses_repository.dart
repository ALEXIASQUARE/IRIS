import '../api/api_client.dart';
import '../models/address.dart';

class AddressesRepository {
  final ApiClient _client;

  AddressesRepository(this._client);

  Future<List<Address>> list() async {
    final result = await _client.get('/addresses') as List<dynamic>;
    return result.map((e) => Address.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Address> create({
    required String zoneId,
    required String landmark,
    required double latitude,
    required double longitude,
    String? label,
    String? district,
  }) async {
    final result = await _client.post('/addresses', body: {
      'zoneId': zoneId,
      'landmark': landmark,
      'latitude': latitude,
      'longitude': longitude,
      if (label != null && label.isNotEmpty) 'label': label,
      if (district != null && district.isNotEmpty) 'district': district,
    });
    return Address.fromJson(result as Map<String, dynamic>);
  }
}
