import 'dart:io' show Platform;

class ApiConfig {
  // Backend NestJS — voir apps/backend/README. Testé ici depuis un
  // téléphone Android physique (aucun émulateur configuré dans cet
  // environnement WSL), donc l'IP LAN réelle de la machine de dev est
  // nécessaire — "localhost"/10.0.2.2 (adresse spéciale de l'émulateur) ne
  // fonctionnent pas depuis un vrai appareil. À adapter si l'IP de la
  // machine de dev change, ou à sortir vers une config par build si
  // plusieurs personnes testent depuis des réseaux différents.
  static const String _devMachineLanIp = '192.168.129.16';

  static String get baseUrl {
    if (!Platform.isAndroid) {
      return 'http://localhost:3000/api/v1';
    }
    return 'http://$_devMachineLanIp:3000/api/v1';
  }
}
