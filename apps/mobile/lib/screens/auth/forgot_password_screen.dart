import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_repository.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/loading_button.dart';
import 'reset_password_screen.dart';

// Mot de passe oublié, étape 1 : demande d'un code par SMS. Même structure
// que RegisterScreen -> VerifyOtpScreen.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phoneController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Entrez votre numéro de téléphone.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repository = AuthRepository(context.read<ApiClient>());
      final result = await repository.requestPasswordReset(phone: phone);
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ResetPasswordScreen(phone: phone, devOtp: result.devOtp)),
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
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Mot de passe oublié')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: IrisTheme.pagePadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Entrez le numéro de téléphone de votre compte. Un code vous sera envoyé par SMS.',
                style: text.bodyLarge,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submitting ? null : _submit(),
                decoration: const InputDecoration(labelText: 'Téléphone', hintText: '+237600000000'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                InlineMessage.error(_error!),
              ],
              const SizedBox(height: 24),
              LoadingFilledButton(
                onPressed: _submit,
                busy: _submitting,
                label: 'Recevoir un code',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
