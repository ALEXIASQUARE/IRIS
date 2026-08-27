import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'api/api_client.dart';
import 'auth/auth_repository.dart';
import 'auth/auth_state.dart';
import 'screens/client/client_home_screen.dart';
import 'screens/partner/partner_home_screen.dart';
import 'screens/welcome_screen.dart';
import 'theme.dart';
import 'update/update_checker.dart';
import 'update/update_dialog.dart';

void main() {
  runApp(const IrisApp());
}

class IrisApp extends StatelessWidget {
  const IrisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>(create: (_) => ApiClient()),
        ProxyProvider<ApiClient, AuthRepository>(
          update: (_, client, _) => AuthRepository(client),
        ),
        ChangeNotifierProxyProvider<AuthRepository, AuthState>(
          create: (context) => AuthState(
            apiClient: context.read<ApiClient>(),
            authRepository: context.read<AuthRepository>(),
          )..restoreSession(),
          update: (_, _, previous) => previous!,
        ),
      ],
      child: MaterialApp(
        title: 'IRIS',
        debugShowCheckedModeBanner: false,
        theme: IrisTheme.light(),
        darkTheme: IrisTheme.dark(),
        home: const AppRoot(),
      ),
    );
  }
}

// Bascule automatiquement entre écran d'accueil, espace client et espace
// partenaire selon l'état d'authentification — même principe que
// AppInner (apps/admin-web/src/App.tsx), adapté à un flux mobile
// (écran plein, pas d'onglets côte à côte).
class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  bool _updateChecked = false;

  // Une seule vérification par lancement de l'app, une fois le premier
  // frame affiché (showDialog a besoin d'un BuildContext déjà monté sous
  // le MaterialApp) — voir update/update_checker.dart. Ne dépend pas de
  // l'authentification : un partenaire ou un client bloqué sur l'écran
  // d'accueil doit aussi être prévenu.
  void _maybeCheckForUpdate() {
    if (_updateChecked) return;
    _updateChecked = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final update = await UpdateChecker.checkForUpdate();
      if (update != null && mounted) {
        await showUpdateDialog(context, update);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    _maybeCheckForUpdate();
    final auth = context.watch<AuthState>();

    if (auth.isRestoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!auth.isAuthenticated) {
      return const WelcomeScreen();
    }
    switch (auth.role) {
      case 'CLIENT':
        return const ClientHomeScreen();
      case 'PARTNER':
        return const PartnerHomeScreen();
      default:
        return Scaffold(
          appBar: AppBar(title: const Text('Rôle non pris en charge')),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Ce rôle (${auth.role}) n\'a pas d\'espace mobile — utilisez l\'admin web.'),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => auth.logout(),
                    child: const Text('Se déconnecter'),
                  ),
                ],
              ),
            ),
          ),
        );
    }
  }
}
