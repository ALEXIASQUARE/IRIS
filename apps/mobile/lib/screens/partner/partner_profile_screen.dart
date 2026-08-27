import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/country.dart';
import '../../models/zone.dart';
import '../../partners/partners_repository.dart';

// Répond à un retour terrain (Dschang) : la ville/le quartier n'étaient
// jamais demandés à l'inscription, et rien ne permettait de les corriger ni
// de changer de mot de passe ensuite. Le sélecteur Pays a été ajouté après
// coup (voir retour "ajoute la rubrique pays dans les profils") : sans lui,
// la ville/le quartier n'étaient choisissables que dans le seul pays "prêt"
// (celui avec un catalogue de services actif, toujours le Cameroun) — un
// partenaire réellement basé ailleurs (ex: le compte de test belge) ne
// pouvait pas indiquer sa vraie zone.
class PartnerProfileScreen extends StatefulWidget {
  final String? currentZoneId;
  final void Function(Zone newZone) onZoneChanged;

  const PartnerProfileScreen({super.key, required this.currentZoneId, required this.onZoneChanged});

  @override
  State<PartnerProfileScreen> createState() => _PartnerProfileScreenState();
}

class _PartnerProfileScreenState extends State<PartnerProfileScreen> {
  late final PartnersRepository _partners;
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
    final client = context.read<ApiClient>();
    _partners = PartnersRepository(client);
    _countriesRepo = CountriesRepository(client);
    _auth = AuthRepository(client);
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

      // Si une zone est déjà enregistrée, on la résout directement par son
      // id (pas via le pays "prêt" — voir PartnerHomeScreen._init pour le
      // même correctif) pour retrouver son pays et présélectionner les
      // trois niveaux d'un coup.
      final currentZoneId = widget.currentZoneId;
      if (currentZoneId != null) {
        final zone = await _countriesRepo.getZone(currentZoneId);
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
      await _partners.upsertProfile(currentZoneId: _selectedZoneId!);
      final zone = _zones.firstWhere((z) => z.id == _selectedZoneId);
      widget.onZoneChanged(zone);
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
          padding: const EdgeInsets.all(16),
          children: [
            Text('Pays, ville et quartier', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (_loadingCountries)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else if (_countriesError != null) ...[
              Text(_countriesError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
                Text(_zonesError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => _selectedCountryId == null ? null : _loadZones(_selectedCountryId!),
                  child: const Text('Réessayer'),
                ),
              ] else if (_selectedCountryId != null && _zones.isEmpty) ...[
                Text(
                  'Aucune zone configurée pour ce pays pour le moment.',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
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
              const SizedBox(height: 12),
              FilledButton(
                onPressed: (_savingZone || _selectedZoneId == null) ? null : _saveZone,
                child: _savingZone
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Enregistrer'),
              ),
              if (_zoneSaveMessage != null) ...[
                const SizedBox(height: 8),
                Text(_zoneSaveMessage!, style: TextStyle(color: Theme.of(context).colorScheme.primary)),
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
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _savingPassword ? null : _changePassword,
              child: _savingPassword
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Changer le mot de passe'),
            ),
            if (_passwordError != null) ...[
              const SizedBox(height: 8),
              Text(_passwordError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            if (_passwordSuccess != null) ...[
              const SizedBox(height: 8),
              Text(_passwordSuccess!, style: TextStyle(color: Theme.of(context).colorScheme.primary)),
            ],
          ],
        ),
      ),
    );
  }
}
