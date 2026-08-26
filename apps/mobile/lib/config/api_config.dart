class ApiConfig {
  // Backend NestJS déployé sur Railway (voir apps/backend/Dockerfile) —
  // joignable depuis n'importe quel réseau (mobile data, wifi), plus besoin
  // d'être sur le même réseau local que la machine de dev. Base de données
  // et catalogue (pays/villes/quartiers) répliqués sur cette instance.
  static const String baseUrl = 'https://backend-production-21788.up.railway.app/api/v1';
}
