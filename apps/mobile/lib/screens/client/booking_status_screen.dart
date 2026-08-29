import 'dart:async';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../bookings/bookings_repository.dart';
import '../../models/booking.dart';
import '../../models/booking_status_labels.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/loading_button.dart';
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
      if (mounted) {
        setState(() {
          _booking = booking;
          _error = null;
        });
      }
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
      if (_error != null) {
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Center(child: InlineMessage.error(_error!)),
        );
      }
      return const Center(child: CircularProgressIndicator());
    }

    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: IrisTheme.pagePadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            InlineMessage.error(_error!),
            const SizedBox(height: 16),
          ],
          Card(
            child: Padding(
              padding: IrisTheme.cardPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Chip(label: Text(bookingStatusLabel(booking.status))),
                  const SizedBox(height: 12),
                  Text('Total', style: theme.textTheme.bodySmall),
                  Text(
                    '${booking.displayTotal.toStringAsFixed(0)} ${booking.currency}',
                    style: theme.textTheme.headlineSmall,
                  ),
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
            const InlineMessage.info(
              'Le partenaire est arrivé — il va demander le paiement avant de commencer.',
            ),
          ],
          if (booking.status == 'PENDING_PAYMENT') ...[
            const SizedBox(height: 16),
            const InlineMessage.info(
              'Confirmez le paiement Mobile Money sur votre téléphone pour que la mission démarre.',
            ),
          ],
          if (booking.status == 'PAID' && booking.missionPin != null) ...[
            const SizedBox(height: 16),
            const InlineMessage.success('Paiement effectué.'),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: IrisTheme.cardPadding,
                child: Column(
                  children: [
                    Text('Communiquez ce code au partenaire', style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 8),
                    Text(
                      booking.missionPin!,
                      style: theme.textTheme.displaySmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 6,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (booking.status == 'PRICE_REVISION_PENDING' && booking.pendingPriceRevision != null) ...[
            const SizedBox(height: 16),
            Card(
              color: theme.colorScheme.errorContainer,
              child: Padding(
                padding: IrisTheme.cardPadding,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Le partenaire propose un nouveau montant',
                      style: TextStyle(
                        color: theme.colorScheme.onErrorContainer,
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
                    LoadingFilledButton(
                      onPressed: () => _confirmPriceRevision(booking.pendingPriceRevision!.id),
                      busy: _confirmingRevision,
                      label: 'Confirmer le nouveau montant',
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (booking.status == 'IN_PROGRESS') ...[
            const SizedBox(height: 16),
            const InlineMessage.info('Mission en cours.'),
          ],
          if (booking.status == 'COMPLETED' && !_rated) ...[
            const SizedBox(height: 24),
            Text('Noter la prestation', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            DropdownButtonFormField<int>(
              initialValue: _score,
              decoration: const InputDecoration(labelText: 'Note'),
              items: [1, 2, 3, 4, 5].map((n) => DropdownMenuItem(value: n, child: Text('$n'))).toList(),
              onChanged: (v) => setState(() => _score = v ?? 5),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(labelText: 'Commentaire (optionnel)'),
            ),
            const SizedBox(height: 12),
            LoadingFilledButton(
              onPressed: _submitRating,
              busy: _rating,
              label: 'Envoyer la note',
            ),
          ],
          if (booking.status == 'COMPLETED' && _rated) ...[
            const SizedBox(height: 16),
            const InlineMessage.success('Merci pour votre évaluation.'),
          ],
          const SizedBox(height: 24),
          if (booking.isCancellable)
            OutlinedButton(
              onPressed: _cancel,
              style: OutlinedButton.styleFrom(foregroundColor: theme.colorScheme.error),
              child: const Text('Annuler la réservation'),
            ),
          if (booking.status == 'CANCELLED' || booking.status == 'COMPLETED')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: FilledButton(
                onPressed: widget.onNewBooking,
                child: const Text('Nouvelle réservation'),
              ),
            ),
          if (booking.status != 'CANCELLED') ...[
            const SizedBox(height: 8),
            IncidentReportForm(bookingId: booking.id),
          ],
        ],
      ),
    );
  }
}
