import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iris_mobile/main.dart';

void main() {
  // flutter_secure_storage passe par un canal de plateforme natif, absent
  // du harnais de test — on le simule pour que AuthState.restoreSession()
  // (appelé au démarrage de l'app) ne lève pas de MissingPluginException.
  const secureStorageChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      secureStorageChannel,
      (MethodCall methodCall) async => null, // aucune session stockée -> écran d'accueil.
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      secureStorageChannel,
      null,
    );
  });

  testWidgets("affiche l'écran d'accueil quand aucune session n'est restaurée", (tester) async {
    await tester.pumpWidget(const IrisApp());
    await tester.pumpAndSettle();

    expect(find.text('IRIS'), findsOneWidget);
    expect(find.text('Je suis client'), findsOneWidget);
    expect(find.text('Je suis partenaire'), findsOneWidget);
  });
}
