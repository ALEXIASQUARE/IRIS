# Site vitrine IRIS — statique pur, aucune étape de build.
#
# Contexte de build = racine du dépôt (Railway `up` envoie le repo git) ; les
# chemins COPY sont donc préfixés par apps/site/. RAILWAY_DOCKERFILE_PATH
# pointe Railway vers ce fichier.
FROM nginx:1.27-alpine

COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/site/index.html apps/site/styles.css apps/site/main.js /usr/share/nginx/html/
COPY apps/site/assets/ /usr/share/nginx/html/assets/

EXPOSE 80
