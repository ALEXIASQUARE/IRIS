import '../api/api_client.dart';
import '../models/booking.dart';
import '../pricing/pricing_repository.dart';

class BookingsRepository {
  final ApiClient _client;

  BookingsRepository(this._client);

  Future<Booking> create({
    required String serviceCategoryId,
    required String addressId,
    required DateTime scheduledAt,
    required String paymentProviderCode,
    bool urgent = false,
    List<LaundryItemInput>? laundryItems,
    String? serviceOptionId,
    int? hours,
  }) async {
    final result = await _client.post('/bookings', body: {
      'serviceCategoryId': serviceCategoryId,
      'addressId': addressId,
      'scheduledAt': scheduledAt.toUtc().toIso8601String(),
      'paymentProviderCode': paymentProviderCode,
      'urgent': urgent,
      if (laundryItems != null) 'laundryItems': laundryItems.map((i) => i.toJson()).toList(),
      if (serviceOptionId != null) 'serviceOptionId': serviceOptionId,
      if (hours != null) 'hours': hours,
    });
    return Booking.fromJson(result as Map<String, dynamic>);
  }

  Future<Booking> get(String bookingId) async {
    final result = await _client.get('/bookings/$bookingId');
    return Booking.fromJson(result as Map<String, dynamic>);
  }

  Future<void> cancel(String bookingId, String reason) {
    return _client.post('/bookings/$bookingId/cancel', body: {'reason': reason});
  }

  // Le client rafraîchit le point de destination (confirmation à
  // l'assignation, ou partage en direct pendant l'approche).
  Future<void> updateLocation(String bookingId, double latitude, double longitude) {
    return _client.patch('/bookings/$bookingId/location', body: {
      'latitude': latitude,
      'longitude': longitude,
    });
  }

  Future<void> rate(String bookingId, int score, String? comment) {
    return _client.post('/bookings/$bookingId/rating', body: {
      'score': score,
      if (comment != null && comment.isNotEmpty) 'comment': comment,
    });
  }

  // §21.8 — confirmation client d'une révision de prix déclarée par le
  // partenaire à l'arrivée.
  Future<void> confirmPriceRevision(String bookingId, String revisionId) {
    return _client.post('/bookings/$bookingId/price-revisions/$revisionId/confirm');
  }

  // Paiement à l'arrivée — déclenché par le partenaire une fois sur place
  // et toute révision de prix réglée. Renvoie la commande à jour (statut
  // PENDING_PAYMENT ou déjà PAID si confirmation synchrone).
  Future<Booking> requestPayment(String bookingId) async {
    final result = await _client.post('/bookings/$bookingId/request-payment');
    return Booking.fromJson(result as Map<String, dynamic>);
  }
}
