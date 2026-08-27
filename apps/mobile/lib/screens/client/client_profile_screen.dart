import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_repository.dart';
import '../../client/client_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/zone.dart';

// Pendant de PartnerProfileScreen côté client : le client n'avait aucun
// moyen d'indiquer ni de corriger sa ville/son quartier par défaut (utilisé
// pour préremplir la tarification et les nouvelles adresses — voir
// NewBookingScreen), ni de changer son mot de passe.
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
  late final CountriesRepository _countries;
  late final AuthRepository _auth;

  bool _loadingZones = true;
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
    _countries = CountriesRepository(apiClient);
    _auth = AuthRepository(apiClient);
    _loadZones();
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadZones() async {
    setState(() {
      _loadingZones = true;
      _zonesError = null;
    });
    try {
      final countryWithZones = await _countries.findFirstCountryWithZones();
      final profile = await _client.getProfile();
      final selected = countryWithZones.zones.firstWhere(
        (z) => z.id == profile.homeZoneId,
        orElse: () => countryWithZones.zones.first,
      );
      setState(() {
        _zones = countryWithZones.zones;
        _selectedCity = selected.cityName;
        _selectedZoneId = selected.id;
      });
    } catch (e) {
      setState(() => _zonesError = e is ApiException ? e.message : e.toString());
    } finally {
      if (mounted) setState(() => _loadingZones = false);
    }
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
      setState(() => _zoneSaveMessage = 'Ville et quartier mis à jour.');
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
            Text('Ville et quartier', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (_loadingZones)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else if (_zonesError != null) ...[
              Text(_zonesError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: _loadZones, child: const Text('Réessayer')),
            ] else ...[
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
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _savingZone ? null : _saveZone,
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
