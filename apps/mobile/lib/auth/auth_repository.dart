import '../api/api_client.dart';
import '../models/auth_tokens.dart';

class RegisterResult {
  final String userId;
  final String message;
  // Uniquement renvoyé par le backend quand OTP_PROVIDER=mock (dev) — voir
  // AuthService.register côté backend.
  final String? devOtp;

  RegisterResult({required this.userId, required this.message, this.devOtp});
}

class AuthRepository {
  final ApiClient _client;

  AuthRepository(this._client);

  Future<RegisterResult> register({
    required String firstName,
    required String lastName,
    required String phone,
    required String password,
    required String countryCode,
    String? email,
    String? role,
    String? zoneId,
  }) async {
    final result = await _client.post('/auth/register', body: {
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      'password': password,
      'countryCode': countryCode,
      if (email != null && email.isNotEmpty) 'email': email,
      if (role != null) 'role': role,
      if (zoneId != null) 'zoneId': zoneId,
    }) as Map<String, dynamic>;

    return RegisterResult(
      userId: result['userId'] as String,
      message: result['message'] as String,
      devOtp: result['devOtp'] as String?,
    );
  }

  Future<AuthTokens> verifyOtp({required String phone, required String code}) async {
    final result = await _client.post('/auth/verify-otp', body: {'phone': phone, 'code': code});
    return AuthTokens.fromJson(result as Map<String, dynamic>);
  }

  Future<AuthTokens> login({required String phone, required String password}) async {
    final result = await _client.post('/auth/login', body: {'phone': phone, 'password': password});
    return AuthTokens.fromJson(result as Map<String, dynamic>);
  }

  // Corrige un manque backend : un token d'accès expiré (15 min) bloquait
  // la session sans recours avant l'ajout de POST /auth/refresh.
  Future<AuthTokens> refresh(String refreshToken) async {
    final result = await _client.post('/auth/refresh', body: {'refreshToken': refreshToken});
    return AuthTokens.fromJson(result as Map<String, dynamic>);
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) {
    return _client.patch('/auth/password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  // Mot de passe oublié, étape 1 — envoie un code par SMS au numéro du
  // compte. Même forme de réponse que register() (devOtp uniquement en dev).
  Future<RegisterResult> requestPasswordReset({required String phone}) async {
    final result = await _client.post('/auth/password-reset/request', body: {'phone': phone}) as Map<String, dynamic>;
    return RegisterResult(userId: '', message: result['message'] as String, devOtp: result['devOtp'] as String?);
  }

  // Mot de passe oublié, étape 2 — le code reçu par SMS ouvre directement la
  // session en cas de succès (voir AuthService.resetPassword côté backend).
  Future<AuthTokens> confirmPasswordReset({
    required String phone,
    required String code,
    required String newPassword,
  }) async {
    final result = await _client.post('/auth/password-reset/confirm', body: {
      'phone': phone,
      'code': code,
      'newPassword': newPassword,
    });
    return AuthTokens.fromJson(result as Map<String, dynamic>);
  }
}
