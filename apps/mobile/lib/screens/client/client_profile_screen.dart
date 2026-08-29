import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_repository.dart';
import '../../client/client_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/country.dart';
import '../../models/zone.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/loading_button.dart';

// Pendant de PartnerProfileScreen côté client : le client n'avait aucun
// moyen d'indiquer ni de corriger son pays/sa ville/son quartier par défaut
// (utilisé pour préremplir la tarification et les nouvelles adresses — voir
// NewBookingScreen), ni de changer son mot de passe. Le sélecteur Pays a été
// ajouté après coup : sans lui, la ville/le quartier n'étaient
// choisissables que dans le seul pays "prêt" (celui avec un catalogue de
// services actif, toujours le Cameroun) — un client réellement basé
// ailleurs ne pouvait pas indiquer sa vraie zone.
//
// Contrairement au partenaire, aucun état à faire remonter à l'écran
// parent : NewBookingScreen recharge son propre zoneId par défaut
// (ClientRepository.getProfile) à chaque fois qu'il redevient visible, donc
// cet écran est autonome — il n'a pas besoin qu'on lui passe la zone
// courante ni de callback de mise à jour.
class ClientProfileScreen extends StatefulWidget {
  const ClientProfileScreen({super.key});

  @override
  State<ClientProfileScreen> createState() => _ClientProfileScreenState();
}

class _ClientProfileScreenState extends State<ClientProfileScreen> {
  late final ClientRepository _client;
  late final CountriesRepository _countriesRepo;
  late final AuthRepository _auth;

  bool _loadingCountries = true;
  String? _countriesError;
  List<Country> _countries = [];
  String? _selectedCountryId;

  bool _loadingZones = false;
  String? _zonesError;
  List<Zone> _zones = [];
  String? _selectedCity;
  String? _selectedZoneId;

  bool _savingZone = false;
  String? _zoneSaveMessage;

  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _savingPassword = false;
  String? _passwordError;
  String? _passwordSuccess;

