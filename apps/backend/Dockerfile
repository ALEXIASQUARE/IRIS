# Debian (pas Alpine/musl) : le moteur Prisma et les modules natifs (argon2)
# sont plus fiables sur glibc — voir binaryTargets dans schema.prisma
# (debian-openssl-3.0.x / debian-openssl-1.1.x).
#
# Contexte de build = racine du dépôt (Railway `up` / `--from-source`
# envoient tout le dépôt) ; les chemins COPY sont donc préfixés par
# apps/backend/. La variable de service RAILWAY_DOCKERFILE_PATH pointe
# Railway vers ce fichier.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/backend/package*.json ./
RUN npm install

COPY apps/backend/ ./
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
