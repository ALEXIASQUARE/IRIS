# apps/client-web — Espace client IRIS (web)

Application client de production, distincte du « Testeur » (`apps/admin-web`).
React 19 + Vite + TypeScript + React Router.

## État

**Étapes 1–2 (fondation) faites :**

- Routage (`react-router-dom`) : `/login`, `/register`, `/forgot-password`
  (public) ; `/`, `/booking`, `/status/:id`, `/profile` (protégés).
- Session : `AuthProvider` + `useAuth()`, jetons `{accessToken, refreshToken}`
  en `localStorage`.
- Client API (`src/api/client.ts`) : en-tête `Authorization` automatique,
  **rafraîchissement du token sur 401** (rejeu unique, refresh dédupliqué),
  purge + évènement `iris:auth-expired` si le refresh échoue.
- Garde de routes `RequireAuth` (mémorise la destination), coquille
  `AppLayout`, composants `Spinner` / `InlineMessage`.
- **Connexion** fonctionnelle. `register`, `forgot-password`, `booking`,
  `status`, `profile` sont des écrans placeholder.

**À faire (étapes 3–6)** : porter depuis `apps/admin-web/src/client/`
(`ClientAuth`, `ClientBooking`, `ClientStatus`) l'inscription + OTP, l'assistant
de réservation, le suivi, et le profil.

## Démarrage

```bash
cd apps/client-web
cp .env.example .env      # ajuste VITE_API_BASE_URL si besoin
npm install
npm run dev
```

`VITE_API_BASE_URL` par défaut : `http://localhost:3000/api/v1`.
Pour viser la prod : `https://backend-production-21788.up.railway.app/api/v1`.

## Build / déploiement

`npm run build` → `dist/` statique. Déployable sur n'importe quel hébergeur
de fichiers statiques (Railway static, Netlify, Vercel). Penser à :

- une règle de réécriture SPA (toutes les routes → `index.html`) ;
- restreindre `enableCors()` du backend à l'origine réelle du site.
