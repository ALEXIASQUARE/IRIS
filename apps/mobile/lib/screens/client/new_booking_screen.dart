import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../addresses/addresses_repository.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../bookings/bookings_repository.dart';
import '../../catalog/catalog_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/address.dart';
import '../../models/catalog.dart';
import '../../models/quote_result.dart';
import '../../pricing/pricing_repository.dart';

class _CartItem {
  final GarmentType garment;
  final int quantity;
  final String fabricCode;
  final String washCode;
  final String stainCode;

  _CartItem({
    required this.garment,
    required this.quantity,
    required this.fabricCode,
    required this.washCode,
    required this.stainCode,
  });
}

// Suit exactement le même parcours que ClientBooking.tsx (admin-web) :
// choix du service (Laverie / Ménage / Repassage) -> panier ou option
// forfaitaire/horaire -> devis -> adresse -> planification -> confirmation.
// Mobile money uniquement — aucun paiement en espèces sur la plateforme ;
// le client n'est débité qu'à l'arrivée du partenaire (voir
// BookingsService.requestArrivalPayment côté backend).
class NewBookingScreen extends StatefulWidget {
  final void Function(String bookingId) onBooked;

  const NewBookingScreen({super.key, required this.onBooked});

  @override
  State<NewBookingScreen> createState() => _NewBookingScreenState();
}

class _NewBookingScreenState extends State<NewBookingScreen> {
  late final CatalogRepository _catalog;
  late final AddressesRepository _addresses;
  late final PricingRepository _pricing;
  late final BookingsRepository _bookings;
  late final CountriesRepository _countries;

  bool _loading = true;
  String? _error;

  String? _zoneId;
  List<ServiceCategory> _categories = [];
  String? _selectedCategoryId;
  List<GarmentType> _garmentTypes = [];
  List<FabricCategory> _fabricCategories = [];
  List<WashMethod> _washMethods = [];
  List<StainType> _stainTypes = [];
  List<Address> _savedAddresses = [];

  // Panier laverie (catégorie LAUNDRY).
  GarmentType? _selectedGarment;
  int _quantity = 1;
  String _fabricCode = 'STANDARD';
  String _washCode = 'STANDARD';
  String _stainCode = 'NORMAL';
  final List<_CartItem> _cart = [];

  // Option forfaitaire/horaire (ménage, repassage — toute catégorie non-LAUNDRY).
  ServiceOption? _selectedOption;
  int _hours = 2;

  QuoteResult? _quote;
  bool _quoting = false;

  String? _selectedAddressId;
  bool _showNewAddress = false;
  final _landmarkController = TextEditingController();
  final _latController = TextEditingController(text: '4.05');
  final _lngController = TextEditingController(text: '9.70');

  DateTime _scheduledAt = DateTime.now().add(const Duration(hours: 1));
  bool _urgent = false;
  bool _submitting = false;
  String _paymentProviderCode = 'mtn_momo';

  ServiceCategory? get _selectedCategory {
    for (final c in _categories) {
      if (c.id == _selectedCategoryId) return c;
    }
    return null;
  }

  bool get _isLaundry => _selectedCategory?.code == 'LAUNDRY';

  @override
  void initState() {
    super.initState();
    final client = context.read<ApiClient>();
    _catalog = CatalogRepository(client);
    _addresses = AddressesRepository(client);
    _pricing = PricingRepository(client);
    _bookings = BookingsRepository(client);
    _countries = CountriesRepository(client);
    _load();
  }

