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
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: IrisLogo()),
              const SizedBox(height: 24),
              Text(
                'IRIS',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Laverie, repassage, ménage — à domicile',
                style: Theme.of(context).textTheme.bodyLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              FilledButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen(intendedRole: 'CLIENT')),
                ),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('Je suis client'),
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen(intendedRole: 'PARTNER')),
                ),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('Je suis partenaire'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
