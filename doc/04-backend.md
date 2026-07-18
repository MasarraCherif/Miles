# 04 — Backend

## Stack

| Lib | Rôle |
|-----|------|
| express ^5 | Serveur HTTP |
| pg ^8 | Driver PostgreSQL |
| dotenv | Chargement `.env` |
| jsonwebtoken | Émission & vérification JWT |
| bcryptjs | Hash mot de passe (12 rounds) |
| helmet | En-têtes HTTP de sécurité |
| express-rate-limit | Limiteur de débit (IPv6-safe) |
| express-validator | Validation et sanitisation des bodies |
| cookie-parser | Cookies signés (refresh token) |
| morgan | Journalisation des requêtes |
| nodemailer | Transport SMTP |
| handlebars | Compilation des templates mail |
| speakeasy | TOTP (compatible Google/Microsoft Authenticator) |
| qrcode | QR code pour l'enrôlement TOTP |
| groq-sdk | LLM Llama 3 (storytelling client) — chargé en lazy |

## Architecture en couches

```
HTTP request
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  helmet → cors → express.json (1MB) → cookieParser →    │  Couche transversale
│  morgan → originGuard → globalLimiter                    │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Routeurs montés                                         │
│  /api/auth     /api/security    /api/mail               │  Couche applicative
│  /api/dashboard /api/impayes    /api/storytelling …     │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  db.js (adapter)        memoryStore.js (fallback dev)   │  Couche données
│  pg.Pool si DB_HOST     in-memory si non configuré       │
└─────────────────────────────────────────────────────────┘
```

## Configuration — `src/config.js`

Toutes les variables d'environnement sont centralisées. Trois secrets **obligatoires** en production :

| Variable | Rôle | Fallback DEV |
|----------|------|--------------|
| `JWT_ACCESS_SECRET` | Signature JWT court | aléatoire éphémère |
| `JWT_REFRESH_SECRET` | Signature JWT long | aléatoire éphémère |
| `COOKIE_SECRET` | Signature des cookies | aléatoire éphémère |

⚠️ **En DEV, ces secrets sont régénérés à chaque redémarrage** ; les sessions n'y survivent pas. Pour persister, créer un `.env` :

```env
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
COOKIE_SECRET=<openssl rand -hex 32>

# Optionnel — si non set, mode mémoire
DB_HOST=localhost
DB_PORT=5432
DB_NAME=miles
DB_USER=postgres
DB_PASSWORD=…

# Optionnel — si non set, mode mock-outbox
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=…
SMTP_PASSWORD=…
SMTP_FROM="MILES Recovery <no-reply@miles.io>"

# Optionnel — pour le storytelling IA
GROQ_API_KEY=…

FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
PORT=5000
```

## Adaptateur DB — `src/db.js`

Module unique qui expose :

```js
{
  mode: "postgres" | "memory",
  pgPool,                        // pool pg si mode postgres
  store: memoryStore,            // toujours disponible (audit, MFA, refresh tokens)
  isMemory: () => boolean,
  query: (sql, params) => …       // jette si pas de pool
}
```

Les routes legacy (`/api/dashboard`, `/api/impayes`, …) utilisent `db.query()`. Si `db.isMemory() === true`, elles renvoient un **503 propre** plutôt que de crasher. Les routes de l'auth, du mailing et du audit utilisent `db.store` (in-memory) — fonctionnent dans les deux modes.

### Mémoire seedée

À chaque démarrage en mode mémoire :
- **1 admin** : `admin@miles.io` / `AdminMILES2026!` (bcrypt) — MFA email **activée**, TOTP désactivé
- **8 clients** dispersés sur les situations CRITIQUE / ÉLEVÉ / MOYEN / PAYÉ
- **Audit log** vide (rempli au fur et à mesure des connexions)

## Lazy services

Pour ne pas crasher au boot quand des secrets manquent :

```js
// Groq
let _groq = null;
const getGroq = () => {
  if (!process.env.GROQ_API_KEY) throw httpError(503, "GROQ non configuré");
  return (_groq ||= new Groq({ apiKey: process.env.GROQ_API_KEY }));
};
```

Idem pour SMTP — si non configuré, `nodemailer` n'est pas instancié et le mailer écrit dans `mail-outbox/`.

## Démarrage

```bash
cd backend
npm install
npm run dev      # nodemon
npm start        # production
```

À l'écran :
```
🚀 MILES API running on http://localhost:5000
   env=development db=memory smtp=outbox
   👤 Seeded admin: admin@miles.io / AdminMILES2026!
   ✉️  Outbox: backend/mail-outbox/
```
