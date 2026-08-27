import '../api/api_client.dart';

class AcceptOfferResult {
  final String bookingId;
  AcceptOfferResult(this.bookingId);
}

class MissionsRepository {
  final ApiClient _client;

  MissionsRepository(this._client);

  Future<AcceptOfferResult> acceptOffer(String offerId) async {
    final result = await _client.post('/offers/$offerId/accept') as Map<String, dynamic>;
    return AcceptOfferResult(result['bookingId'] as String);
  }

  Future<void> rejectOffer(String offerId) {
    return _client.post('/offers/$offerId/reject');
  }

  Future<void> markEnRoute(String bookingId) {
    return _client.post('/missions/$bookingId/en-route');
  }

  Future<void> markArrived(String bookingId) {
    return _client.post('/missions/$bookingId/arrive');
  }

  Future<void> startMission(String bookingId, String pin) {
    return _client.post('/missions/$bookingId/start', body: {'pin': pin});
  }

  Future<void> completeMission(String bookingId) {
    return _client.post('/missions/$bookingId/complete');
  }

  // Le partenaire abandonne avant paiement — la mission redevient
  // disponible pour les autres partenaires au lieu d'être annulée.
  Future<void> abandonMission(String bookingId) {
    return _client.post('/missions/$bookingId/abandon');
  }
}
