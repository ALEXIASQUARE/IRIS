double _num(dynamic v) => v == null ? 0 : double.parse(v.toString());

class QuoteResult {
  final String pricingConfigId;
  final String currency;
  final double subtotal;
  final double stainSupplements;
  final double feesTravel;
  final double feesPlatform;
  final double urgencySupplement;
  final double discount;
  final double total;
  final bool requiresManualQuote;

  QuoteResult({
    required this.pricingConfigId,
    required this.currency,
    required this.subtotal,
    required this.stainSupplements,
    required this.feesTravel,
    required this.feesPlatform,
    required this.urgencySupplement,
    required this.discount,
    required this.total,
    required this.requiresManualQuote,
  });

  factory QuoteResult.fromJson(Map<String, dynamic> json) => QuoteResult(
        pricingConfigId: json['pricingConfigId'] as String,
        currency: json['currency'] as String,
        subtotal: _num(json['subtotal']),
        stainSupplements: _num(json['stainSupplements']),
        feesTravel: _num(json['feesTravel']),
        feesPlatform: _num(json['feesPlatform']),
        urgencySupplement: _num(json['urgencySupplement']),
        discount: _num(json['discount']),
        total: _num(json['total']),
        requiresManualQuote: json['requiresManualQuote'] as bool? ?? false,
      );
}
