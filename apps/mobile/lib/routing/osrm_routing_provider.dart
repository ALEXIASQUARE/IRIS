import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'route_result.dart';
import 'routing_provider.dart';

// Implémentation OSRM (Open Source Routing Machine) — gratuite, sans clé
// API. Utilise ici le serveur de démo public : suffisant pour un MVP, mais
// à usage limité (pas de garantie de disponibilité/débit en production) —
// prévoir une instance auto-hébergée si le volume augmente, ce qui ne
// change que `_baseUrl` ci-dessous.
class OsrmRoutingProvider implements RoutingProvider {
  final http.Client _http;
  final Duration _timeout;
  static const String _baseUrl = 'https://router.project-osrm.org';

  OsrmRoutingProvider({http.Client? httpClient, Duration? timeout})
      : _http = httpClient ?? http.Client(),
        _timeout = timeout ?? const Duration(seconds: 10);

  @override
  Future<RouteResult> getRoute({required LatLng origin, required LatLng destination}) async {
    final uri = Uri.parse(
      '$_baseUrl/route/v1/driving/'
      '${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}'
      '?overview=full&geometries=geojson',
    );

    http.Response response;
    try {
      response = await _http.get(uri).timeout(_timeout);
    } on TimeoutException {
      throw RoutingException("Le service d'itinéraire ne répond pas.");
    } on SocketException {
      throw RoutingException("Impossible de joindre le service d'itinéraire.");
    }

    if (response.statusCode != 200) {
      throw RoutingException("Erreur du service d'itinéraire (${response.statusCode}).");
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final routes = decoded['routes'] as List<dynamic>?;
    if (decoded['code'] != 'Ok' || routes == null || routes.isEmpty) {
      throw RoutingException('Aucun itinéraire trouvé.');
    }

    final route = routes.first as Map<String, dynamic>;
    final coordinates = (route['geometry']['coordinates'] as List<dynamic>)
        .map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
        .toList();

    return RouteResult(
      points: coordinates,
      distanceMeters: (route['distance'] as num).toDouble(),
      durationSeconds: (route['duration'] as num).toDouble(),
    );
  }
}
