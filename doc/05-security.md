# 05 — Sécurité & Authentification

## Modèle de menace pris en compte

| Menace | Mitigation MILES |
|--------|------------------|
| Vol d'identifiants par fuite mémoire / log | bcrypt 12 rounds, jamais de mot de passe en log |
| Vol de token via XSS | Access token **en mémoire seulement** (pas de localStorage) |
| Vol de token via interception | Refresh token en cookie **httpOnly + signed** + Secure (prod) + SameSite=Strict (prod) |
| Brute-force sur le login | rate-limit `IP:email` + lockout après 5 échecs (15 min) |
| Abus d'API publique | rate-limit global 200 req/min, AI-limit 20 req/min |
| Compte volé sans 2FA | MFA obligatoire (TOTP ou email) |
| CSRF | `originGuard` + SameSite=Strict |
| Headers manquants (X-Frame-Options, CSP, etc.) | `helmet` |
| Injection SQL | Requêtes paramétrées `pg` partout |
| Reset password forgé | Token aléatoire 32 octets, TTL 30 min, à usage unique |
| Replay JWT révoqué | Liste des `jti` revoked en store, vérifiée au refresh |

## Authentification — chaîne complète

### 1. Hash du mot de passe — `src/auth/hash.js`

```js
bcrypt.hash(plain, 12)             // ~ 250 ms par hash sur CPU moderne
```

### 2. Politique de mot de passe (register / reset)

| Règle | Valeur |
|-------|--------|
| Longueur min | 12 caractères |
| Minuscule | ✅ |
| Majuscule | ✅ |
| Chiffre | ✅ |
| Caractère spécial | ✅ |

### 3. Émission des tokens — `src/auth/tokens.js`

```js
access  = jwt.sign({ sub, role, email }, ACCESS_SECRET, { expiresIn: "15m", jti })
refresh = jwt.sign({ sub, type: "refresh" }, REFRESH_SECRET, { expiresIn: "7d", jti })
```

- L'access token est renvoyé dans le **body JSON** → vit en mémoire JS côté client
- Le refresh token est posé dans un cookie :
  ```
  Set-Cookie: miles_rt=<jwt>; HttpOnly; Signed; Path=/api/auth;
              SameSite=Strict; Secure   (en prod)
  ```

### 4. Lockout — `src/auth/routes.js`

À chaque échec de mot de passe, `failed_attempts++`. Au 5ᵉ échec, on bloque le compte 15 minutes (`locked_until` ISO). Un succès remet le compteur à 0.

### 5. MFA — `src/auth/mfa.js`

Deux méthodes simultanément supportables :

| Méthode | Mécanisme | Fenêtre |
|---------|-----------|---------|
| **Email** | Code 6 chiffres aléatoire, hashé bcrypt côté serveur, envoyé via le service mail | TTL 5 min |
| **TOTP** | speakeasy (RFC 6238), tolérance ±1 step (≈ ±30 s) | window=1 |

Lors d'un login réussi (mot de passe), si une MFA est active :
1. Le serveur crée un `challengeId` UUID, le persiste avec `userId`, `type`, `codeHash` (email) ou rien (TOTP)
2. Pour l'email, le code est envoyé via `mail/service.js` (template `mfa_code.hbs`)
3. Le frontend reçoit `{ mfaRequired: true, challengeId, availableMethods, activeMethod }`
4. Il poste le code à `/auth/mfa/verify` avec le `challengeId`
5. Si valide → tokens émis, challenge supprimé

### 6. Refresh — rotation systématique

Chaque appel à `/auth/refresh` :
1. Lit le cookie `miles_rt` signé
2. Vérifie la signature + l'expiration
3. Vérifie que le `jti` n'est pas dans la liste de révocation
4. **Révoque l'ancien `jti`** et émet un **nouveau couple** (access + refresh)
5. Repose le nouveau cookie

Cela contre la réutilisation d'un refresh token volé (détection par double usage possible).

### 7. Logout

- Supprime le cookie côté client
- Marque le `jti` du refresh comme révoqué côté serveur

## Middleware

### `requireAuth`
Valide le `Authorization: Bearer …`, vérifie que l'utilisateur existe et est actif, attache `req.user = { id, email, role }`.

### `requireRole(...roles)`
À utiliser après `requireAuth`. Renvoie 403 si le rôle de l'utilisateur n'est pas dans la liste.

### `originGuard`
Pour `POST/PUT/DELETE`, vérifie que l'`Origin` ou `Referer` commence par `FRONTEND_ORIGIN`. Combiné à `SameSite=Strict`, c'est une défense CSRF solide sans complication CSRF-token.

### `globalLimiter` / `loginLimiter` / `aiLimiter`
- `globalLimiter` : 200 req / min / IP — toutes routes
- `loginLimiter` : 10 req / 15 min / `IP:email` — `/auth/login`, `/auth/mfa/*`
- `aiLimiter` : 20 req / min / IP — `/api/ai/*`, `/api/smart-credit-assessment`

## Audit — `src/auth/audit.js`

Chaque événement d'auth est ajouté à `db.store.audit` (en mémoire — déplaçable en table `auth_audit` quand DB en ligne) :

```
{
  id: uuid, ts, event, ip, ua,
  // payload variable
  userId?, email?, failed?, type?, reason?, ...
}
```

Événements émis :
- `login_failed_no_user` · `login_failed_password` · `login_locked`
- `login_inactive` · `login_success` · `login_mfa_challenge`
- `login_success_mfa` · `mfa_failed`
- `mfa_totp_enrolled` · `mfa_totp_disabled` · `mfa_email_toggled`
- `password_reset_requested` · `password_reset_done`
- `user_registered`

Consultable via `GET /api/security/audit?limit=N` (admin uniquement).

## Endpoint d'inspection

`GET /api/security/health` retourne la posture courante :

```json
{
  "ok": true,
  "env": "development",
  "db": { "mode": "memory" },
  "smtp": { "mode": "mock-outbox" },
  "security": {
    "helmet": true, "rateLimit": true, "originGuard": true,
    "corsOrigin": "http://localhost:5173",
    "cookies": { "sameSite": "lax", "secure": false }
  },
  "auth": {
    "jwt": { "accessTtl": "15m", "refreshTtl": "7d" },
    "mfa": { "totp": true, "email": true },
    "passwordPolicy": { "minLength": 12, "complexity": true },
    "lockout": { "maxAttempts": 5, "lockoutMs": 900000 }
  }
}
```
