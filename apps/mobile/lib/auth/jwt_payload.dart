import 'dart:convert';

class JwtPayload {
  final String sub;
  final String role;

  JwtPayload({required this.sub, required this.role});

  // Décodage local uniquement pour orienter la navigation (espace client vs
  // partenaire) — jamais utilisé pour l'autorisation elle-même : le backend
  // revalide toujours le token à chaque requête (voir JwtStrategy.validate
  // côté backend, qui recharge l'utilisateur depuis la base).
  static JwtPayload decode(String token) {
    final parts = token.split('.');
    if (parts.length != 3) {
      throw const FormatException('Token JWT invalide.');
    }
    final normalized = base64Url.normalize(parts[1]);
    final payloadMap = jsonDecode(utf8.decode(base64Url.decode(normalized))) as Map<String, dynamic>;
    return JwtPayload(sub: payloadMap['sub'] as String, role: payloadMap['role'] as String);
  }
}
