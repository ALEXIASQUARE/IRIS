import 'dart:async';
import 'package:geolocator/geolocator.dart';
import '../partners/partners_repository.dart';

// Envoie la position GPS du partenaire au backend à intervalle régulier
// pendant qu'une mission est en approche (PARTNER_ASSIGNED / EN_ROUTE) —
// utilisée pour la navigation côté client (trajet en direct), jamais pour
// le matching (toujours basé sur currentZoneId). Démarré/arrêté
// explicitement par l'écran de mission selon le statut de la réservation.
class LocationTracker {
  final PartnersRepository _partners;
  // Notifié à chaque position obtenue avec succès — permet à l'écran
  // d'afficher la carte sans redemander le GPS séparément.
  final void Function(double latitude, double longitude)? onPosition;
  Timer? _timer;
  bool _sending = false;

  LocationTracker(this._partners, {this.onPosition});

  bool get isRunning => _timer != null;

  Future<bool> _ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
      return false;
    }
    return Geolocator.isLocationServiceEnabled();
  }

  Future<void> start({Duration interval = const Duration(seconds: 10)}) async {
    if (_timer != null) return; // déjà démarré
    if (!await _ensurePermission()) return;
    await _sendOnce();
    _timer = Timer.periodic(interval, (_) => _sendOnce());
  }

  Future<void> _sendOnce() async {
    if (_sending) return;
    _sending = true;
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      onPosition?.call(position.latitude, position.longitude);
      await _partners.updateLocation(latitude: position.latitude, longitude: position.longitude);
    } catch (_) {
      // Best-effort : une erreur ponctuelle (GPS indisponible, requête
      // réseau échouée) ne doit pas interrompre le suivi — le prochain tick
      // réessaiera.
    } finally {
      _sending = false;
    }
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}
