import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import '../config/api_config.dart';
import 'update_info.dart';

// Vérification de mise à jour "best-effort" — voir main.ts useStaticAssets
// côté backend pour version.json/latest.apk. Pas d'installation silencieuse
// (Android ne le permet pas hors Play Store) : on ouvre l'APK dans le
// navigateur, qui le télécharge, puis l'utilisateur l'installe comme pour
// n'importe quel APK "sideloadé" (l'autorisation "sources inconnues" a déjà
// été accordée une première fois pour installer l'app elle-même).
class UpdateChecker {
  static Future<UpdateInfo?> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;

      final response = await http
          .get(Uri.parse('${ApiConfig.staticBaseUrl}/version.json'))
          .timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) return null;

      final update = UpdateInfo.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
      if (update.versionCode > currentBuildNumber) return update;
      return null;
    } catch (_) {
      // Best-effort : jamais bloquant pour le démarrage de l'app (réseau
      // indisponible, backend injoignable, etc.).
      return null;
    }
  }
}
