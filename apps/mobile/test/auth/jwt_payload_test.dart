import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:iris_mobile/auth/jwt_payload.dart';

// Décodage local du payload JWT — uniquement pour orienter la navigation
// (espace client vs partenaire), jamais pour l'autorisation elle-même (le
// backend revalide toujours). Réplique ici le payload réellement émis par
// AuthService.issueTokens côté backend : { sub, role }.

String _fakeJwt(Map<String, dynamic> payload) {
  String segment(Object data) => base64Url.encode(utf8.encode(jsonEncode(data))).replaceAll('=', '');
  return '${segment({
        'alg': 'HS256'
      })}.${segment(payload)}.signature-not-checked-client-side';
}

void main() {
  test('décode sub et role depuis un token bien formé', () {
    final token = _fakeJwt({'sub': 'user-123', 'role': 'CLIENT'});

    final payload = JwtPayload.decode(token);

    expect(payload.sub, 'user-123');
    expect(payload.role, 'CLIENT');
  });

  test('décode correctement un rôle PARTNER', () {
    final token = _fakeJwt({'sub': 'user-456', 'role': 'PARTNER'});

    final payload = JwtPayload.decode(token);

    expect(payload.role, 'PARTNER');
  });

  test("lève une FormatException si le token n'a pas 3 segments", () {
    expect(() => JwtPayload.decode('pas.un.jwt.valide.avec.trop.de.points'), throwsFormatException);
    expect(() => JwtPayload.decode('deux.segments'), throwsFormatException);
  });

  test('décode un payload dont la longueur base64url nécessite un padding', () {
    // 'sub' volontairement court pour forcer un décalage de padding différent.
    final token = _fakeJwt({'sub': 'a', 'role': 'ADMIN'});

    final payload = JwtPayload.decode(token);

    expect(payload.sub, 'a');
    expect(payload.role, 'ADMIN');
  });
}
