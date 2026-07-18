# 02 — Architecture

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND  (React 19 + Vite)                       │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────┐ │
│  │Dashboard│  │ Impayés │  │Notifications │  │ Storytelling │  │ Chat │ │
│  └────┬────┘  └────┬────┘  └──────┬───────┘  └──────┬───────┘  └──┬───┘ │
│       └───────────┴──────────────┴──────────────────┴─────────────┘     │
│                                  ↓                                        │
│                ┌──────────────────────────────┐                          │
│                │   services/auth.js           │  in-memory access token  │
│                │   services/api.js            │  + refresh via cookie    │
│                └──────────────┬───────────────┘                          │
└───────────────────────────────┼──────────────────────────────────────────┘
                                ↓ HTTPS / JSON / signed cookies
┌──────────────────────────────────────────────────────────────────────────┐
│                       BACKEND  (Node.js / Express 5)                      │
│                                                                            │
│  ┌─────────────────────────  Security middleware  ────────────────────┐  │
│  │  helmet · cors strict · originGuard · cookie-parser · rate-limit     │ │
│  └──────────────────────────────────┬─────────────────────────────────┘  │
│                                     ↓                                     │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  /api/auth   │ │ /api/security   │ │  /api/mail   │ │ /api/<data>  │  │
│  │  login·mfa   │ │  health·audit   │ │ send·preview │ │ dashboard…   │  │
│  └──────┬───────┘ └────────┬────────┘ └──────┬───────┘ └──────┬───────┘  │
│         ↓                  ↓                 ↓                ↓           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │   db.js  (adapter)    →  PostgreSQL (prod)  ─OR─  memoryStore    │    │
│  │   mail/service.js     →  SMTP (prod)        ─OR─  mock outbox    │    │
│  │   Groq (lazy init)    →  Llama 3 via Groq   ─OR─  503 si absent  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                      DATA WAREHOUSE  (PostgreSQL)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  ┌────────────┐  …    │
│  │fact_impayes │  │ dim_client  │  │ dim_risque │  │ dim_temps  │       │
│  └─────────────┘  └─────────────┘  └────────────┘  └────────────┘       │
│              (alimenté par Talend ETL, exposé en BI Power BI)             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Couches & responsabilités

### Couche présentation (frontend)
- **Rôle** : UI utilisateur, gestion d'état UI, animations
- **Pas de logique métier critique** (pas de calcul de score, pas de validation finale)
- Token d'accès stocké uniquement **en mémoire** → résistant XSS

### Couche application (backend)
- **Auth** : authentification, MFA, sessions
- **Security** : middleware transversal et endpoint d'inspection
- **Mail** : rendu et expédition de mails personnalisés
- **API métier** : dashboard, impayés, storytelling, scoring
- **Adaptateur DB** : permet de basculer PostgreSQL ↔ mémoire sans réécriture

### Couche données
- **PostgreSQL** : modèle en étoile (fact + dim), alimenté par Talend ETL
- **In-memory mock** : utilisé en développement quand la DB n'est pas accessible (admin seedé, 8 clients, audit en RAM)

## Diagramme de modules backend

