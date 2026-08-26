import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:iris_mobile/api/api_client.dart';
import 'package:iris_mobile/api/api_exception.dart';

// Le format d'erreur du backend (AllExceptionsFilter) est
// { statusCode, timestamp, message } où `message` reprend tel quel
// exception.getResponse() — souvent lui-même { statusCode, message, error }
// (cas standard Nest/class-validator). _extractMessage() doit déplier ces
// deux niveaux ; c'est la logique la plus piégeuse du client, donc la plus
// utile à couvrir.

http.Response _jsonResponse(int status, Object? body) =>
    http.Response(body == null ? '' : jsonEncode(body), status);

void main() {
  test('GET renvoie le JSON décodé pour une réponse 2xx', () async {
    final client = ApiClient(
      httpClient: MockClient((request) async {
        expect(request.method, 'GET');
        return _jsonResponse(200, {'ok': true});
      }),
    );

    final result = await client.get('/anything');

    expect(result, {'ok': true});
  });

  test('envoie le header Authorization uniquement quand un token est défini', () async {
    http.Request? captured;
    final client = ApiClient(
      httpClient: MockClient((request) async {
        captured = request;
        return _jsonResponse(200, {});
      }),
    );

    await client.get('/no-token');
    expect(captured!.headers.containsKey('Authorization'), isFalse);

    client.accessToken = 'abc123';
    await client.get('/with-token');
    expect(captured!.headers['Authorization'], 'Bearer abc123');
  });

  test('renvoie null pour un corps de réponse vide (ex: 204)', () async {
    final client = ApiClient(httpClient: MockClient((request) async => http.Response('', 204)));

    final result = await client.get('/empty');

    expect(result, isNull);
  });

  test('lève ApiException avec le statusCode HTTP pour une réponse non-2xx', () async {
    final client = ApiClient(
      httpClient: MockClient((request) async => _jsonResponse(404, {
            'statusCode': 404,
            'message': {'statusCode': 404, 'message': 'Introuvable.', 'error': 'Not Found'},
          })),
    );

    await expectLater(
      client.get('/missing'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404)),
    );
  });

  test("déplie un message imbriqué simple (chaîne)", () async {
    final client = ApiClient(
      httpClient: MockClient((request) async => _jsonResponse(400, {
            'statusCode': 400,
            'message': {'statusCode': 400, 'message': 'Numéro de téléphone invalide.', 'error': 'Bad Request'},
          })),
    );

    await expectLater(
      client.get('/x'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Numéro de téléphone invalide.')),
    );
  });

  test('joint un message imbriqué multiple (tableau de validation) avec des retours à la ligne', () async {
    final client = ApiClient(
      httpClient: MockClient((request) async => _jsonResponse(400, {
            'statusCode': 400,
            'message': {
              'statusCode': 400,
              'message': ['phone must be a phone number', 'password too short'],
              'error': 'Bad Request',
            },
          })),
    );

    await expectLater(
      client.get('/x'),
      throwsA(isA<ApiException>().having(
        (e) => e.message,
        'message',
        'phone must be a phone number\npassword too short',
      )),
    );
  });

  test("se rabat sur le message de premier niveau s'il n'est pas imbriqué", () async {
    final client = ApiClient(
      httpClient: MockClient((request) async => _jsonResponse(500, {'statusCode': 500, 'message': 'Erreur serveur.'})),
    );

    await expectLater(
      client.get('/x'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Erreur serveur.')),
    );
  });

  test("renvoie un message générique si le corps n'est pas exploitable", () async {
    final client = ApiClient(httpClient: MockClient((request) async => http.Response('', 500)));

    await expectLater(
      client.get('/x'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Erreur inconnue.')),
    );
  });

  test('POST envoie le corps encodé en JSON', () async {
    http.Request? captured;
    final client = ApiClient(
      httpClient: MockClient((request) async {
        captured = request;
        return _jsonResponse(201, {'id': '1'});
      }),
    );

    await client.post('/things', body: {'name': 'test'});

    expect(captured!.method, 'POST');
    expect(jsonDecode(captured!.body), {'name': 'test'});
    expect(captured!.headers['Content-Type'], 'application/json');
  });

  // Régression : sans timeout explicite, une requête vers un serveur
  // injoignable restait bloquée indéfiniment côté UI sans jamais afficher
  // d'erreur (écran d'inscription, champ Pays qui tournait en rond sans
  // fin). timeout est injectable ici pour ne pas attendre 15s en test.
  test('lève ApiException avec un message clair en cas de dépassement du délai', () async {
    final client = ApiClient(
      httpClient: MockClient((request) async {
        await Future.delayed(const Duration(milliseconds: 50));
        return _jsonResponse(200, {});
      }),
      timeout: const Duration(milliseconds: 10),
    );

    await expectLater(
      client.get('/slow'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 0)),
    );
  });

  test('ne lève pas de timeout quand la réponse arrive avant le délai', () async {
    final client = ApiClient(
      httpClient: MockClient((request) async => _jsonResponse(200, {'ok': true})),
      timeout: const Duration(seconds: 5),
    );

    expect(await client.get('/fast'), {'ok': true});
  });

  // Régression : un token d'accès expiré (15 min) laissait l'app bloquée
  // sur "Unauthorized" pour toujours, faute de logique de rafraîchissement
  // — voir AuthState._handleUnauthorized, branché sur onUnauthorized.
  group('onUnauthorized', () {
    test('rejoue la requête une seule fois si onUnauthorized renvoie true', () async {
      var callCount = 0;
      final client = ApiClient(
        httpClient: MockClient((request) async {
          callCount++;
          return callCount == 1 ? _jsonResponse(401, {'message': 'expiré'}) : _jsonResponse(200, {'ok': true});
        }),
      );
      client.onUnauthorized = () async => true;

      final result = await client.get('/protected');

      expect(result, {'ok': true});
      expect(callCount, 2);
    });

    test('propage le 401 sans rejouer si onUnauthorized renvoie false', () async {
      var callCount = 0;
      final client = ApiClient(
        httpClient: MockClient((request) async {
          callCount++;
          return _jsonResponse(401, {'message': 'session terminée'});
        }),
      );
      client.onUnauthorized = () async => false;

      await expectLater(
        client.get('/protected'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
      );
      expect(callCount, 1);
    });

    test('ne boucle pas indéfiniment même si la requête rejouée renvoie encore 401', () async {
      var callCount = 0;
      final client = ApiClient(
        httpClient: MockClient((request) async {
          callCount++;
          return _jsonResponse(401, {'message': 'toujours invalide'});
        }),
      );
      client.onUnauthorized = () async => true; // rafraîchissement "réussi" mais le nouveau token est aussi rejeté.

      await expectLater(client.get('/protected'), throwsA(isA<ApiException>()));
      expect(callCount, 2); // requête initiale + une seule relance, jamais plus.
    });
  });
}
