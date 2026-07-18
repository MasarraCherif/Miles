# 08 — Journal des modifications

Toutes les modifications apportées lors de cette itération, regroupées par chantier.

## Chantier 1 — Refonte UI/UX (design system Teamwill)

### Tokens & design system
- Réécriture de `frontend/src/index.css` avec un système de tokens complet (couleurs, espacements, ombres, rayons, kbd, focus glow)
- Réécriture de `frontend/src/App.css` : sidebar foncée Teamwill, topbar glassmorphism, boutons, inputs, badges, tables, timeline, skeletons, segmented control, bento grid…
- Police **Inter** + **JetBrains Mono** chargées depuis Google Fonts
- Utilitaires : `.num` (chiffres tabulaires), `.kbd`, `.dot-sep`, `.divider`, `.page-eyebrow`

### Palette Teamwill (vert olive + charcoal)
- `--brand-500: #8fb339` (vert principal)
- `--navy-800: #2a2c32` (charcoal)
- Tous les `rgba(99,102,241, …)` (ancien indigo) et `rgba(245,158,11, …)` (ancien gold) remplacés par les RGB Teamwill équivalents
- Couleurs des charts du dashboard alignées (line + doughnut "Payé" en vert, "Impayé" en rouge sémantique)

### Composants
- `Sparkline.jsx` (nouveau) — mini line-chart pour KPI cards
- `CountUp.jsx` (nouveau) — animation rAF + ease-out cubic
- `LoadingSpinner.jsx` — passé à un anneau conique vert
- `ErrorBanner.jsx` — refondu avec icône Lucide

### Pages
- **Dashboard** (`App.jsx`) — bento layout en 12 colonnes :
  - KPI cards (4) avec sparkline, count-up, trend pill
  - Chart évolution avec segmented control 3M/6M/12M
  - "Top clients à risque" : avatar coloré + risk badge + montant
  - Insight banner avec CTA
  - Bar chart + activity timeline (icônes par type)
  - Doughnut + storytelling form
  - Skeleton loader pendant le chargement
- **Sidebar** — sections `Aperçu / Opérations / Intelligence`, hint ⌘K, user-card en footer
- **Topbar** — period chip "Avr 2026", search avec kbd ⌘K, notifications dot rouge, "+ Nouveau dossier" CTA
- **Login** — refonte split-screen brand panel ; ajout du flux MFA en deux étapes
- **Impayés** — page header avec eyebrow + meta (count, total, last-updated), filter chips avec compteurs, recherche, tableau avec avatars colorés + 3-dot menu hover, état vide
- **Notifications** — cartes avec icônes par sévérité, badges, animations stagger
- **Storytelling** — formulaire labelisé, focus glow, CTA "Wand2"
- **Smart Credit Chat** — header avec online dot + progress bar, bubbles avec avatars, typing dots, auto-scroll, reset, résultat en cards + analysis box

### Mode "DB-less"
- `App.jsx` — fallback mock en cas de fetch échec sur `/api/dashboard`
- `Impayes.jsx` — 8 dossiers de démo en fallback
- `Notifications.jsx` — 5 alertes de démo en fallback
- `BYPASS_AUTH` introduit puis retiré une fois l'auth complète mise en place

---

## Chantier 2 — Auth, sécurité, mailing

### Backend — nouveaux modules
- `backend/src/config.js` — config centrale, secrets DEV éphémères, lecture `.env`
- `backend/src/db.js` — adaptateur PostgreSQL ↔ memory, expose `mode`, `pgPool`, `store`, `query`, `isMemory`
- `backend/src/memoryStore.js` — store seedé : 1 admin (bcrypt), 8 clients, audit, refresh tokens, MFA challenges, password reset tokens
- `backend/src/auth/hash.js` — bcrypt 12 rounds + politique mot de passe
- `backend/src/auth/tokens.js` — JWT access (15 min) + refresh (7 j), cookie httpOnly signé, rotation
- `backend/src/auth/mfa.js` — TOTP (speakeasy + QR) + email code (bcrypt-hashé, TTL 5 min)
- `backend/src/auth/audit.js` — helper `logAuth(req, event, extra)`
- `backend/src/auth/middleware.js` — `requireAuth` + `requireRole`
- `backend/src/auth/routes.js` — login / logout / refresh / me / register / forgot-password / reset-password / mfa.verify / mfa.resend / mfa.totp.setup|confirm|disable / mfa.email.toggle
- `backend/src/security/middleware.js` — helmet + cors strict + originGuard CSRF
- `backend/src/security/rateLimit.js` — globalLimiter (200/min), loginLimiter (10/15min `IP:email`, IPv6-safe), aiLimiter (20/min)
- `backend/src/security/routes.js` — `/health` public, `/audit` admin
- `backend/src/mail/service.js` — transport SMTP / mock-outbox, cache de templates, `sendMail`/`sendPersonalized`/`sendBulk`/`renderEmail`
- `backend/src/mail/routes.js` — `send`/`bulk`/`preview`/`clients`/`status`
- `backend/src/mail/templates/_layout.hbs` — wrapper HTML branded Teamwill
- `backend/src/mail/templates/fr/{critique,eleve,moyen,bas,paye,welcome,password_reset,mfa_code}.hbs`
- `backend/src/mail/templates/en/{critique,mfa_code}.hbs`

### Backend — `server.js` réécrit
- `helmet`, `cors`, `cookie-parser`, `morgan`, `originGuard`, `globalLimiter` chaînés en haut
- Init **lazy** de Groq (plus de crash si `GROQ_API_KEY` absent)
- Routes legacy retournent `503` en mode mémoire au lieu de crasher sur `pool.query`
- Montage des routeurs `/api/auth`, `/api/security`, `/api/mail`
- Trace de boot avec `db.mode`, `smtp` mode, identifiants seed
- Suppression du `app.post("/api/auth/login")` ad-hoc précédemment ajouté

### Frontend — auth client
- `frontend/src/services/auth.js` — store en mémoire, `apiFetch` avec auto-refresh sur 401, `bootstrapSession`, `login`, `verifyMfa`, `resendMfaEmail`, `logout`
- `frontend/src/pages/Login.jsx` — flux deux étapes (credentials → MFA), segmented control si plusieurs méthodes, resend, retour
- `frontend/src/App.jsx` — bootstrap session au mount, plus de `localStorage`, `BYPASS_AUTH` retiré

### Dépendances ajoutées (backend)
```
bcryptjs · jsonwebtoken · helmet · express-rate-limit · express-validator
cookie-parser · morgan · nodemailer · handlebars · speakeasy · qrcode
```

---

## Chantier 3 — Documentation

- Création de `doc/` avec 9 fichiers (README + 01–09)
- `ARCHITECTURE.md` historique conservé à la racine (héritage)

---

## Vérifications de bout-en-bout

✅ Backend démarre proprement en mode mémoire — banner clair (`[db] memory`, `[mail] outbox`, identifiants seed)
✅ `GET /api/security/health` renvoie la posture complète
✅ `POST /api/auth/login` (admin@miles.io) → renvoie un challenge email
✅ Le code MFA est écrit dans `backend/mail-outbox/<…>__mfa_code__admin@miles.io.html`
✅ `POST /api/auth/mfa/verify` avec le code valide → access token + cookie refresh
✅ Mauvais code → `401`, mauvais Origin → `403`
✅ Frontend build : 30 KB CSS gz / 200 KB JS gz, sans warning bloquant
