import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_state.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Vérification du code')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Un code a été envoyé au ${widget.phone}.'),
              if (widget.devOtp != null) ...[
                const SizedBox(height: 8),
                Text(
                  '(Mode dev : code pré-rempli automatiquement.)',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              const SizedBox(height: 24),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Code de vérification'),
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
                      : const Text('Vérifier'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
