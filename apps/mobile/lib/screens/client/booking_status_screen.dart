import 'dart:async';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../bookings/bookings_repository.dart';
import '../../models/booking.dart';
import '../../models/booking_status_labels.dart';
import '../../widgets/route_map_view.dart';
import '../shared/incident_report_form.dart';

// Statuts pendant lesquels le partenaire est en approche — la carte de
// trajet est affichée si sa position en direct est connue.
const _trackingStatuses = {'PARTNER_ASSIGNED', 'PARTNER_EN_ROUTE'};

// Même logique que ClientStatus.tsx (admin-web) : sondage toutes les 3s,
// affichage du PIN à ARRIVED, formulaire de notation à COMPLETED,
// annulation tant que le statut le permet.
class BookingStatusScreen extends StatefulWidget {
  final String bookingId;
  final VoidCallback onNewBooking;

  const BookingStatusScreen({super.key, required this.bookingId, required this.onNewBooking});

  @override
  State<BookingStatusScreen> createState() => _BookingStatusScreenState();
}

class _BookingStatusScreenState extends State<BookingStatusScreen> {
  late final BookingsRepository _bookings;
  Timer? _timer;
  Booking? _booking;
  String? _error;

  int _score = 5;
  final _commentController = TextEditingController();
  bool _rated = false;
  bool _rating = false;
  bool _confirmingRevision = false;

  @override
  void initState() {
    super.initState();
    _bookings = BookingsRepository(context.read<ApiClient>());
    _poll();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final booking = await _bookings.get(widget.bookingId);
      // Efface une éventuelle erreur d'un cycle précédent — sans ça, une
      // seule coupure réseau passagère laissait le bandeau rouge affiché
      // indéfiniment, même une fois la connexion rétablie.
      if (mounted) setState(() {
        _booking = booking;
        _error = null;
      });
    } on ApiException catch (e) {
      // En sondage de fond, une fois qu'on a déjà des données, on ignore les
      // échecs ponctuels plutôt que d'afficher un bandeau alarmant à chaque
      // coupure passagère — le prochain cycle (3s) rattrapera tout seul.
      if (mounted && _booking == null) setState(() => _error = e.message);
    }
  }

  Future<void> _cancel() async {
    try {
      await _bookings.cancel(widget.bookingId, 'Annulé depuis l\'application mobile.');
      await _poll();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _confirmPriceRevision(String revisionId) async {
    setState(() {
      _confirmingRevision = true;
      _error = null;
    });
    try {
      await _bookings.confirmPriceRevision(widget.bookingId, revisionId);
      await _poll();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _confirmingRevision = false);
    }
  }

  Future<void> _submitRating() async {
    setState(() {
      _rating = true;
      _error = null;
    });
    try {
      await _bookings.rate(widget.bookingId, _score, _commentController.text.trim());
      setState(() => _rated = true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _rating = false);
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
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Chip(label: Text(bookingStatusLabel(booking.status))),
                  const SizedBox(height: 8),
                  Text('Total : ${booking.displayTotal.toStringAsFixed(0)} ${booking.currency}'),
                ],
              ),
            ),
          ),
          if (_trackingStatuses.contains(booking.status) && booking.address != null) ...[
            const SizedBox(height: 16),
            RouteMapView(
              origin: booking.assignedPartner?.hasLocation == true
                  ? LatLng(booking.assignedPartner!.currentLat!, booking.assignedPartner!.currentLng!)
                  : null,
              destination: LatLng(booking.address!.latitude, booking.address!.longitude),
            ),
          ],
          if (booking.status == 'ARRIVED') ...[
            const SizedBox(height: 16),
            const Text('Le partenaire est arrivé — il va demander le paiement avant de commencer.'),
          ],
          if (booking.status == 'PENDING_PAYMENT') ...[
            const SizedBox(height: 16),
            const Text('Confirmez le paiement Mobile Money sur votre téléphone pour que la mission démarre.'),
          ],
          if (booking.status == 'PAID' && booking.missionPin != null) ...[
            const SizedBox(height: 16),
            const Text('Paiement effectué.'),
            const SizedBox(height: 8),
            const Text('Communiquez ce code au partenaire :'),
            const SizedBox(height: 8),
            Center(
              child: Text(
                booking.missionPin!,
                style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
          ],
          if (booking.status == 'PRICE_REVISION_PENDING' && booking.pendingPriceRevision != null) ...[
            const SizedBox(height: 16),
            Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Le partenaire propose un nouveau montant',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Ancien total : ${booking.pendingPriceRevision!.previousTotal.toStringAsFixed(0)} ${booking.currency}',
                    ),
                    Text(
                      'Nouveau total : ${booking.pendingPriceRevision!.newTotal.toStringAsFixed(0)} ${booking.currency}',
                    ),
                    Text('Motif : ${booking.pendingPriceRevision!.reason}'),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _confirmingRevision
                          ? null
                          : () => _confirmPriceRevision(booking.pendingPriceRevision!.id),
                      child: _confirmingRevision
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Confirmer le nouveau montant'),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (booking.status == 'IN_PROGRESS') ...[
            const SizedBox(height: 16),
            const Text('Mission en cours.'),
          ],
          if (booking.status == 'COMPLETED' && !_rated) ...[
            const SizedBox(height: 24),
            Text('Noter la prestation', style: Theme.of(context).textTheme.titleMedium),
            DropdownButtonFormField<int>(
              initialValue: _score,
              decoration: const InputDecoration(labelText: 'Note'),
              items: [1, 2, 3, 4, 5].map((n) => DropdownMenuItem(value: n, child: Text('$n'))).toList(),
              onChanged: (v) => setState(() => _score = v ?? 5),
            ),
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(labelText: 'Commentaire (optionnel)'),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _rating ? null : _submitRating,
              child: _rating
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Envoyer la note'),
            ),
          ],
          if (booking.status == 'COMPLETED' && _rated) ...[
            const SizedBox(height: 16),
            const Text('Merci pour votre évaluation.'),
          ],
          const SizedBox(height: 24),
          if (booking.isCancellable)
            OutlinedButton(
              onPressed: _cancel,
              style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
              child: const Text('Annuler la réservation'),
            ),
          if (booking.status == 'CANCELLED' || booking.status == 'COMPLETED')
            FilledButton(
              onPressed: widget.onNewBooking,
              child: const Text('Nouvelle réservation'),
            ),
          if (booking.status != 'CANCELLED') IncidentReportForm(bookingId: booking.id),
        ],
      ),
    );
  }
}
