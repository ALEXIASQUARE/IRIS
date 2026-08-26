import 'package:latlong2/latlong.dart';
import 'route_result.dart';

// Abstraction du calcul d'itinéraire — le reste de l'app (écrans, widgets
// carte) ne dépend que de cette interface, jamais d'un fournisseur concret.
// Aujourd'hui : OSRM (gratuit, sans clé API — voir OsrmRoutingProvider).
// Si ça bug ou qu'on veut passer à Google Directions plus tard, seul un
// nouveau fichier providers/xxx_routing_provider.dart est ajouté ; aucun
// écran n'a besoin de changer.
abstract class RoutingProvider {
  Future<RouteResult> getRoute({required LatLng origin, required LatLng destination});
}
