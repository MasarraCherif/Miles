# 07 — Référence API

> Base URL : `http://localhost:5000` en dev. Toutes les réponses sont JSON sauf `POST /api/mail/preview` qui renvoie du HTML.

## Conventions

- **Auth** : header `Authorization: Bearer <accessToken>` requis sur les routes marquées 🔒
- **Admin** : routes marquées 👑 supplémentairement réservées aux utilisateurs `role: "admin"`
- **CSRF** : toutes les requêtes mutantes doivent venir d'un `Origin` autorisé (sinon 403)
- **Rate-limit** : un en-tête `RateLimit-*` est présent dans la réponse

---

## Auth

### `POST /api/auth/login`

Body :
```json
{ "email": "admin@miles.io", "mot_de_passe": "AdminMILES2026!" }
```

Réponse — pas de MFA :
```json
{ "accessToken": "ey…", "user": { "id": 1, "email": "…", "role": "admin", … } }
```

Réponse — MFA requis :
```json
{
  "mfaRequired": true,
  "challengeId": "uuid",
  "availableMethods": ["email", "totp"],
  "activeMethod": "email"
}
```

Codes : 200 · 400 (validation) · 401 (identifiants) · 403 (compte inactif) · 423 (verrouillé) · 429 (rate-limit)

### `POST /api/auth/mfa/verify`

```json
{ "challengeId": "uuid", "type": "email" | "totp", "code": "123456" }
```
Réponse identique à `/login` sans MFA. Pose le cookie `miles_rt`.

### `POST /api/auth/mfa/resend`

Renvoie un nouveau code email pour un challenge donné.

```json
{ "challengeId": "uuid" }
```

### `POST /api/auth/mfa/totp/setup` 🔒

Démarre l'enrôlement TOTP : retourne le secret base32, l'`otpauth://` URL et un QR code en base64 (à afficher dans l'app).

### `POST /api/auth/mfa/totp/confirm` 🔒

```json
{ "code": "123456" }
```
Active TOTP si le code correspond.

### `POST /api/auth/mfa/totp/disable` 🔒

Désactive TOTP.

### `POST /api/auth/mfa/email/toggle` 🔒

```json
{ "enabled": true }
```

### `POST /api/auth/refresh`

Lit le cookie httpOnly, **rotation systématique**, renvoie un nouvel `accessToken`.

### `POST /api/auth/logout`

Révoque le refresh courant et supprime le cookie.

### `GET /api/auth/me` 🔒

Profil de l'utilisateur courant (sans hash, sans secret TOTP).

### `POST /api/auth/register` 🔒👑

Crée un utilisateur (admin uniquement aujourd'hui).

```json
{ "email": "…", "nom": "…", "prenom": "…", "mot_de_passe": "MotDePasseFort!12" }
```

### `POST /api/auth/forgot-password`

```json
{ "email": "…" }
```
Toujours 200 (anti-énumération). Si l'email existe, un mail est envoyé via le service.

### `POST /api/auth/reset-password`

```json
{ "token": "<32 hex>", "mot_de_passe": "NouveauMotDePasse!12" }
```

---

## Sécurité

### `GET /api/security/health`

Posture publique de la plateforme — voir [05-security.md](./05-security.md).

### `GET /api/security/audit?limit=N` 🔒👑

100 derniers événements par défaut, max 500.

---

## Mail

### `POST /api/mail/send` 🔒👑

```json
{ "clientId": 101, "situation": "CRITIQUE", "language": "fr", "vars": { "...": "..." } }
```

### `POST /api/mail/bulk` 🔒👑

```json
{ "situation": "CRITIQUE", "language": "fr" }
```

### `POST /api/mail/preview` 🔒

Renvoie le HTML directement (utile dans une iframe).

```json
{ "template": "critique", "lang": "fr", "subject": "Aperçu", "vars": { … } }
```

### `GET /api/mail/clients?situation=CRITIQUE` 🔒
### `GET /api/mail/status` 🔒

---

## Données métier (legacy — DB requise)

Toutes ces routes renvoient `503` en mode mémoire avec le message :
> *Service indisponible — base de données hors ligne (mode mémoire).*

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/health` | Ping public |
| GET | `/api/db-test` | Test connexion DB |
| GET | `/api/clients?limit&offset` | Liste des clients |
| GET | `/api/impayes?limit&offset` | Liste des impayés |
| GET | `/api/dashboard` | KPIs agrégés |
| GET | `/api/alertes` | Top 10 alertes |
| GET | `/api/notifications-risque` | Notifications de risque |
| GET | `/api/storytelling` | Storytelling global |
| GET | `/api/storytelling/:clientName` | Storytelling client (pré-IA) |
| POST | `/api/ai/client-storytelling` | Storytelling IA client (Groq) |
| POST | `/api/smart-credit-assessment` | Scoring crédit (compute pur, pas de DB nécessaire) |

---

## Codes d'erreur transverses

| Code | Sens dans MILES |
|------|-----------------|
| 400 | Validation `express-validator` ou body manquant |
| 401 | Identifiants / token invalides |
| 403 | Origin refusé (CSRF) ou rôle insuffisant |
| 409 | Conflit — email déjà utilisé |
| 423 | Compte verrouillé suite à trop d'échecs |
| 429 | Rate-limit dépassé |
| 503 | Service indisponible (DB / Groq / SMTP non configurés) |
