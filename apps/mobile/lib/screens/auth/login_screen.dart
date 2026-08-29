import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_state.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/iris_logo.dart';
import '../../widgets/loading_button.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  final String intendedRole; // 'CLIENT' | 'PARTNER' — pré-sélectionne le rôle à l'inscription.

  const LoginScreen({super.key, required this.intendedRole});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().login(
            phone: _phoneController.text.trim(),
            password: _passwordController.text,
          );
      // AppRoot (main.dart) écoute AuthState et bascule automatiquement
      // vers l'espace client/partenaire une fois authentifié.
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPartner = widget.intendedRole == 'PARTNER';
    return Scaffold(
      appBar: AppBar(title: Text(isPartner ? 'Connexion partenaire' : 'Connexion client')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: IrisTheme.pagePadding,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),
                const Center(child: IrisLogo(size: 72)),
                const SizedBox(height: 28),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Téléphone', hintText: '+237600000000'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submitting ? null : _submit(),
                  decoration: const InputDecoration(labelText: 'Mot de passe'),
                  validator: (v) => (v == null || v.isEmpty) ? 'Requis' : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  InlineMessage.error(_error!),
                ],
                const SizedBox(height: 24),
                LoadingFilledButton(
                  onPressed: _submit,
                  busy: _submitting,
                  label: 'Se connecter',
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => RegisterScreen(role: widget.intendedRole)),
                  ),
                  child: const Text('Créer un compte'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                  ),
                  child: const Text('Mot de passe oublié ?'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
