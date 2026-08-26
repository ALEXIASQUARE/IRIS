import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../routing/osrm_routing_provider.dart';
import '../routing/route_result.dart';
import '../routing/routing_provider.dart';

// Carte + trajet réel (suit les routes, pas une ligne droite) entre une
// origine (position en direct — GPS partenaire ou dernière position connue)
// et une destination (adresse client). Fond de carte OpenStreetMap, calcul
// d'itinéraire OSRM — voir routing/routing_provider.dart pour l'abstraction
// qui permet de changer de fournisseur sans toucher ce widget.
class RouteMapView extends StatefulWidget {
  final LatLng? origin;
  final LatLng destination;
  final String destinationLabel;

  const RouteMapView({
    super.key,
    required this.origin,
    required this.destination,
    this.destinationLabel = 'Client',
  });

  @override
  State<RouteMapView> createState() => _RouteMapViewState();
}

class _RouteMapViewState extends State<RouteMapView> {
  final RoutingProvider _routing = OsrmRoutingProvider();
  final MapController _mapController = MapController();
  static const _distanceCalc = Distance();

  RouteResult? _route;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _maybeFetchRoute();
  }

  @override
  void didUpdateWidget(covariant RouteMapView old) {
    super.didUpdateWidget(old);
    final origin = widget.origin;
    if (origin == null) return;
    // On ne relance pas le calcul d'itinéraire à chaque pixel de mouvement
    // GPS — seulement si la position a changé de façon significative, pour
    // ne pas saturer le serveur OSRM public (gratuit, débit limité).
    if (old.origin == null || _distanceCalc.as(LengthUnit.Meter, old.origin!, origin) > 30) {
      _maybeFetchRoute();
    }
  }

  Future<void> _maybeFetchRoute() async {
    final origin = widget.origin;
    if (origin == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _routing.getRoute(origin: origin, destination: widget.destination);
      if (mounted) setState(() => _route = result);
    } on RoutingException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final origin = widget.origin;

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 240,
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: origin ?? widget.destination,
                initialZoom: 14,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.iris.iris_mobile',
                ),
                if (_route != null)
                  PolylineLayer(polylines: [
                    Polyline(points: _route!.points, strokeWidth: 4, color: Colors.blue),
                  ]),
                MarkerLayer(markers: [
                  Marker(
                    point: widget.destination,
                    width: 36,
                    height: 36,
                    child: const Icon(Icons.home, color: Colors.red, size: 32),
                  ),
                  if (origin != null)
                    Marker(
                      point: origin,
                      width: 36,
                      height: 36,
                      child: const Icon(Icons.local_shipping, color: Colors.blue, size: 32),
                    ),
                ]),
              ],
            ),
            if (_loading)
              const Positioned(
                top: 8,
                right: 8,
                child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            if (_route != null)
              Positioned(
                left: 8,
                bottom: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    '${(_route!.distanceMeters / 1000).toStringAsFixed(1)} km · ${(_route!.durationSeconds / 60).ceil()} min',
                    style: const TextStyle(fontSize: 12, color: Colors.black87),
                  ),
                ),
              ),
            if (_error != null && origin == null)
              const Positioned(
                left: 8,
                bottom: 8,
                child: Text(
                  'En attente de la position du partenaire…',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ),
            if (_error != null && origin != null)
              Positioned(
                left: 8,
                bottom: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
                  child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
