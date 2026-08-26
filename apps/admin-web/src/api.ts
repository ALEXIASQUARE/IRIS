// VITE_API_BASE_URL permet de pointer le Testeur vers le backend déployé
// (Railway) plutôt que le backend local — nécessaire par exemple pour
// approuver un partenaire inscrit depuis l'app mobile en conditions réelles
// (réseau différent de la machine de dev, donc backend public).
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {}

// Le format de réponse d'erreur d'AllExceptionsFilter (backend) est
// { statusCode, timestamp, message } où `message` reprend tel quel
// exception.getResponse() — donc lui-même souvent un objet
// { statusCode, message, error } pour une HttpException construite avec une
// simple chaîne (cas standard Nest). Sans déplier ce second niveau, tous les
// messages d'erreur précis du backend étaient remplacés par le message
// générique ci-dessous, quelle que soit l'erreur réelle.
function extractMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(' ');
    if (m && typeof m === 'object' && 'message' in m) {
      const inner = (m as { message: unknown }).message;
      if (typeof inner === 'string') return inner;
      if (Array.isArray(inner)) return inner.join(' ');
    }
  }
  return 'Une erreur est survenue.';
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: { body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(extractMessage(data));
  }
  return data as T;
}
