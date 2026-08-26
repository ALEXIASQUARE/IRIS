import '../api/api_client.dart';
import '../models/catalog.dart';

class CatalogRepository {
  final ApiClient _client;

  CatalogRepository(this._client);

  Future<List<ServiceCategory>> listServices(String countryId) async {
    final result = await _client.get('/services?countryId=$countryId') as List<dynamic>;
    return result.map((e) => ServiceCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<GarmentType>> listGarmentTypes(String countryId) async {
    final result = await _client.get('/laundry/garment-types?countryId=$countryId') as List<dynamic>;
    return result.map((e) => GarmentType.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<FabricCategory>> listFabricCategories() async {
    final result = await _client.get('/laundry/fabric-categories') as List<dynamic>;
    return result.map((e) => FabricCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<WashMethod>> listWashMethods() async {
    final result = await _client.get('/laundry/wash-methods') as List<dynamic>;
    return result.map((e) => WashMethod.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StainType>> listStainTypes() async {
    final result = await _client.get('/laundry/stain-types') as List<dynamic>;
    return result.map((e) => StainType.fromJson(e as Map<String, dynamic>)).toList();
  }
}
