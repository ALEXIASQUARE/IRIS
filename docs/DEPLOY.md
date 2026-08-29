# Déploiement

État : le **backend** + **MySQL** tournent déjà sur Railway (projet
`iris-backend`, environnement `production`). Ce document couvre l'ajout du
**site vitrine** (`apps/site`) et de **l'espace client web** (`apps/client-web`)
comme deux services statiques dans le même projet.

Chaque app a son `Dockerfile` :

| App | Build | Service |
|---|---|---|
| `apps/site` | aucun (statique pur) | `nginx` sert les fichiers |
| `apps/client-web` | `npm ci && npm run build` (Vite) | `nginx` sert `dist/` avec repli SPA |

`client-web` inline `VITE_API_BASE_URL` **au build** : la valeur par défaut du
`Dockerfile` est le backend de prod, donc rien à configurer pour démarrer.

> `railway up` envoie **tout le dépôt git** comme contexte de build (pas le
> dossier courant). D'où : chemins `COPY` préfixés par `apps/<app>/` dans les
> Dockerfiles, un `.dockerignore` racine pour alléger le contexte, et la
> variable de service `RAILWAY_DOCKERFILE_PATH=apps/<app>/Dockerfile` qui
> indique à Railway quel Dockerfile utiliser.

---

## Option A — CLI Railway (recommandé)

Prérequis : `railway whoami` doit répondre, et le repo doit être lié au bon
projet :

```
railway link --project iris-backend --environment production
```

Depuis la **racine du dépôt** pour chaque app :

```
railway add --service iris-site
railway variables --service iris-site --set "RAILWAY_DOCKERFILE_PATH=apps/site/Dockerfile"
railway up --service iris-site --detach
railway domain --service iris-site

railway add --service iris-client
railway variables --service iris-client --set "RAILWAY_DOCKERFILE_PATH=apps/client-web/Dockerfile"
railway up --service iris-client --detach
railway domain --service iris-client
```

Chaque `railway domain` génère et affiche l'URL `https://<svc>-production.up.railway.app`.

### 3. Restreindre le CORS du backend

Une fois les deux URLs connues :

```
railway variables --service backend \
  --set "CORS_ORIGINS=https://iris-site-XXXX.up.railway.app,https://iris-client-XXXX.up.railway.app"
railway redeploy --service backend
```

Sans `CORS_ORIGINS`, le backend accepte toutes les origines (comportement
actuel, pratique en dev).

---

## Option B — Dashboard Railway

Pour chaque app :

1. Projet `iris-backend` → **New** → **Empty Service** → renommer
   (`iris-site` / `iris-client`).
2. **Settings → Source** → connecter le dépôt GitHub, branche `main`.
3. **Settings → Build** :
   - *Root Directory* = `apps/site` (resp. `apps/client-web`)
   - *Builder* = `Dockerfile` (auto-détecté)
4. **Settings → Networking** → **Generate Domain** (port cible `80` si demandé).
5. Redéploiement automatique à chaque push sur `main`.

Puis, dans le service **backend** : **Variables** → ajouter
`CORS_ORIGINS` = les deux URLs séparées par une virgule → le backend
redéploie tout seul.

---

## Vérification

- `https://iris-site-...` : la page vitrine s'affiche, le bouton Android
  pointe vers `.../latest.apk`.
- `https://iris-client-...` : redirige vers `/login` ; après connexion, une
  réservation aboutit sur `/status/:id` (deep-link + refresh de page OK grâce
  au repli SPA).
- Après avoir posé `CORS_ORIGINS` : les deux sites fonctionnent toujours ;
  une origine non listée est refusée par le navigateur.

## Domaine personnalisé (plus tard)

`railway domain --service <svc> <mon-domaine>` puis créer l'enregistrement
CNAME indiqué. Ajouter le nouveau domaine à `CORS_ORIGINS`.
