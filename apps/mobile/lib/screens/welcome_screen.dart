import 'package:flutter/material.dart';
import 'auth/login_screen.dart';
import '../widgets/iris_logo.dart';

// Écran racine quand personne n'est connecté — équivalent mobile des
// onglets "Espace client" / "Espace partenaire" du Testeur web
// (apps/admin-web/src/App.tsx), mais orienté choix avant connexion plutôt
// qu'onglets après.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              scheme.primaryContainer.withValues(alpha: 0.45),
              scheme.surface,
            ],
            stops: const [0, 0.55],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(flex: 3),
                const Center(child: IrisLogo(size: 104)),
                const SizedBox(height: 28),
                Text(
                  'IRIS',
                  style: text.displaySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  'Laverie, repassage, ménage — à domicile',
                  style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
                const Spacer(flex: 4),
                FilledButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen(intendedRole: 'CLIENT')),
                  ),
                  child: const Text('Je suis client'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen(intendedRole: 'PARTNER')),
                  ),
                  child: const Text('Je suis partenaire'),
                ),
                const SizedBox(height: 8),
                Text(
                  'Douala · Cameroun',
                  style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