  @override
  void dispose() {
    _landmarkController.dispose();
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Pas de sélecteur pays/zone dans l'app (même simplification que
      // App.tsx côté admin-web) : on prend le premier pays qui a
      // réellement des zones configurées (voir CountriesRepository).
      final countryWithZones = await _countries.findFirstCountryWithZones();
      final countryId = countryWithZones.country.id;
      final zoneId = countryWithZones.zones.first.id;

      final services = await _catalog.listServices(countryId);

      final results = await Future.wait([
        _catalog.listGarmentTypes(countryId),
        _catalog.listFabricCategories(),
        _catalog.listWashMethods(),
        _catalog.listStainTypes(),
        _addresses.list(),
      ]);

      setState(() {
        _zoneId = zoneId;
        _categories = services;
        _selectedCategoryId = services.isNotEmpty ? services.first.id : null;
        _garmentTypes = results[0] as List<GarmentType>;
        _fabricCategories = results[1] as List<FabricCategory>;
        _washMethods = results[2] as List<WashMethod>;
        _stainTypes = results[3] as List<StainType>;
        _savedAddresses = results[4] as List<Address>;
        _selectedGarment = _garmentTypes.isNotEmpty ? _garmentTypes.first : null;
        _selectedOption = _selectedCategory?.options.isNotEmpty == true ? _selectedCategory!.options.first : null;
        if (_savedAddresses.isNotEmpty) {
          _selectedAddressId = _savedAddresses.first.id;
        } else {
          _showNewAddress = true;
        }
      });
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  void _onCategoryChanged(String? id) {
    setState(() {
      _selectedCategoryId = id;
      _quote = null;
      _cart.clear();
      final options = _selectedCategory?.options ?? [];
      _selectedOption = options.isNotEmpty ? options.first : null;
    });
  }

  void _addItem() {
    final garment = _selectedGarment;
    if (garment == null) return;
    setState(() {
      _cart.add(_CartItem(
        garment: garment,
        quantity: _quantity,
        fabricCode: _fabricCode,
        washCode: _washCode,
        stainCode: _stainCode,
      ));
      _quote = null;
    });
  }

  void _removeItem(int index) {
    setState(() {
      _cart.removeAt(index);
      _quote = null;
    });
  }

  Future<void> _getQuote() async {
    if (_selectedCategoryId == null || _zoneId == null) return;
    if (_isLaundry && _cart.isEmpty) return;
    if (!_isLaundry && _selectedOption == null) return;

    setState(() {
      _quoting = true;
      _error = null;
    });
    try {
      final result = _isLaundry
          ? await _pricing.laundryQuote(
              serviceCategoryId: _selectedCategoryId!,
              zoneId: _zoneId!,
              urgent: _urgent,
              items: _cart
                  .map((c) => LaundryItemInput(
                        garmentTypeId: c.garment.id,
                        quantity: c.quantity,
                        fabricCategoryCode: c.fabricCode,
                        washMethodCode: c.washCode,
                        stainTypeCode: c.stainCode,
                      ))
                  .toList(),
            )
          : await _pricing.genericQuote(
              serviceOptionId: _selectedOption!.id,
              zoneId: _zoneId!,
              urgent: _urgent,
              hours: _selectedOption!.isHourly ? _hours : null,
            );
      setState(() => _quote = result);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _quoting = false);
    }
  }

