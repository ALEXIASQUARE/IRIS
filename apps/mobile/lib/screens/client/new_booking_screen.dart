import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../../addresses/addresses_repository.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../bookings/bookings_repository.dart';
import '../../catalog/catalog_repository.dart';
import '../../client/client_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/address.dart';
import '../../models/catalog.dart';
import '../../models/quote_result.dart';
import '../../models/zone.dart';
import '../../pricing/pricing_repository.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/loading_button.dart';

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
  late final ClientRepository _clientRepo;

  bool _loading = true;
  String? _error;

  String? _zoneId;
  // Toutes les zones du pays résolu, pour le sélecteur ville/quartier ci-
  // dessous — voir _load(). Corrige un bug réel : sans sélecteur explicite,
  // _zoneId retombait silencieusement sur la première zone du pays pour
  // TOUTE réservation dont le client n'avait pas encore défini de zone par
  // défaut (voir ClientProfileScreen), ce qui envoyait les réservations
  // dans une ville au hasard — les partenaires de la vraie ville du client
  // ne recevaient donc jamais l'offre (retour terrain : "certains
  // partenaires ne voient pas les réservations pourtant ils sont dans la
  // même ville").
  List<Zone> _allZones = [];
  String? _selectedCity;
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
  bool _locating = false;
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
    _clientRepo = ClientRepository(client);
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
      // Résout d'abord le pays à partir de la ville/quartier déjà
      // enregistrée dans le profil du client (voir ClientProfileScreen) —
      // une fois le profil renseigné, la réservation doit proposer les
      // villes et quartiers du VRAI pays du client, pas systématiquement
      // celui du catalogue par défaut (Cameroun). Repli sur le premier pays
      // "prêt" (zones + catalogue de services actif) si le profil n'a pas
      // encore de zone enregistrée — même simplification que App.tsx côté
      // admin-web pour ce seul cas de repli.
      Zone? homeZone;
      try {
        final profile = await _clientRepo.getProfile();
        final homeZoneId = profile.homeZoneId;
        if (homeZoneId != null) {
          homeZone = await _countries.getZone(homeZoneId);
        }
      } catch (_) {
        // repli sur le pays "prêt" ci-dessous
      }

      final String countryId;
      List<Zone> zones;
      if (homeZone != null && homeZone.countryId != null) {
        countryId = homeZone.countryId!;
        zones = await _countries.listZones(countryId);
      } else {
        final countryWithZones = await _countries.findFirstCountryWithZones();
        countryId = countryWithZones.country.id;
        zones = countryWithZones.zones;
      }
      if (zones.isEmpty) {
        throw ApiException(0, 'Aucune zone configurée pour votre pays pour le moment.');
      }

      final zoneId = (homeZone != null && zones.any((z) => z.id == homeZone!.id))
          ? homeZone.id
          : zones.first.id;

      final services = await _catalog.listServices(countryId);

      final results = await Future.wait([
        _catalog.listGarmentTypes(countryId),
        _catalog.listFabricCategories(),
        _catalog.listWashMethods(),
        _catalog.listStainTypes(),
        _addresses.list(),
      ]);

      final resolvedZone = zones.firstWhere((z) => z.id == zoneId);

      setState(() {
        _zoneId = zoneId;
        _allZones = zones;
        _selectedCity = resolvedZone.cityName;
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
          // Aligne la zone de tarification sur la vraie zone de l'adresse
          // par défaut plutôt que sur la zone du profil, qui peut différer.
          final matches = _allZones.where((z) => z.id == _savedAddresses.first.zoneId);
          if (matches.isNotEmpty) {
            _zoneId = matches.first.id;
            _selectedCity = matches.first.cityName;
          }
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

  List<String> get _cities => _allZones.map((z) => z.cityName).toSet().toList()..sort();

  List<Zone> get _zonesForSelectedCity =>
      _allZones.where((z) => z.cityName == _selectedCity).toList()..sort((a, b) => a.name.compareTo(b.name));

  void _onCityChanged(String? value) {
    if (value == null) return;
    setState(() {
      _selectedCity = value;
      final zonesForCity = _allZones.where((z) => z.cityName == value).toList();
      _zoneId = zonesForCity.isNotEmpty ? zonesForCity.first.id : null;
      _quote = null;
    });
  }

  void _onZoneChanged(String? value) {
    if (value == null) return;
    setState(() {
      _zoneId = value;
      _quote = null;
    });
  }

  // La zone de tarification/réservation doit refléter l'adresse réellement
  // utilisée — sinon le devis (et la ville enregistrée sur la réservation)
  // ne correspond plus à l'adresse enregistrée choisie ci-dessous.
  void _onSavedAddressChanged(String? addressId) {
    if (addressId == null) return;
    final address = _savedAddresses.firstWhere((a) => a.id == addressId);
    final matches = _allZones.where((z) => z.id == address.zoneId);
    setState(() {
      _selectedAddressId = addressId;
      _quote = null;
      if (matches.isNotEmpty) {
        _zoneId = matches.first.id;
        _selectedCity = matches.first.cityName;
      }
    });
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

  // Remplit lat/lng avec la position GPS réelle plutôt que de laisser le
  // client taper des coordonnées à la main (source d'erreur importante pour
  // la navigation du partenaire — voir RouteMapView).
  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        throw Exception("Autorisation de localisation refusée — activez-la dans les paramètres de l'application.");
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Activez la localisation (GPS) sur votre téléphone.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      setState(() {
        _latController.text = position.latitude.toStringAsFixed(6);
        _lngController.text = position.longitude.toStringAsFixed(6);
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _locating = false);
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              InlineMessage.error(_error!),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: _load, child: const Text('Réessayer')),
            ],
          ),
        ),
      );
    }

    final category = _selectedCategory;

    return SingleChildScrollView(
      padding: IrisTheme.pagePadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Ville et quartier de la prestation', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedCity,
                  decoration: const InputDecoration(labelText: 'Ville'),
                  items: _cities.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: _onCityChanged,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _zoneId,
                  decoration: const InputDecoration(labelText: 'Quartier'),
                  items: _zonesForSelectedCity.map((z) => DropdownMenuItem(value: z.id, child: Text(z.name))).toList(),
                  onChanged: _onZoneChanged,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
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
          LoadingFilledButton(
            onPressed: (_isLaundry ? _cart.isEmpty : _selectedOption == null) ? null : _getQuote,
            busy: _quoting,
            label: 'Obtenir un devis',
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
                onChanged: _onSavedAddressChanged,
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
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _locating ? null : _useCurrentLocation,
                icon: _locating
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.my_location),
                label: const Text('Utiliser ma position actuelle'),
              ),
              const SizedBox(height: 8),
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
              InlineMessage.error(_error!),
            ],
            const SizedBox(height: 16),
            LoadingFilledButton(
              onPressed: _confirm,
              busy: _submitting,
              label: 'Confirmer la réservation',
            ),
          ],
        ],
      ),
    );
  }
}
