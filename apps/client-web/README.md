# apps/client-web — Espace client IRIS (web)

Application client de production, distincte du « Testeur » (`apps/admin-web`).
React 19 + Vite + TypeScript + React Router.

## État

**Fondation (étapes 1–2) :**

- Routage (`react-router-dom`) : `/login`, `/register`, `/forgot-password`
  (public) ; `/`, `/booking`, `/status/:id`, `/profile` (protégés).
- Session : `AuthProvider` + `useAuth()`, jetons `{accessToken, refreshToken}`
  en `localStorage`.
- Client API (`src/api/client.ts`) : en-tête `Authorization` automatique,
  **rafraîchissement du token sur 401** (rejeu unique, refresh dédupliqué),
  purge + évènement `iris:auth-expired` si le refresh échoue.
- Garde de routes `RequireAuth`, coquille `AppLayout`, composants
  `Spinner` / `InlineMessage`.

**Parcours client (étapes 3–6) — portés depuis `apps/admin-web/src/client/`
et `apps/mobile` :**

- **Connexion / inscription + OTP / mot de passe oublié** — flux complets.
- **Réservation** (`BookingPage`) : résolution du quartier par défaut via le
  profil (`useResolvedLocation`), sélecteurs ville/quartier, panier laverie
  (article/tissu/lavage/salissure) ou formule horaire, option urgent, devis,
  adresse (enregistrée ou nouvelle + géoloc navigateur), planification,
  Mobile Money.
- **Suivi** (`StatusPage`) : sondage 3 s, PIN, confirmation de révision de
  prix, annulation, notation, signalement d'incident.
- **Profil** : pays/ville/quartier + changement de mot de passe.
- Notifications (carte sur l'accueil).

**Reste à faire** : carte de suivi en direct (Leaflet + OSRM, non incluse
pour éviter d'ajouter des dépendances lourdes) ; déploiement.

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

`Dockerfile` fourni : build Vite multi-étapes puis `nginx` qui sert `dist/`
avec repli SPA (`nginx.conf` — toute route → `index.html`).

- `VITE_API_BASE_URL` est **inliné au build** : valeur par défaut = backend
  de prod, surchargeable via un build arg Railway.
- Déploiement Railway : service dédié, *Root Directory* = `apps/client-web`,
  builder Dockerfile. Voir `docs/DEPLOY.md`.
- Une fois l'URL connue, l'ajouter à `CORS_ORIGINS` sur le service backend.
