# apps/site — Site vitrine IRIS

Page unique statique (HTML/CSS/JS, aucune dépendance, aucune étape de build)
présentant IRIS au grand public et renvoyant vers le téléchargement de l'app
mobile.

## Contenu

```
site/
├── index.html      # page unique (FR)
├── styles.css      # palette dérivée du logo (apps/mobile/assets/icon/icon.jpg)
├── main.js         # améliorations progressives : année, version publiée de l'app
└── assets/logo.jpg # copie du logo de l'app mobile
```

## Aperçu local

N'importe quel serveur statique convient :

```bash
cd apps/site
npx serve .            # ou : python3 -m http.server 8080
```

Ouvrir l'URL affichée. Le site fonctionne aussi en `file://`, mais `main.js`
n'affichera la version publiée que servi en HTTP (CORS).

## Lien de téléchargement

Le bouton Android pointe vers l'APK servi par le backend :
`https://backend-production-21788.up.railway.app/latest.apk`
(mis à jour à chaque release, voir `apps/backend/public/`).

## Déploiement

`Dockerfile` fourni : `nginx` sert les fichiers statiques tels quels (aucun
build). Déploiement Railway : service dédié, *Root Directory* = `apps/site`,
builder Dockerfile. Voir `docs/DEPLOY.md`.

Alternative : `nginx.conf` n'est pas nécessaire hors Railway — le contenu
peut aussi être copié dans `apps/backend/public/` (déjà exposé via
`app.useStaticAssets`) pour être servi à la racine du domaine backend.

## À compléter

- Nom de domaine + mentions légales / politique de confidentialité.
- Coordonnées de contact réelles (aucune n'est affichée pour l'instant).
- Lien App Store quand la version iOS est publiée (`.badge-soon` dans `index.html`).
