import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../missions/missions_repository.dart';
import '../../models/booking_status_labels.dart';
import '../../models/partner_offer.dart';
import '../../partners/partners_repository.dart';

// Même logique que PartnerOffers.tsx (admin-web) : sondage toutes les 3s
// des offres en attente pour ce partenaire.
class PartnerOffersScreen extends StatefulWidget {
  final void Function(String bookingId) onAccepted;

  const PartnerOffersScreen({super.key, required this.onAccepted});

  @override
  State<PartnerOffersScreen> createState() => _PartnerOffersScreenState();
}

class _PartnerOffersScreenState extends State<PartnerOffersScreen> {
  late final PartnersRepository _partners;
  late final MissionsRepository _missions;
  Timer? _timer;
  List<PartnerOffer> _offers = [];
  String? _error;
  String? _busyOfferId;
  bool _loadedOnce = false;

  @override
  void initState() {
    super.initState();
    final client = context.read<ApiClient>();
    _partners = PartnersRepository(client);
    _missions = MissionsRepository(client);
    _poll();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final offers = await _partners.listOffers();
      if (mounted) setState(() {
        _offers = offers;
        _error = null;
        _loadedOnce = true;
      });
    } on ApiException catch (e) {
      if (mounted && !_loadedOnce) setState(() => _error = e.message);
    }
  }

  Future<void> _accept(PartnerOffer offer) async {
    setState(() {
      _busyOfferId = offer.id;
      _error = null;
    });
    try {
      final result = await _missions.acceptOffer(offer.id);
      widget.onAccepted(result.bookingId);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busyOfferId = null);
    }
  }

  Future<void> _reject(PartnerOffer offer) async {
    setState(() {
      _busyOfferId = offer.id;
      _error = null;
    });
    try {
      await _missions.rejectOffer(offer.id);
      setState(() => _offers = _offers.where((o) => o.id != offer.id).toList());
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busyOfferId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _poll,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) ...[
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 12),
          ],
          if (_offers.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: Text('Aucune offre de mission pour le moment.')),
            )
          else
            ..._offers.map((offer) {
              final busy = _busyOfferId == offer.id;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(offer.booking.addressLandmark ?? 'Adresse non précisée'),
                      const SizedBox(height: 4),
                      Text(
                        '${bookingStatusLabel(offer.booking.status)} — ${offer.booking.estimatedTotal.toStringAsFixed(0)} ${offer.booking.currency}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: busy ? null : () => _accept(offer),
                              child: const Text('Accepter'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: busy ? null : () => _reject(offer),
                              child: const Text('Refuser'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
