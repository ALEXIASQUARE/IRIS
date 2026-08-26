# IRIS — Plateforme de services à domicile

Monorepo du MVP IRIS (laverie, repassage, ménage — Douala), conçu pour une
extension progressive à plusieurs villes et pays.

Référence normative : `Cahier des charges v1.0` + `Addendum technique v1.1`
(matching, modèle de données, machine à états, architecture régionale).

## Structure

```
iris/
├── apps/
│   ├── backend/          # API — NestJS + TypeScript, monolithe modulaire
│   ├── admin-web/        # React/Vite — "IRIS — Testeur" (espaces client/partenaire/admin)
│   └── mobile/           # Flutter — app unique, espaces client/partenaire par rôle
├── docker-compose.yml    # MariaDB + Redis + backend
└── .env.example
```

Choix d'architecture : **monolithe modulaire** (pas de microservices au MVP,
conformément à §12 du Cahier des charges). Chaque domaine métier est un
module NestJS isolé (auth, users, countries, services-catalog, pricing,
bookings, missions, partners, payments, incidents, ratings, admin, audit),
ce qui permet une extraction en microservice plus tard si le volume l'exige,
sans réécrire la logique métier.

## Démarrage

```bash
cp .env.example .env
docker compose up -d db redis
cd apps/backend
npm install
npx prisma migrate dev
npm run start:dev
```

L'API démarre sur `http://localhost:3000/api/v1`.

## État d'avancement (voir aussi §18 du Cahier des charges)

| Étape | Statut |
|---|---|
| 1. Architecture | ✅ Fait — monolithe modulaire, voir ci-dessus |
| 2. Arborescence + README | ✅ Fait |
| 3. Schéma DB + migrations | ✅ Schéma Prisma complet (`prisma/schema.prisma`) + `prisma/seed.ts` (données de démo Douala). Migration initiale à générer avec `npx prisma migrate dev` une fois `npm install` exécuté. |
| 4. Contrats API + rôles | ✅ Rôles (RBAC) + guards en place. Contrats API : voir `docs/API.md` |
| 5. Auth + onboarding | ✅ Implémenté (register, verify-otp, login, JWT) |
| 6. Services, devis, réservations, statuts | ✅ **Implémenté** — `PricingService` (§21.6, coefficients tissu/méthode/salissure), `BookingsService` (orchestration devis → paiement → matching) |
| 7. App partenaire + matching | ✅ **Matching (broadcast + verrou optimiste) implémenté** — voir `modules/missions` |
| 8. PIN de mission | ✅ Implémenté (génération, validation, usage unique) |
| 9. Paiements | ✅ `PaymentsService` + adaptateurs `cash`, `mtn_momo` (mock), `orange_money` (mock) + job de réconciliation planifié |
| 9bis. Notifications | ✅ `NotificationService` restructuré sur un adaptateur interchangeable (`NotificationChannel`/`NOTIFICATION_CHANNEL`, même patron que `OTP_PROVIDER`) — `MockNotificationChannel` en place, prêt à être remplacé par un vrai fournisseur push/SMS (§19) sans changer les appelants |
| 10. Administration | 🚧 Squelette de module |
| 11. Incidents, évaluations, notifications, audit | 🚧 Squelette de module (`NotificationService` mock en place, utilisé par missions) |
| 12. Tests | ✅ Unitaires (38, `npm test`) : verrou optimiste, tarification, réservations, RBAC. E2E (`npm run test:e2e`) : acceptation concurrente d'une offre par deux appels HTTP réels contre une base de test dédiée `iris_test` — voir `apps/backend/test/`. Base de test à créer une fois : `DATABASE_URL="mysql://iris:iris_dev_password@localhost:3306/iris_test" npx prisma migrate deploy`. |
| 13. Docker/déploiement | ✅ `docker-compose.yml` + `Dockerfile` fournis |
| 14. Documentation env/intégrations | ✅ `.env.example` |

## Parcours de bout en bout maintenant possible

1. `POST /auth/register` → `POST /auth/verify-otp` → `POST /auth/login`
2. `GET /pricing/laundry-quote` (ou `/pricing/quote`) pour prévisualiser le prix
3. `POST /bookings` — recalcule le devis côté serveur, crée la commande, initie le paiement
4. Si paiement immédiat (espèces / mock) : passage automatique à `SEARCHING_PARTNER` et diffusion aux partenaires disponibles de la zone
5. `POST /offers/:offerId/accept` côté partenaire — verrou optimiste
6. `POST /missions/:bookingId/start` avec le PIN pour démarrer

Pour tester en local : `npx prisma db seed` après la migration, pour disposer d'un pays (Cameroun), d'une zone (Douala) et d'un catalogue laverie de démonstration.

## Pourquoi commencer par le matching (module `missions`)

C'est la pièce identifiée comme la plus risquée dans l'analyse d'architecture :
elle touche la concurrence (deux partenaires ne doivent jamais accepter la même
mission), la géo-recherche, et l'expérience partenaire. Elle est donc codée en
premier et avec le plus de rigueur, pour valider le design avant de bâtir le
reste du flux de réservation dessus.

## Sécurité — rappel des invariants (§13, §9 du Cahier des charges)

- Aucun mot de passe en clair (hash Argon2/bcrypt).
- Tokens JWT courts + refresh token.
- RBAC strict par rôle (guard `RolesGuard`).
- Toute mutation d'état passe par le serveur — jamais de logique de statut côté client.
- Le PIN de mission est généré serveur, à usage unique, avec expiration.
