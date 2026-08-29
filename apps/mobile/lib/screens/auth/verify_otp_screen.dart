import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_state.dart';
import '../../theme.dart';
import '../../widgets/inline_message.dart';
import '../../widgets/loading_button.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String phone;
  // Renvoyé par le backend uniquement en dev (OTP_PROVIDER=mock) — voir
  // AuthService.register. Ne jamais s'attendre à ce champ en production.
  final String? devOtp;

  const VerifyOtpScreen({super.key, required this.phone, this.devOtp});

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  late final TextEditingController _codeController;
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
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().verifyOtp(phone: widget.phone, code: _codeController.text.trim());
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
      appBar: AppBar(title: const Text('Vérification du code')),
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
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submitting ? null : _submit(),
                decoration: const InputDecoration(labelText: 'Code de vérification'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                InlineMessage.error(_error!),
              ],
              const SizedBox(height: 24),
              LoadingFilledButton(
                onPressed: _submit,
                busy: _submitting,
                label: 'Vérifier',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
