import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:iris_mobile/routing/osrm_routing_provider.dart';
import 'package:iris_mobile/routing/route_result.dart';

http.Response _jsonResponse(int status, Object? body) =>
    http.Response(body == null ? '' : jsonEncode(body), status);

void main() {
  final origin = LatLng(4.05, 9.70);
  final destination = LatLng(4.06, 9.71);

  test('parse la géométrie GeoJSON (lng,lat -> LatLng) et les métriques OSRM', () async {
    final provider = OsrmRoutingProvider(
      httpClient: MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.path, contains('/route/v1/driving/9.7,4.05;9.71,4.06'));
        return _jsonResponse(200, {
          'code': 'Ok',
          'routes': [
            {
              'distance': 1234.5,
              'duration': 300.0,
              'geometry': {
                'coordinates': [
                  [9.70, 4.05],
                  [9.705, 4.055],
                  [9.71, 4.06],
                ],
              },
            },
          ],
        });
      }),
    );

    final result = await provider.getRoute(origin: origin, destination: destination);

    expect(result.distanceMeters, 1234.5);
    expect(result.durationSeconds, 300.0);
    expect(result.points.length, 3);
    // Le premier point de la géométrie GeoJSON est [lng, lat] -> LatLng(lat, lng).
    expect(result.points.first.latitude, 4.05);
    expect(result.points.first.longitude, 9.70);
  });

  test("lève RoutingException quand OSRM ne trouve aucun itinéraire", () async {
    final provider = OsrmRoutingProvider(
      httpClient: MockClient((request) async => _jsonResponse(200, {'code': 'NoRoute', 'routes': []})),
    );

    await expectLater(
      provider.getRoute(origin: origin, destination: destination),
      throwsA(isA<RoutingException>()),
    );
  });

  test('lève RoutingException sur une réponse HTTP en erreur', () async {
    final provider = OsrmRoutingProvider(
      httpClient: MockClient((request) async => http.Response('', 503)),
    );

    await expectLater(
      provider.getRoute(origin: origin, destination: destination),
      throwsA(isA<RoutingException>()),
    );
  });
}
