import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/country.dart';
import '../../models/zone.dart';
import 'verify_otp_screen.dart';

class RegisterScreen extends StatefulWidget {
  final String role; // 'CLIENT' | 'PARTNER'

  const RegisterScreen({super.key, required this.role});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  late final CountriesRepository _countriesRepo;
  bool get _isPartner => widget.role == 'PARTNER';

  List<Country> _countries = [];
  bool _loadingCountries = true;
  String? _countriesError;
  String? _selectedCountryIso;

  // Ville/quartier — demandé uniquement pour un partenaire (§ retour terrain
  // Dschang : sans ça, le profil recevait une zone par défaut sans jamais la
  // demander, voir aussi PartnerProfileScreen pour la correction a posteriori).
  List<Zone> _zones = [];
  bool _loadingZones = false;
  String? _zonesError;
  String? _selectedCity;
  String? _selectedZoneId;

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _countriesRepo = CountriesRepository(context.read<ApiClient>());
    _loadCountries();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadCountries() async {
    setState(() {
      _loadingCountries = true;
      _countriesError = null;
    });
    try {
      final countries = await _countriesRepo.listCountries();
      setState(() => _countries = countries);
    } catch (e) {
      setState(() => _countriesError = e is ApiException ? e.message : e.toString());
    } finally {
      if (mounted) setState(() => _loadingCountries = false);
    }
  }

  void _onCountryChanged(String? value) {
    setState(() {
      _selectedCountryIso = value;
      _zones = [];
      _zonesError = null;
      _selectedCity = null;
      _selectedZoneId = null;
    });
    if (value != null && _isPartner) {
      _loadZones(value);
    }
  }

  Future<void> _loadZones(String isoCode) async {
    final country = _countries.firstWhere((c) => c.isoCode == isoCode);
    setState(() {
      _loadingZones = true;
      _zonesError = null;
    });
    try {
      final zones = await _countriesRepo.listZones(country.id);
      // Ne JAMAIS présélectionner une ville/un quartier : la liste est triée
      // alphabétiquement par nom de quartier (toutes villes confondues) côté
      // backend, pas groupée par ville — "Abang" (Ebolowa) se trouve être en
      // tête de liste pour le Cameroun. Une présélection revenait à inscrire
      // silencieusement le partenaire à Ebolowa dès qu'il ne remarquait pas
      // qu'il fallait changer les deux menus (retour terrain : "dès qu'un
      // partenaire se connecte, il apparaît automatiquement la zone Abang").
      setState(() => _zones = zones);
    } catch (e) {
      setState(() => _zonesError = e is ApiException ? e.message : e.toString());
    } finally {
      if (mounted) setState(() => _loadingZones = false);
    }
  }

  List<String> get _cities => _zones.map((z) => z.cityName).toSet().toList()..sort();

  List<Zone> get _zonesForSelectedCity =>
      _zones.where((z) => z.cityName == _selectedCity).toList()..sort((a, b) => a.name.compareTo(b.name));

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCountryIso == null) {
      setState(() => _error = 'Choisissez un pays.');
      return;
    }
    if (_isPartner && _selectedZoneId == null) {
      setState(() => _error = 'Choisissez votre ville et votre quartier.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repository = AuthRepository(context.read<ApiClient>());
      final result = await repository.register(
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        phone: _phoneController.text.trim(),
        password: _passwordController.text,
        countryCode: _selectedCountryIso!,
        email: _emailController.text.trim(),
        role: widget.role,
        zoneId: _isPartner ? _selectedZoneId : null,
      );
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => VerifyOtpScreen(phone: _phoneController.text.trim(), devOtp: result.devOtp),
          ),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Créer un compte')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _firstNameController,
                  decoration: const InputDecoration(labelText: 'Prénom'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _lastNameController,
                  decoration: const InputDecoration(labelText: 'Nom'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Téléphone', hintText: '+237600000000'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'E-mail (optionnel)'),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Mot de passe (8 caractères min.)'),
                  validator: (v) => (v == null || v.length < 8) ? 'Au moins 8 caractères' : null,
                ),
                const SizedBox(height: 16),
                if (_loadingCountries)
                  const LinearProgressIndicator()
                else if (_countriesError != null) ...[
                  Text(_countriesError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: _loadCountries, child: const Text('Réessayer')),
                ] else
                  DropdownButtonFormField<String>(
                    initialValue: _selectedCountryIso,
                    decoration: const InputDecoration(labelText: 'Pays'),
                    items: _countries.map((c) => DropdownMenuItem(value: c.isoCode, child: Text(c.name))).toList(),
                    onChanged: _onCountryChanged,
                  ),
                if (_isPartner && _selectedCountryIso != null) ...[
                  const SizedBox(height: 16),
                  if (_loadingZones)
                    const LinearProgressIndicator()
                  else if (_zonesError != null) ...[
                    Text(_zonesError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => _loadZones(_selectedCountryIso!),
                      child: const Text('Réessayer'),
                    ),
                  ] else if (_zones.isEmpty) ...[
                    Text(
                      'Aucune zone configurée pour ce pays pour le moment.',
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
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
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedZoneId,
                      decoration: const InputDecoration(labelText: 'Quartier'),
                      items: _zonesForSelectedCity
                          .map((z) => DropdownMenuItem(value: z.id, child: Text(z.name)))
                          .toList(),
                      onChanged: (value) => setState(() => _selectedZoneId = value),
                    ),
                  ],
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: _submitting
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text("S'inscrire"),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
