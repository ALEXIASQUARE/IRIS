import 'dart:async';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../bookings/bookings_repository.dart';
import '../../location/location_tracker.dart';
import '../../missions/missions_repository.dart';
import '../../models/booking.dart';
import '../../models/booking_status_labels.dart';
import '../../partners/partners_repository.dart';
import '../../widgets/route_map_view.dart';
import '../shared/incident_report_form.dart';

// Même logique que PartnerMission.tsx (admin-web) : sondage du statut de la
// mission, un bouton d'action par étape (en route -> arrivé -> PIN -> en
// cours -> terminé).
class PartnerMissionScreen extends StatefulWidget {
  final String bookingId;
  final VoidCallback onDone;

  const PartnerMissionScreen({super.key, required this.bookingId, required this.onDone});

  @override
  State<PartnerMissionScreen> createState() => _PartnerMissionScreenState();
}

// Statuts pendant lesquels le partenaire est en approche du client — la
// position GPS est envoyée en direct et la carte de trajet est affichée.
const _trackingStatuses = {'PARTNER_ASSIGNED', 'PARTNER_EN_ROUTE'};

// Statuts depuis lesquels le partenaire peut abandonner la mission — voir
// MissionsService.abandonMission côté backend : avant paiement uniquement,
// la mission redevient disponible pour d'autres partenaires plutôt que
// d'être annulée.
const _abandonableStatuses = {'PARTNER_ASSIGNED', 'PARTNER_EN_ROUTE', 'ARRIVED', 'PENDING_PAYMENT'};

class _PartnerMissionScreenState extends State<PartnerMissionScreen> {
  late final BookingsRepository _bookings;
  late final MissionsRepository _missions;
  late final LocationTracker _locationTracker;
  Timer? _timer;
  Booking? _booking;
  String? _error;
  bool _busy = false;
  LatLng? _myPosition;
  // Distinct de _error : ne bloque pas l'écran, affiché en plus de la carte
  // — voir LocationTracker.onError. Le partenaire peut toujours ouvrir la
  // navigation externe (_openExternalNavigation) même si ceci est présent.
  String? _locationError;
  final _pinController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final client = context.read<ApiClient>();
    _bookings = BookingsRepository(client);
    _missions = MissionsRepository(client);
    _locationTracker = LocationTracker(
      PartnersRepository(client),
      onPosition: (lat, lng) {
        if (mounted) setState(() {
          _myPosition = LatLng(lat, lng);
          _locationError = null;
        });
      },
      onError: (message) {
        if (mounted) setState(() => _locationError = message);
      },
    );
    _poll();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _locationTracker.stop();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final booking = await _bookings.get(widget.bookingId);
      if (mounted) setState(() {
        _booking = booking;
        _error = null;
      });
      if (_trackingStatuses.contains(booking.status)) {
        unawaited(_locationTracker.start());
      } else {
        _locationTracker.stop();
      }
    } on ApiException catch (e) {
      if (mounted && _booking == null) setState(() => _error = e.message);
    }
  }

  // Ouvre la navigation dans Google Maps (ou l'application de cartes par
  // défaut) — indépendant du GPS/du routage interne (OSRM) : c'est ce qui
  // permet réellement au partenaire de se mettre en route (guidage vocal,
  // trafic en direct), la carte intégrée n'étant qu'un aperçu.
  Future<void> _openExternalNavigation(double lat, double lng) async {
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving');
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      setState(() => _error = "Impossible d'ouvrir l'application de navigation.");
    }
  }

  Future<void> _abandonMission() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Abandonner la mission ?'),
        content: const Text(
          'La mission redeviendra disponible pour un autre partenaire. '
          'À utiliser uniquement si vous ne pouvez pas terminer cette mission.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Annuler')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Abandonner'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _missions.abandonMission(widget.bookingId);
      widget.onDone();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _call(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      await _poll();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    if (booking == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 12),
          ],
          Chip(label: Text(bookingStatusLabel(booking.status))),
          const SizedBox(height: 16),
          if (_trackingStatuses.contains(booking.status) && booking.address != null) ...[
            RouteMapView(
              origin: _myPosition,
              destination: LatLng(booking.address!.latitude, booking.address!.longitude),
            ),
            const SizedBox(height: 8),
            if (_locationError != null) ...[
              Text(_locationError!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
              const SizedBox(height: 8),
            ],
            OutlinedButton.icon(
              onPressed: () => _openExternalNavigation(booking.address!.latitude, booking.address!.longitude),
              icon: const Icon(Icons.navigation),
              label: const Text("Ouvrir l'itinéraire (Google Maps)"),
            ),
            const SizedBox(height: 16),
          ],
          if (booking.status == 'PARTNER_ASSIGNED')
            FilledButton(
              onPressed: _busy ? null : () => _call(() => _missions.markEnRoute(widget.bookingId)),
              child: const Text('En route vers le client'),
            ),
          if (booking.status == 'PARTNER_EN_ROUTE')
            FilledButton(
              onPressed: _busy ? null : () => _call(() => _missions.markArrived(widget.bookingId)),
              child: const Text('Je suis arrivé'),
            ),
          if (booking.status == 'ARRIVED')
            FilledButton(
              onPressed: _busy ? null : () => _call(() => _bookings.requestPayment(widget.bookingId)),
              child: const Text('Demander le paiement au client'),
            ),
          if (booking.status == 'PENDING_PAYMENT')
            const Text('Demande de paiement envoyée — en attente de confirmation du client…'),
          if (booking.status == 'PAID') ...[
            Text('Paiement effectué.', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            const Text('Demandez le code PIN au client.'),
            const SizedBox(height: 8),
            TextField(
              controller: _pinController,
              maxLength: 6,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Code PIN'),
              onChanged: (_) => setState(() {}),
            ),
            FilledButton(
              onPressed: (_busy || _pinController.text.trim().length < 4)
                  ? null
                  : () => _call(() => _missions.startMission(widget.bookingId, _pinController.text.trim())),
              child: const Text('Démarrer la mission'),
            ),
          ],
          if (booking.status == 'IN_PROGRESS') ...[
            const Text('Mission en cours.'),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _busy ? null : () => _call(() => _missions.completeMission(widget.bookingId)),
              child: const Text('Terminer la mission'),
            ),
          ],
          if (booking.status == 'COMPLETED') ...[
            const Text('Mission terminée.'),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: widget.onDone, child: const Text('Retour aux offres')),
          ],
          if (booking.status == 'CANCELLED') ...[
            Text('Commande annulée.', style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: widget.onDone, child: const Text('Retour aux offres')),
          ],
          if (_abandonableStatuses.contains(booking.status)) ...[
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: _busy ? null : _abandonMission,
              style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
              child: const Text('Abandonner la mission'),
            ),
          ],
          if (booking.status != 'CANCELLED') IncidentReportForm(bookingId: widget.bookingId),
        ],
      ),
    );
  }
}