  @override
  void initState() {
    super.initState();
    final apiClient = context.read<ApiClient>();
    _client = ClientRepository(apiClient);
    _countriesRepo = CountriesRepository(apiClient);
    _auth = AuthRepository(apiClient);
    _loadInitial();
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loadingCountries = true;
      _countriesError = null;
    });
    try {
      final countries = await _countriesRepo.listCountries();
      setState(() => _countries = countries);

      // Résout la zone déjà enregistrée directement par son id (pas via le
      // pays "prêt" — voir PartnerProfileScreen pour le même correctif) pour
      // retrouver son pays et présélectionner les trois niveaux d'un coup.
      final profile = await _client.getProfile();
      final homeZoneId = profile.homeZoneId;
      if (homeZoneId != null) {
        final zone = await _countriesRepo.getZone(homeZoneId);
        if (zone.countryId != null) {
          setState(() => _selectedCountryId = zone.countryId);
          await _loadZones(zone.countryId!, preselect: zone);
        }
      }
    } catch (e) {
      setState(() => _countriesError = e is ApiException ? e.message : e.toString());
    } finally {
      if (mounted) setState(() => _loadingCountries = false);
    }
  }

  Future<void> _loadZones(String countryId, {Zone? preselect}) async {
    setState(() {
      _loadingZones = true;
      _zonesError = null;
    });
    try {
      final zones = await _countriesRepo.listZones(countryId);
      setState(() {
        _zones = zones;
        _selectedCity = preselect?.cityName;
        _selectedZoneId = preselect?.id;
      });
    } catch (e) {
      setState(() => _zonesError = e is ApiException ? e.message : e.toString());
    } finally {
      if (mounted) setState(() => _loadingZones = false);
    }
  }

  void _onCountryChanged(String? countryId) {
    if (countryId == null) return;
    setState(() {
      _selectedCountryId = countryId;
      _zones = [];
      _selectedCity = null;
      _selectedZoneId = null;
      _zoneSaveMessage = null;
    });
    _loadZones(countryId);
  }

  List<String> get _cities => _zones.map((z) => z.cityName).toSet().toList()..sort();

  List<Zone> get _zonesForSelectedCity =>
      _zones.where((z) => z.cityName == _selectedCity).toList()..sort((a, b) => a.name.compareTo(b.name));

  Future<void> _saveZone() async {
    if (_selectedZoneId == null) return;
    setState(() {
      _savingZone = true;
      _zoneSaveMessage = null;
      _zonesError = null;
    });
    try {
      await _client.updateHomeZone(_selectedZoneId!);
      setState(() => _zoneSaveMessage = 'Pays, ville et quartier mis à jour.');
    } on ApiException catch (e) {
      setState(() => _zonesError = e.message);
    } finally {
      if (mounted) setState(() => _savingZone = false);
    }
  }

  Future<void> _changePassword() async {
    setState(() {
      _passwordError = null;
      _passwordSuccess = null;
    });
    if (_newPasswordController.text.length < 8) {
      setState(() => _passwordError = 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      setState(() => _passwordError = 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    setState(() => _savingPassword = true);
    try {
      await _auth.changePassword(
        currentPassword: _currentPasswordController.text,
        newPassword: _newPasswordController.text,
      );
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
      setState(() => _passwordSuccess = 'Mot de passe modifié.');
    } on ApiException catch (e) {
      setState(() => _passwordError = e.message);
    } finally {
      if (mounted) setState(() => _savingPassword = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mon profil')),
      body: SafeArea(
        child: ListView(
          padding: IrisTheme.pagePadding,
          children: [
            Text('Pays, ville et quartier', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (_loadingCountries)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else if (_countriesError != null) ...[
              InlineMessage.error(_countriesError!),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: _loadInitial, child: const Text('Réessayer')),
            ] else ...[
              DropdownButtonFormField<String>(
                initialValue: _selectedCountryId,
                decoration: const InputDecoration(labelText: 'Pays'),
                items: _countries.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                onChanged: _onCountryChanged,
              ),
              const SizedBox(height: 12),
              if (_loadingZones)
                const LinearProgressIndicator()
              else if (_zonesError != null) ...[
                InlineMessage.error(_zonesError!),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => _selectedCountryId == null ? null : _loadZones(_selectedCountryId!),
                  child: const Text('Réessayer'),
                ),
              ] else if (_selectedCountryId != null && _zones.isEmpty) ...[
                const InlineMessage.info('Aucune zone configurée pour ce pays pour le moment.'),
              ] else if (_selectedCountryId != null) ...[
                DropdownButtonFormField<String>(
                  initialValue: _selectedCity,
                  decoration: const InputDecoration(labelText: 'Ville'),
                  items: _cities.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      _selectedCity = value;
                      final zonesForCity = _zones.where((z) => z.cityName == value).toList();
                      _selectedZoneId = zonesForCity.isNotEmpty ? zonesForCity.first.id : null;
                    });
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedZoneId,
                  decoration: const InputDecoration(labelText: 'Quartier'),
                  items: _zonesForSelectedCity.map((z) => DropdownMenuItem(value: z.id, child: Text(z.name))).toList(),
                  onChanged: (value) => setState(() => _selectedZoneId = value),
                ),
              ],
              const SizedBox(height: 16),
              LoadingFilledButton(
                onPressed: _selectedZoneId == null ? null : _saveZone,
                busy: _savingZone,
                label: 'Enregistrer',
              ),
              if (_zoneSaveMessage != null) ...[
                const SizedBox(height: 12),
                InlineMessage.success(_zoneSaveMessage!),
              ],
            ],
            const Divider(height: 40),
            Text('Changer le mot de passe', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextField(
              controller: _currentPasswordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mot de passe actuel'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newPasswordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Nouveau mot de passe (8 caractères min.)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmPasswordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirmer le nouveau mot de passe'),
            ),
            const SizedBox(height: 16),
            LoadingFilledButton(
              onPressed: _changePassword,
              busy: _savingPassword,
              label: 'Changer le mot de passe',
            ),
            if (_passwordError != null) ...[
              const SizedBox(height: 12),
              InlineMessage.error(_passwordError!),
            ],
            if (_passwordSuccess != null) ...[
              const SizedBox(height: 12),
              InlineMessage.success(_passwordSuccess!),
            ],
          ],
        ),
      ),
    );
  }
}
