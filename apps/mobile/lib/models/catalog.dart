// Modèles du catalogue laverie/services (apps/backend CatalogService). Les
// champs numériques Prisma (Decimal) sont sérialisés en chaîne côté
// backend — on les parse ici plutôt que de supposer un type JSON num.
double _parseDecimal(dynamic value) => double.parse(value.toString());

class ServiceOption {
  final String id;
  final String code;
  final String name;
  final double? basePrice;
  final String pricingUnit; // 'FLAT' | 'HOURLY'
  final bool isActive;

  ServiceOption({
    required this.id,
    required this.code,
    required this.name,
    this.basePrice,
    this.pricingUnit = 'FLAT',
    required this.isActive,
  });

  bool get isHourly => pricingUnit == 'HOURLY';

  factory ServiceOption.fromJson(Map<String, dynamic> json) => ServiceOption(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        basePrice: json['basePrice'] != null ? _parseDecimal(json['basePrice']) : null,
        pricingUnit: json['pricingUnit'] as String? ?? 'FLAT',
        isActive: json['isActive'] as bool? ?? true,
      );
}

class ServiceCategory {
  final String id;
  final String code;
  final String name;
  final bool isActive;
  final List<ServiceOption> options;

  ServiceCategory({
    required this.id,
    required this.code,
    required this.name,
    required this.isActive,
    required this.options,
  });

  factory ServiceCategory.fromJson(Map<String, dynamic> json) => ServiceCategory(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        isActive: json['isActive'] as bool? ?? true,
        options: ((json['options'] as List<dynamic>?) ?? [])
            .map((e) => ServiceOption.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class GarmentType {
  final String id;
  final String code;
  final String name;
  final double basePrice;

  GarmentType({required this.id, required this.code, required this.name, required this.basePrice});

  factory GarmentType.fromJson(Map<String, dynamic> json) => GarmentType(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        basePrice: _parseDecimal(json['basePrice']),
      );
}

class FabricCategory {
  final String code;
  final String name;

  FabricCategory({required this.code, required this.name});

  factory FabricCategory.fromJson(Map<String, dynamic> json) =>
      FabricCategory(code: json['code'] as String, name: json['name'] as String);
}

class WashMethod {
  final String code;
  final String name;

  WashMethod({required this.code, required this.name});

  factory WashMethod.fromJson(Map<String, dynamic> json) =>
      WashMethod(code: json['code'] as String, name: json['name'] as String);
}

class StainType {
  final String code;
  final String name;

  StainType({required this.code, required this.name});

  factory StainType.fromJson(Map<String, dynamic> json) =>
      StainType(code: json['code'] as String, name: json['name'] as String);
}
