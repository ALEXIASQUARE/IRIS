# --- Build : Vite compile un bundle statique ---
# VITE_API_BASE_URL est inliné dans le bundle au moment du build. Valeur par
# défaut = backend de prod ; surchargeable via une variable de build Railway
# (Settings -> Build -> Build args) ou `railway variables --set`.
FROM node:20-bookworm-slim AS build

ARG VITE_API_BASE_URL=https://backend-production-21788.up.railway.app/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Service : nginx sert dist/ avec repli SPA ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
