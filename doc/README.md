# MILES Smart Recovery Platform — Documentation

> Plateforme de recouvrement intelligente — gestion des impayés, scoring de risque, IA générative et mailing personnalisé.

## Table des matières

| # | Document | Contenu |
|---|----------|---------|
| 01 | [Overview & MVP](./01-overview.md) | Vision produit, périmètre fonctionnel, personas |
| 02 | [Architecture](./02-architecture.md) | Schéma global, couches, flux de données |
| 03 | [Frontend](./03-frontend.md) | Stack React, design system Teamwill, composants |
| 04 | [Backend](./04-backend.md) | Modules Node.js, adaptateur DB, configuration |
| 05 | [Sécurité & Auth](./05-security.md) | JWT, MFA, rate-limit, CSRF, audit |
| 06 | [Service de mailing](./06-mail-service.md) | Templates, situations, outbox |
| 07 | [Référence API](./07-api-reference.md) | Catalogue d'endpoints |
| 08 | [Journal des modifications](./08-modifications-log.md) | Changements de cette itération |
| 09 | [Roadmap & Business Logic](./09-roadmap.md) | Suggestions de fonctionnalités à valeur ajoutée |

## Démarrage rapide

```bash
# Backend
cd backend
npm install
npm run dev          # http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
```

**Identifiants de démo (mode mémoire) :**
- Email : `admin@miles.io`
- Mot de passe : `AdminMILES2026!`
- Code MFA : ouvrir le dernier fichier dans `backend/mail-outbox/`

## Stack en bref

| Couche | Technologies |
|--------|--------------|
| Frontend | React 19, Vite 7, React Router 7, Framer Motion, Chart.js, Lucide icons |
| Backend | Node.js, Express 5, JWT, bcrypt, Helmet, Handlebars, Nodemailer, Speakeasy (TOTP) |
| Données | PostgreSQL (en production) · in-memory mock store (en dev sans DB) |
| IA | Groq SDK (Llama 3) — pour le storytelling client |
| Sécurité | bcrypt 12 rounds, JWT + refresh httpOnly cookie, rate-limit, MFA TOTP+email, originGuard CSRF |