  Future<void> _confirm() async {
    if (_selectedCategoryId == null || _zoneId == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      String? addressId = _selectedAddressId;
      if (_showNewAddress || addressId == null) {
        if (_landmarkController.text.trim().isEmpty) {
          throw ApiException(0, 'Indiquez un repère pour la nouvelle adresse.');
        }
        final created = await _addresses.create(
          zoneId: _zoneId!,
          landmark: _landmarkController.text.trim(),
          latitude: double.tryParse(_latController.text) ?? 0,
          longitude: double.tryParse(_lngController.text) ?? 0,
        );
        addressId = created.id;
      }

      final booking = await _bookings.create(
        serviceCategoryId: _selectedCategoryId!,
        addressId: addressId,
        scheduledAt: _scheduledAt,
        paymentProviderCode: _paymentProviderCode,
        urgent: _urgent,
        laundryItems: _isLaundry
            ? _cart
                .map((c) => LaundryItemInput(
                      garmentTypeId: c.garment.id,
                      quantity: c.quantity,
                      fabricCategoryCode: c.fabricCode,
                      washMethodCode: c.washCode,
                      stainTypeCode: c.stainCode,
                    ))
                .toList()
            : null,
        serviceOptionId: _isLaundry ? null : _selectedOption?.id,
        hours: (!_isLaundry && _selectedOption?.isHourly == true) ? _hours : null,
      );
      widget.onBooked(booking.id);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickScheduledAt() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _scheduledAt,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_scheduledAt));
    if (time == null) return;
    setState(() {
      _scheduledAt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_categories.isEmpty && _error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }

    final category = _selectedCategory;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('1. Choisir un service', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_categories.isEmpty)
            const Text('Aucun service disponible.')
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedCategoryId,
              decoration: const InputDecoration(labelText: 'Service'),
              items: _categories.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
              onChanged: _onCategoryChanged,
            ),
          const SizedBox(height: 16),
          if (_isLaundry) ...[
            Text('Composer le panier', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (_garmentTypes.isEmpty)
              const Text('Aucun article disponible.')
            else ...[
              DropdownButtonFormField<String>(
                initialValue: _selectedGarment?.id,
                decoration: const InputDecoration(labelText: 'Article'),
                items: _garmentTypes
                    .map((g) => DropdownMenuItem(value: g.id, child: Text('${g.name} (${g.basePrice.toStringAsFixed(0)})')))
                    .toList(),
                onChanged: (id) => setState(() => _selectedGarment = _garmentTypes.firstWhere((g) => g.id == id)),
              ),
              Row(
                children: [
                  const Text('Quantité :'),
                  IconButton(
                    onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text('$_quantity'),
                  IconButton(
                    onPressed: () => setState(() => _quantity++),
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
              DropdownButtonFormField<String>(
                initialValue: _fabricCode,
                decoration: const InputDecoration(labelText: 'Tissu'),
                items: _fabricCategories.map((f) => DropdownMenuItem(value: f.code, child: Text(f.name))).toList(),
                onChanged: (v) => setState(() => _fabricCode = v ?? 'STANDARD'),
              ),
              DropdownButtonFormField<String>(
                initialValue: _washCode,
                decoration: const InputDecoration(labelText: 'Méthode de lavage'),
                items: _washMethods.map((w) => DropdownMenuItem(value: w.code, child: Text(w.name))).toList(),
                onChanged: (v) => setState(() => _washCode = v ?? 'STANDARD'),
              ),
              DropdownButtonFormField<String>(
                initialValue: _stainCode,
                decoration: const InputDecoration(labelText: 'Salissure'),
                items: _stainTypes.map((s) => DropdownMenuItem(value: s.code, child: Text(s.name))).toList(),
                onChanged: (v) => setState(() => _stainCode = v ?? 'NORMAL'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _selectedGarment == null ? null : _addItem,
                icon: const Icon(Icons.add),
                label: const Text('Ajouter au panier'),
              ),
            ],
            if (_cart.isNotEmpty) ...[
              const SizedBox(height: 16),
              ..._cart.asMap().entries.map((entry) {
                final item = entry.value;
                return ListTile(
                  dense: true,
                  title: Text('${item.quantity} × ${item.garment.name}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _removeItem(entry.key),
                  ),
                );
              }),
            ],
          ] else ...[
            Text('Détails du service', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (category == null || category.options.isEmpty)
              const Text("Aucune option disponible pour ce service pour le moment.")
            else ...[
              DropdownButtonFormField<String>(
                initialValue: _selectedOption?.id,
                decoration: const InputDecoration(labelText: 'Formule'),
                items: category.options
                    .map((o) => DropdownMenuItem(
                          value: o.id,
                          child: Text(o.isHourly
                              ? '${o.name} — ${o.basePrice?.toStringAsFixed(0)} / heure'
                              : '${o.name} — ${o.basePrice?.toStringAsFixed(0)}'),
                        ))
                    .toList(),
                onChanged: (id) => setState(() {
                  _selectedOption = category.options.firstWhere((o) => o.id == id);
                  _quote = null;
                }),
              ),
              if (_selectedOption?.isHourly == true) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Durée (heures) :'),
                    IconButton(
                      onPressed: _hours > 1 ? () => setState(() { _hours--; _quote = null; }) : null,
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Text('$_hours'),
                    IconButton(
                      onPressed: () => setState(() { _hours++; _quote = null; }),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
              ],
            ],
          ],
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Urgent'),
            value: _urgent,
            onChanged: (v) => setState(() {
              _urgent = v;
              _quote = null;
            }),
          ),
          FilledButton(
            onPressed: (_quoting || (_isLaundry ? _cart.isEmpty : _selectedOption == null)) ? null : _getQuote,
            child: _quoting
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Obtenir un devis'),
          ),
          if (_quote != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Sous-total : ${_quote!.subtotal.toStringAsFixed(0)} ${_quote!.currency}'),
                    Text('Frais déplacement : ${_quote!.feesTravel.toStringAsFixed(0)}'),
                    Text('Frais plateforme : ${_quote!.feesPlatform.toStringAsFixed(0)}'),
                    if (_quote!.urgencySupplement > 0)
                      Text('Supplément urgence : ${_quote!.urgencySupplement.toStringAsFixed(0)}'),
                    const Divider(),
                    Text(
                      'Total : ${_quote!.total.toStringAsFixed(0)} ${_quote!.currency}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text('2. Adresse', style: Theme.of(context).textTheme.titleMedium),
            if (_savedAddresses.isNotEmpty && !_showNewAddress) ...[
              DropdownButtonFormField<String>(
                initialValue: _selectedAddressId,
                decoration: const InputDecoration(labelText: 'Adresse enregistrée'),
                items: _savedAddresses
                    .map((a) => DropdownMenuItem(value: a.id, child: Text(a.landmark)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedAddressId = v),
              ),
              TextButton(
                onPressed: () => setState(() => _showNewAddress = true),
                child: const Text('+ Nouvelle adresse'),
              ),
            ],
            if (_showNewAddress || _savedAddresses.isEmpty) ...[
              TextField(
                controller: _landmarkController,
                decoration: const InputDecoration(labelText: 'Repère (ex: "Carrefour Ari, portail bleu")'),
              ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _latController,
                      decoration: const InputDecoration(labelText: 'Latitude'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _lngController,
                      decoration: const InputDecoration(labelText: 'Longitude'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                    ),
                  ),
                ],
              ),
              if (_savedAddresses.isNotEmpty)
                TextButton(
                  onPressed: () => setState(() => _showNewAddress = false),
                  child: const Text('Utiliser une adresse existante'),
                ),
            ],
            const SizedBox(height: 24),
            Text('3. Planification', style: Theme.of(context).textTheme.titleMedium),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                '${_scheduledAt.day}/${_scheduledAt.month}/${_scheduledAt.year} à '
                '${_scheduledAt.hour.toString().padLeft(2, '0')}:${_scheduledAt.minute.toString().padLeft(2, '0')}',
              ),
              trailing: const Icon(Icons.edit_calendar_outlined),
              onTap: _pickScheduledAt,
            ),
            DropdownButtonFormField<String>(
              initialValue: _paymentProviderCode,
              decoration: const InputDecoration(labelText: 'Moyen de paiement (mobile money)'),
              items: const [
                DropdownMenuItem(value: 'mtn_momo', child: Text('MTN Mobile Money')),
                DropdownMenuItem(value: 'orange_money', child: Text('Orange Money')),
              ],
              onChanged: (v) => setState(() => _paymentProviderCode = v ?? 'mtn_momo'),
            ),
            Text(
              "Vous ne serez débité qu'à l'arrivée du partenaire, jamais avant.",
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submitting ? null : _confirm,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: _submitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Confirmer la réservation'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
