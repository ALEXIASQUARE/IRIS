# IRIS API — Contrat v1

Base URL : `/api/v1`. Authentification : `Authorization: Bearer <accessToken>`
sauf routes marquées **publiques**.

Référence : Cahier des charges v1.0 §11, complété par l'Addendum technique
v1.1 pour le matching et la révision de prix.

## Authentification

| Méthode | Route | Rôle | Statut |
|---|---|---|---|
| POST | `/auth/register` | public | ✅ implémenté |
| POST | `/auth/verify-otp` | public | ✅ implémenté |
| POST | `/auth/login` | public | ✅ implémenté |

## Réservations (à implémenter — module `bookings`)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/services` | tous |
| POST | `/pricing/quote` | client |
| POST | `/pricing/laundry-quote` | client |
| POST | `/bookings` | client |
| GET | `/bookings/:id` | client (propriétaire) |
| POST | `/bookings/:id/cancel` | client |
| POST | `/bookings/:id/payment` | client |

## Matching et missions (module `missions` — ✅ implémenté)

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/offers/:offerId/accept` | partner | Verrou optimiste — voir Addendum §2.2 |
| POST | `/offers/:offerId/reject` | partner | |
| POST | `/missions/:bookingId/start` | partner | Valide le PIN, passe à IN_PROGRESS |
| POST | `/bookings/:bookingId/price-revisions` | partner | Déclare un écart à l'arrivée (§21.8) |
| POST | `/bookings/:bookingId/price-revisions/:revisionId/confirm` | client | Confirme le nouveau prix, débloque le démarrage |

## Partenaires (à implémenter — module `partners`)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/partner/profile` | partner |
| POST | `/partner/documents` | partner |
| POST | `/partner/availability` | partner |
| GET | `/partner/offers` | partner |

## Administration (à implémenter — module `admin`)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/admin/dashboard` | admin, super_admin |
| GET | `/admin/partners` | admin, super_admin |
| POST | `/admin/partners/:id/approve` | admin, super_admin |
| POST | `/admin/partners/:id/suspend` | admin, super_admin |

## Notes d'implémentation

- Toute route mutant un statut de mission ou de paiement doit passer par le
  service métier correspondant (`MissionsService`, futur `PaymentsService`) —
  jamais de logique de transition d'état dans un controller.
- Les DTO de chaque module valident les entrées côté serveur via
  `class-validator` (§13 — "validation serveur de toutes les entrées").
