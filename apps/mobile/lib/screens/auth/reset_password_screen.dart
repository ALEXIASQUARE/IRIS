import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_state.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/loading_button.dart';

// Mot de passe oublié, étape 2 : code + nouveau mot de passe. En cas de
// succès, la session s'ouvre automatiquement (voir AuthState.resetPassword)
// — pas besoin de se reconnecter séparément avec le nouveau mot de passe.
class ResetPasswordScreen extends StatefulWidget {
  final String phone;
  // Renvoyé par le backend uniquement en dev (OTP_PROVIDER=mock).
  final String? devOtp;

  const ResetPasswordScreen({super.key, required this.phone, this.devOtp});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  late final TextEditingController _codeController;
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController(text: widget.devOtp ?? '');
  }

  @override
  void dispose() {
    _codeController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_newPasswordController.text.length < 8) {
      setState(() => _error = 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      setState(() => _error = 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    setState(() => _submitting = true);
    try {
      await context.read<AuthState>().resetPassword(
            phone: widget.phone,
            code: _codeController.text.trim(),
            newPassword: _newPasswordController.text,
          );
      // AppRoot (main.dart) écoute AuthState et bascule automatiquement vers
      // l'espace client/partenaire/admin une fois la session ouverte.
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Réinitialiser le mot de passe')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: IrisTheme.pagePadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Un code a été envoyé au ${widget.phone}.', style: text.bodyLarge),
              if (widget.devOtp != null) ...[
                const SizedBox(height: 12),
                const InlineMessage.info('Mode dev : le code est pré-rempli automatiquement.'),
              ],
              const SizedBox(height: 24),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Code de vérification'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _newPasswordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Nouveau mot de passe (8 caractères min.)'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _confirmPasswordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirmer le nouveau mot de passe'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                InlineMessage.error(_error!),
              ],
              const SizedBox(height: 24),
              LoadingFilledButton(
                onPressed: _submit,
                busy: _submitting,
                label: 'Réinitialiser et se connecter',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
