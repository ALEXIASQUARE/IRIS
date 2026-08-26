import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_repository.dart';
import '../../countries/countries_repository.dart';
import '../../models/country.dart';
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

  late Future<List<Country>> _countriesFuture;
  String? _selectedCountryIso;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final client = context.read<ApiClient>();
    _countriesFuture = CountriesRepository(client).listCountries();
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCountryIso == null) {
      setState(() => _error = 'Choisissez un pays.');
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
                FutureBuilder<List<Country>>(
                  future: _countriesFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState != ConnectionState.done) {
                      return const LinearProgressIndicator();
                    }
                    if (snapshot.hasError) {
                      return Text(
                        'Impossible de charger la liste des pays.',
                        style: TextStyle(color: Theme.of(context).colorScheme.error),
                      );
                    }
                    final countries = snapshot.data ?? [];
                    return DropdownButtonFormField<String>(
                      initialValue: _selectedCountryIso,
                      decoration: const InputDecoration(labelText: 'Pays'),
                      items: countries
                          .map((c) => DropdownMenuItem(value: c.isoCode, child: Text(c.name)))
                          .toList(),
                      onChanged: (value) => setState(() => _selectedCountryIso = value),
                    );
                  },
                ),
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
