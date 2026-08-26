import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'api_exception.dart';

// Client HTTP unique pour tout le backend IRIS. Le token d'accès est injecté
// par AuthState après connexion — voir auth/auth_state.dart.
class ApiClient {
  final http.Client _http;
  final Duration _timeout;
  String? accessToken;

  // Branché par AuthState après connexion (voir auth/auth_state.dart) :
  // appelé sur un 401, doit tenter un rafraîchissement de session et
  // renvoyer true si un nouveau token a été appliqué (auquel cas la requête
  // d'origine est rejouée une seule fois), false sinon (session vraiment
  // terminée — l'appelant reçoit alors le 401 d'origine).
  //
  // Corrige un manque réel : sans ça, un token d'accès expiré (15 min)
  // laissait l'app bloquée sur "Unauthorized" indéfiniment, sans recours
  // (voir GET /bookings/:id lors du suivi d'une réservation).
  Future<bool> Function()? onUnauthorized;

  // http.Client et timeout injectables pour les tests (voir
  // test/api/api_client_test.dart) ; en production, un vrai client et un
  // délai de 15s sont utilisés si non fournis.
  ApiClient({http.Client? httpClient, Duration? timeout})
      : _http = httpClient ?? http.Client(),
        _timeout = timeout ?? const Duration(seconds: 15);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (accessToken != null) 'Authorization': 'Bearer $accessToken',
      };

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, {Object? body}) => _send('POST', path, body: body);
  Future<dynamic> patch(String path, {Object? body}) => _send('PATCH', path, body: body);

  Future<dynamic> _send(String method, String path, {Object? body, bool isRetry = false}) async {
    final uri = _uri(path);
    final encodedBody = body != null ? jsonEncode(body) : null;

    http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await _http.get(uri, headers: _headers).timeout(_timeout);
          break;
        case 'POST':
          response = await _http.post(uri, headers: _headers, body: encodedBody).timeout(_timeout);
          break;
        case 'PATCH':
          response = await _http.patch(uri, headers: _headers, body: encodedBody).timeout(_timeout);
          break;
        default:
          throw UnsupportedError('Méthode non supportée : $method');
      }
    } on TimeoutException {
      // Sans ce timeout explicite, une requête vers un serveur injoignable
      // (mauvais réseau, IP obsolète...) restait bloquée indéfiniment côté
      // UI, sans jamais afficher d'erreur — voir écran d'inscription (champ
      // Pays qui tournait en rond sans fin).
      throw ApiException(0, 'Le serveur ne répond pas. Vérifiez votre connexion et réessayez.');
    } on SocketException {
      throw ApiException(0, 'Impossible de joindre le serveur. Vérifiez votre connexion.');
    }

    final decoded = response.body.isNotEmpty ? jsonDecode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }

    if (response.statusCode == 401 && !isRetry && onUnauthorized != null) {
      final refreshed = await onUnauthorized!();
      if (refreshed) {
        return _send(method, path, body: body, isRetry: true);
      }
    }

    throw ApiException(response.statusCode, _extractMessage(decoded));
  }

  // Le format d'erreur de AllExceptionsFilter (backend) est
  // { statusCode, timestamp, message } où `message` reprend tel quel le
  // getResponse() de l'exception Nest d'origine — donc lui-même souvent un
  // objet { statusCode, message, error } (cas standard des exceptions
  // Nest/class-validator). On déplie les deux niveaux possibles.
  String _extractMessage(dynamic body) {
    if (body is! Map) return 'Erreur inconnue.';
    final outer = body['message'];
    if (outer is Map && outer['message'] != null) {
      final inner = outer['message'];
      if (inner is List) return inner.join('\n');
      return inner.toString();
    }
    if (outer is List) return outer.join('\n');
    if (outer != null) return outer.toString();
    return 'Erreur inconnue.';
  }
}
