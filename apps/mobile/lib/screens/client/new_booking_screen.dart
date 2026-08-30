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
import '../../models/country.dart';
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

  // Pays de la prestation — sélectionnable explicitement (retour terrain :
  // un client dont le pays n'est pas encore résolu par son profil, ou qui
  // réserve pour un autre pays, ne pouvait pas le changer). Le catalogue de
  // services et les quartiers dépendent du pays -> _applyCountry les
  // recharge à chaque changement.
  List<Country> _availableCountries = [];
  String? _selectedCountryId;
  bool _switchingCountry = false;

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
  // Nom donné par le client à l'adresse (« Maison de ma mère ») + repère
  // facultatif. Plus de saisie latitude/longitude à la main : la seule
  // source fiable ici (pas de rues nommées dans beaucoup de pays) est la
  // position GPS capturée.
  final _addressNameController = TextEditingController();
  final _landmarkController = TextEditingController();
  double? _capturedLat;
  double? _capturedLng;

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
    _addressNameController.dispose();
    _landmarkController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final countries = await _countries.listCountries();

      // Pays de départ : celui de la zone déjà enregistrée dans le profil du
      // client (voir ClientProfileScreen). Repli sur le premier pays "prêt"
      // (zones + catalogue de services) si le profil n'a pas encore de zone.
      // Le client peut de toute façon en changer explicitement ci-dessous.
      Zone? homeZone;
      try {
        final profile = await _clientRepo.getProfile();
        final homeZoneId = profile.homeZoneId;
        if (homeZoneId != null) {
          homeZone = await _countries.getZone(homeZoneId);
        }
      } catch (_) {
        // repli ci-dessous
      }

      final String initialCountryId = (homeZone != null && homeZone.countryId != null)
          ? homeZone.countryId!
          : (await _countries.findFirstCountryWithZones()).country.id;

      // Références indépendantes du pays + adresses du client — chargées une
      // seule fois (un changement de pays ne les recharge pas).
      final refs = await Future.wait([
        _catalog.listFabricCategories(),
        _catalog.listWashMethods(),
        _catalog.listStainTypes(),
        _addresses.list(),
      ]);
      final savedAddresses = refs[3] as List<Address>;

      setState(() {
        _availableCountries = countries;
        _fabricCategories = refs[0] as List<FabricCategory>;
        _washMethods = refs[1] as List<WashMethod>;
        _stainTypes = refs[2] as List<StainType>;
        _savedAddresses = savedAddresses;
        if (savedAddresses.isNotEmpty) {
          _selectedAddressId = savedAddresses.first.id;
        } else {
          _showNewAddress = true;
        }
      });

      // Quartier à présélectionner : celui de l'adresse par défaut, sinon
      // celui du profil (précédence identique à l'ancien comportement).
      await _applyCountry(
        initialCountryId,
        preferredZoneIds: [
          if (savedAddresses.isNotEmpty) savedAddresses.first.zoneId,
          if (homeZone != null) homeZone.id,
        ],
      );
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // Charge quartiers + catalogue de services du pays et (re)positionne
  // ville / quartier / service. Appelé au démarrage et à chaque changement
  // de pays.
  Future<void> _applyCountry(String countryId, {List<String> preferredZoneIds = const []}) async {
    final zones = await _countries.listZones(countryId);
    if (zones.isEmpty) {
      throw ApiException(0, 'Aucun quartier configuré pour ce pays pour le moment.');
    }
    final services = await _catalog.listServices(countryId);
    final garments = await _catalog.listGarmentTypes(countryId);

    Zone? zone;
    for (final pref in preferredZoneIds) {
      final match = zones.where((z) => z.id == pref);
      if (match.isNotEmpty) {
        zone = match.first;
        break;
      }
    }
    zone ??= zones.first;

    setState(() {
      _selectedCountryId = countryId;
      _allZones = zones;
      _zoneId = zone!.id;
      _selectedCity = zone.cityName;
      _categories = services;
      _selectedCategoryId = services.isNotEmpty ? services.first.id : null;
      _garmentTypes = garments;
      _selectedGarment = garments.isNotEmpty ? garments.first : null;
      _selectedOption =
          _selectedCategory?.options.isNotEmpty == true ? _selectedCategory!.options.first : null;
      _cart.clear();
      _quote = null;
    });
  }

  Future<void> _onCountryChanged(String? countryId) async {
    if (countryId == null || countryId == _selectedCountryId) return;
    setState(() {
      _switchingCountry = true;
      _error = null;
    });
    try {
      await _applyCountry(countryId);
      // Une adresse enregistrée appartient au quartier d'un pays donné : si
      // aucune ne correspond au nouveau pays, on bascule sur la saisie d'une
      // nouvelle adresse.
      final hasMatch = _savedAddresses.any((a) => _allZones.any((z) => z.id == a.zoneId));
      if (!hasMatch) {
        setState(() {
          _selectedAddressId = null;
          _showNewAddress = true;
        });
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _switchingCountry = false);
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
        final name = _addressNameController.text.trim();
        if (name.isEmpty) {
          throw ApiException(0, "Donnez un nom à cette adresse (ex : « Maison de ma mère »).");
        }
        if (_capturedLat == null || _capturedLng == null) {
          throw ApiException(0, 'Enregistrez votre position actuelle pour cette adresse.');
        }
        final landmark = _landmarkController.text.trim();
        final created = await _addresses.create(
          zoneId: _zoneId!,
          label: name,
          landmark: landmark.isEmpty ? name : landmark,
          latitude: _capturedLat!,
          longitude: _capturedLng!,
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
        _capturedLat = position.latitude;
        _capturedLng = position.longitude;
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
          Text('Lieu de la prestation', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _selectedCountryId,
            decoration: const InputDecoration(labelText: 'Pays'),
            items: _availableCountries
                .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                .toList(),
            onChanged: _switchingCountry ? null : _onCountryChanged,
          ),
          const SizedBox(height: 12),
          if (_switchingCountry)
            const LinearProgressIndicator()
          else if (_allZones.isEmpty)
            const InlineMessage.info('Aucun quartier configuré pour ce pays pour le moment.')
          else
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
                    items: _zonesForSelectedCity
                        .map((z) => DropdownMenuItem(value: z.id, child: Text(z.name)))
                        .toList(),
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

          const SizedBox(height: 8),
          Text('2. Adresse', style: Theme.of(context).textTheme.titleMedium),
          if (_savedAddresses.isNotEmpty && !_showNewAddress) ...[
            DropdownButtonFormField<String>(
              initialValue: _selectedAddressId,
              decoration: const InputDecoration(labelText: 'Adresse enregistrée'),
              items: _savedAddresses
                  .map((a) => DropdownMenuItem(
                        value: a.id,
                        child: Text(
                          (a.label != null && a.label!.isNotEmpty) ? a.label! : a.landmark,
                        ),
                      ))
                  .toList(),
              onChanged: _onSavedAddressChanged,
            ),
            TextButton(
              onPressed: () => setState(() => _showNewAddress = true),
              child: const Text('+ Nouvelle adresse'),
            ),
          ],
          if (_showNewAddress || _savedAddresses.isEmpty) ...[
            const SizedBox(height: 4),
            TextField(
              controller: _addressNameController,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: "Nom de l'adresse",
                hintText: 'Ex : Maison de ma mère',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _landmarkController,
              decoration: const InputDecoration(
                labelText: 'Repère (facultatif)',
                hintText: 'Ex : portail bleu après le carrefour Ari',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _locating ? null : _useCurrentLocation,
              icon: _locating
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(_capturedLat != null ? Icons.check_circle : Icons.my_location),
              label: Text(
                _capturedLat != null
                    ? 'Position enregistrée — appuyez pour actualiser'
                    : 'Enregistrer ma position actuelle',
              ),
              style: _capturedLat != null
                  ? OutlinedButton.styleFrom(foregroundColor: IrisTheme.successColor(context))
                  : null,
            ),
            if (_capturedLat == null) ...[
              const SizedBox(height: 4),
              Text(
                "Le partenaire est guidé jusqu'à cette position — enregistrez-la sur place.",
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (_savedAddresses.isNotEmpty)
              TextButton(
                onPressed: () => setState(() => _showNewAddress = false),
                child: const Text('Utiliser une adresse existante'),
              ),
          ],

          const SizedBox(height: 16),
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
