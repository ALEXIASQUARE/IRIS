import '../api/api_client.dart';
import '../models/incident.dart';

class IncidentsRepository {
  final ApiClient _client;

  IncidentsRepository(this._client);

  Future<void> report({
    String? bookingId,
    required String type,
    required String severity,
    required String description,
  }) {
    return _client.post('/incidents', body: {
      if (bookingId != null) 'bookingId': bookingId,
      'type': type,
      'severity': severity,
      'description': description,
    });
  }

  Future<List<Incident>> listOwn() async {
    final result = await _client.get('/incidents') as List<dynamic>;
    return result.map((e) => Incident.fromJson(e as Map<String, dynamic>)).toList();
  }
}
