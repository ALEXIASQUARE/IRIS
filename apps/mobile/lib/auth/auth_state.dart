import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../models/auth_tokens.dart';
import 'auth_repository.dart';
import 'jwt_payload.dart';

// État d'authentification partagé dans toute l'app (via provider). Persiste
// les tokens en stockage sécurisé (Keychain/Keystore) — jamais en clair,
// cohérent avec l'invariant §13 déjà respecté côté backend.
class AuthState extends ChangeNotifier {
  static const _accessKey = 'iris_access_token';
  static const _refreshKey = 'iris_refresh_token';

  final ApiClient apiClient;
  final AuthRepository authRepository;
  final _storage = const FlutterSecureStorage();

  AuthTokens? _tokens;
  String? _role;
  String? _userId;
  bool _restoring = true;
  bool _refreshing = false;

  AuthState({required this.apiClient, required this.authRepository}) {
    apiClient.onUnauthorized = _handleUnauthorized;
  }

  bool get isAuthenticated => _tokens != null;
  bool get isRestoring => _restoring;
  String? get role => _role;
  String? get userId => _userId;

  Future<void> restoreSession() async {
    final access = await _storage.read(key: _accessKey);
    final refresh = await _storage.read(key: _refreshKey);
    if (access != null && refresh != null) {
      _applyTokens(AuthTokens(accessToken: access, refreshToken: refresh));
    }
    _restoring = false;
    notifyListeners();
  }

  Future<void> login({required String phone, required String password}) async {
    final tokens = await authRepository.login(phone: phone, password: password);
    await _persistAndApply(tokens);
  }

  Future<void> verifyOtp({required String phone, required String code}) async {
    final tokens = await authRepository.verifyOtp(phone: phone, code: code);
    await _persistAndApply(tokens);
  }

  Future<void> logout() async {
    _tokens = null;
    _role = null;
    _userId = null;
    apiClient.accessToken = null;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    notifyListeners();
  }

  // Appelé par ApiClient sur un 401 — tente un rafraîchissement via le
  // refresh token stocké. Un garde-fou (`_refreshing`) évite une boucle
  // infinie si l'appel à /auth/refresh lui-même échoue en 401 (refresh
  // token expiré) : dans ce cas, on se contente de déconnecter proprement
  // plutôt que de laisser l'app bloquée sur "Unauthorized" pour toujours.
  Future<bool> _handleUnauthorized() async {
    if (_refreshing) return false;
    final refreshToken = _tokens?.refreshToken;
    if (refreshToken == null) {
      await logout();
      return false;
    }
    _refreshing = true;
    try {
      final newTokens = await authRepository.refresh(refreshToken);
      await _persistAndApply(newTokens);
      return true;
    } catch (_) {
      await logout();
      return false;
    } finally {
      _refreshing = false;
    }
  }

  Future<void> _persistAndApply(AuthTokens tokens) async {
    await _storage.write(key: _accessKey, value: tokens.accessToken);
    await _storage.write(key: _refreshKey, value: tokens.refreshToken);
    _applyTokens(tokens);
  }

  void _applyTokens(AuthTokens tokens) {
    _tokens = tokens;
    apiClient.accessToken = tokens.accessToken;
    final payload = JwtPayload.decode(tokens.accessToken);
    _role = payload.role;
    _userId = payload.sub;
    notifyListeners();
  }
}