```
backend/
├─ server.js                       Entrée HTTP, wire-up middleware + routes
├─ src/
│  ├─ config.js                    Toutes les variables d'env, secrets fallback DEV
│  ├─ db.js                        Adaptateur conditionnel pg ↔ memory
│  ├─ memoryStore.js               Store in-memory (users, clients, audit, MFA challenges)
│  │
│  ├─ auth/
│  │   ├─ hash.js                  bcrypt + policy mot de passe
│  │   ├─ tokens.js                JWT access + refresh, signed cookie
│  │   ├─ mfa.js                   TOTP (speakeasy + QR) + email code
│  │   ├─ audit.js                 Helper de log d'événements auth
│  │   ├─ middleware.js            requireAuth · requireRole
│  │   └─ routes.js                /login /logout /refresh /me /register
│  │                               /forgot-password /reset-password
│  │                               /mfa/verify /mfa/resend /mfa/totp/{setup,confirm,disable}
│  │                               /mfa/email/toggle
│  │
│  ├─ security/
│  │   ├─ middleware.js            helmet · cors · originGuard
│  │   ├─ rateLimit.js             globalLimiter · loginLimiter · aiLimiter
│  │   └─ routes.js                /health · /audit (admin)
│  │
│  └─ mail/
│      ├─ service.js               Compilation Handlebars · transport SMTP / outbox
│      ├─ routes.js                /send · /bulk · /preview · /clients · /status
│      └─ templates/
│          ├─ _layout.hbs          Wrapper HTML branded Teamwill
│          ├─ fr/{critique,eleve,moyen,bas,paye,welcome,password_reset,mfa_code}.hbs
│          ├─ en/{critique,mfa_code}.hbs       (le reste retombe en FR)
│          └─ ar/                  (placeholder, fallback FR)
└─ mail-outbox/                    HTML rendu en mode mock
```

## Diagramme de modules frontend

```
frontend/src/
├─ App.jsx                         Layout (sidebar groupé + topbar) + Dashboard bento
├─ App.css                         Design system Teamwill
├─ index.css                       Tokens CSS (couleurs, espacements, ombres, kbd…)
│
├─ components/
│   ├─ Sparkline.jsx               Mini chart pour les KPI cards
│   ├─ CountUp.jsx                 Animation de chiffres (rAF + ease-out cubic)
│   ├─ LoadingSpinner.jsx          Spinner conique vert
│   └─ ErrorBanner.jsx             Bannière erreur avec icône
│
├─ pages/
│   ├─ Login.jsx                   Split-screen + flux MFA en 2 étapes
│   ├─ Impayes.jsx                 Table + filtres chips + recherche + actions
│   ├─ Notifications.jsx           Cartes par sévérité avec timeline icons
│   ├─ Storytelling.jsx            Formulaire + résultat IA
│   └─ SmartCreditAssessmentChat.jsx   Chat guidé + progress bar + résultat structuré
│
├─ services/
│   ├─ auth.js                     Token mémoire, apiFetch avec auto-refresh, login/MFA
│   └─ api.js                      Endpoints data legacy
│
└─ utils/
    └─ formatters.js               formatCurrency · formatDate
```

## Flux nominal — connexion sécurisée

```
Utilisateur            Frontend                Backend                        Mail
    │                     │                        │                            │
    │── email + pwd ─────▶│                        │                            │
    │                     │── POST /auth/login ───▶│                            │
    │                     │                        │ bcrypt.compare ✓           │
    │                     │                        │ MFA email activé ?         │
    │                     │                        │ ─ génère code 6 chiffres ──▶│ outbox/<file>.html
    │                     │ ◀── { mfaRequired,     │                            │
    │                     │       challengeId }   │                            │
    │ ◀── écran MFA ──────│                        │                            │
    │                     │                        │                            │
    │── code 6 chiffres ─▶│                        │                            │
    │                     │── POST /auth/mfa/verify▶│                            │
    │                     │                        │ vérifie code + ttl         │
    │                     │                        │ émet access + refresh JWT  │
    │                     │ ◀── { accessToken,    │                            │
    │                     │       user }           │ Set-Cookie: miles_rt …     │
    │ ◀── dashboard ──────│                        │                            │
```

## Flux nominal — mail personnalisé

```
Admin              Frontend           Backend            Mail service       Outbox / SMTP
  │                  │                  │                    │                    │
  │── /api/mail/send ▶                 │                    │                    │
  │  { clientId,                        │                    │                    │
  │    situation,                       │                    │                    │
  │    language }                       │                    │                    │
  │                                     │ requireAuth ✓      │                    │
  │                                     │ requireRole admin ✓│                    │
  │                                     │── render template ▶                    │
  │                                     │                    │ Handlebars + vars │
  │                                     │                    │── envoi ──────────▶ outbox/*.html
  │                                     │                    │                     (ou SMTP)
  │ ◀── { ok, file/messageId } ────────│                    │                    │
```
