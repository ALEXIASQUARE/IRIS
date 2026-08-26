import 'package:latlong2/latlong.dart';

class RouteResult {
  final List<LatLng> points;
  final double distanceMeters;
  final double durationSeconds;

  RouteResult({required this.points, required this.distanceMeters, required this.durationSeconds});
}

class RoutingException implements Exception {
  final String message;
  RoutingException(this.message);

  @override
  String toString() => message;
}
