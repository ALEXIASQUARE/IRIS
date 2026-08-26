# Debian (pas Alpine/musl) : le moteur Prisma et les modules natifs (argon2)
# sont plus fiables sur glibc — voir binaryTargets dans schema.prisma
# (debian-openssl-3.0.x / debian-openssl-1.1.x).
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
