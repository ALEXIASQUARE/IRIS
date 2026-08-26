class Country {
  final String id;
  final String isoCode;
  final String name;
  final String currency;
  final String defaultLanguage;

  Country({
    required this.id,
    required this.isoCode,
    required this.name,
    required this.currency,
    required this.defaultLanguage,
  });

  factory Country.fromJson(Map<String, dynamic> json) => Country(
        id: json['id'] as String,
        isoCode: json['isoCode'] as String,
        name: json['name'] as String,
        currency: json['currency'] as String,
        defaultLanguage: json['defaultLanguage'] as String,
      );
}
