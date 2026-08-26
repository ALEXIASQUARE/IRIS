import '../api/api_client.dart';
import '../models/quote_result.dart';

class LaundryItemInput {
  final String garmentTypeId;
  final int quantity;
  final String fabricCategoryCode;
  final String washMethodCode;
  final String stainTypeCode;

  LaundryItemInput({
    required this.garmentTypeId,
    required this.quantity,
    required this.fabricCategoryCode,
    required this.washMethodCode,
    required this.stainTypeCode,
  });

  Map<String, dynamic> toJson() => {
        'garmentTypeId': garmentTypeId,
        'quantity': quantity,
        'fabricCategoryCode': fabricCategoryCode,
        'washMethodCode': washMethodCode,
        'stainTypeCode': stainTypeCode,
      };
}

class PricingRepository {
  final ApiClient _client;

  PricingRepository(this._client);

  Future<QuoteResult> laundryQuote({
    required String serviceCategoryId,
    required String zoneId,
    required List<LaundryItemInput> items,
    bool urgent = false,
  }) async {
    final result = await _client.post('/pricing/laundry-quote', body: {
      'serviceCategoryId': serviceCategoryId,
      'zoneId': zoneId,
      'items': items.map((i) => i.toJson()).toList(),
      'urgent': urgent,
    });
    return QuoteResult.fromJson(result as Map<String, dynamic>);
  }

  Future<QuoteResult> genericQuote({
    required String serviceOptionId,
    required String zoneId,
    bool urgent = false,
    int? hours,
  }) async {
    final result = await _client.post('/pricing/quote', body: {
      'serviceOptionId': serviceOptionId,
      'zoneId': zoneId,
      'urgent': urgent,
      if (hours != null) 'hours': hours,
    });
    return QuoteResult.fromJson(result as Map<String, dynamic>);
  }
}
