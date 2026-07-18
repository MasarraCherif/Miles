# 06 — Service de mailing personnalisé

## Principe

Pour chaque client en impayé, MILES sait dans quelle **situation** il se trouve. Le service mail traduit cette situation en un mail au **ton et contenu adaptés** :

| Situation | Ton | CTA principal |
|-----------|-----|---------------|
| `CRITIQUE` | Ferme, ultimatum 72 h, mention contentieux | "Contacter mon conseiller" |
| `ÉLEVÉ` | Sérieux, alerte sur la dégradation | "Régler en ligne" |
| `MOYEN` | Neutre, hypothèse d'oubli | "Régler en ligne" |
| `BAS` | Amical, court | "Régler en ligne" |
| `PAYÉ` | Reconnaissant, fidélisation | (aucun) |
| `WELCOME` | Onboarding nouveau utilisateur | "Activer la 2FA" |
| `PASSWORD_RESET` | Sécurité, lien temporaire | "Réinitialiser mon mot de passe" |
| `MFA_CODE` | Notification de code | (code affiché) |

## Architecture

```
src/mail/
├─ service.js
│  ├─ Compile et cache les templates Handlebars
│  ├─ Sélectionne le mode : SMTP (si SMTP_HOST set) sinon mock-outbox
│  ├─ sendMail({ to, subject, template, lang, vars })
│  ├─ sendPersonalized({ clientId, situation?, language? })  ← lookup + map
│  └─ sendBulk({ situation?, language? })                     ← itère les clients
│
├─ routes.js                                  Endpoints REST (admin only pour send/bulk)
│
└─ templates/
   ├─ _layout.hbs                              Wrapper HTML branded
   ├─ fr/  (FR — locale par défaut, complète)
   ├─ en/  (EN — partielle, fallback FR sur templates manquants)
   └─ ar/  (AR — placeholder, fallback FR)
```

## Templates

Tous les templates sont en HTML compatible client mail (tableaux, styles inline). Le wrapper `_layout.hbs` apporte :

- En-tête dégradé Teamwill vert (avec eyebrow "MILES Smart Recovery")
- Contenu (`{{{body}}}`)
- Pied de page neutre

### Variables disponibles selon le template

| Template | Variables |
|----------|-----------|
| `critique` / `eleve` / `moyen` / `bas` / `paye` | `nom_client`, `montant`, `numero_contrat`, `payUrl`, `contactUrl` |
| `welcome` | `nom` |
| `password_reset` | `nom`, `resetUrl`, `validityMinutes` |
| `mfa_code` | `nom`, `code`, `validityMinutes` |

## Mode mock-outbox

Lorsque `SMTP_HOST` n'est pas défini :

1. Tout `sendMail()` rend le HTML compilé
2. Le fichier est écrit dans `backend/mail-outbox/<ISO>__<template>__<destinataire>.html`
3. Le développeur **ouvre le fichier dans un navigateur** pour voir le rendu

⚠️ Le dossier `mail-outbox/` est destiné au dev. Ne pas le commiter (à ajouter au `.gitignore`).

## Mode SMTP réel

Définir dans `.env` :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...           # mot de passe d'application si Gmail/Outlook
SMTP_FROM="MILES Recovery <no-reply@miles.io>"
```

Au démarrage le serveur affiche `[mail] SMTP transport active (smtp.gmail.com:587)`.

## API

### `POST /api/mail/send` — admin only

Envoyer un mail personnalisé pour un client.

```bash
curl -X POST http://localhost:5000/api/mail/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access>" \
  -d '{ "clientId": 101, "situation": "CRITIQUE", "language": "fr" }'
```

`situation` et `language` sont optionnels — par défaut on prend les valeurs stockées sur le client.

### `POST /api/mail/bulk` — admin only

Envoyer en masse à tous les clients d'une situation.

```bash
curl -X POST http://localhost:5000/api/mail/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access>" \
  -d '{ "situation": "CRITIQUE" }'
```

Réponse :
```json
{
  "ok": true, "mode": "outbox", "count": 2,
  "results": [
    { "clientId": 101, "ok": true, "file": "…/...__critique__contact@atlas-trading.tn.html" },
    { "clientId": 106, "ok": true, "file": "…/...__critique__billing@nour-industries.tn.html" }
  ]
}
```

### `POST /api/mail/preview`

Permet de prévisualiser un template **sans rien envoyer**. Réponse en `text/html` directement.

```bash
curl -X POST http://localhost:5000/api/mail/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access>" \
  -d '{ "template":"critique", "lang":"fr" }' \
  -o preview.html
```

### `GET /api/mail/clients`

Liste des clients (filtrable `?situation=CRITIQUE`) — utile pour construire une UI de mailing.

### `GET /api/mail/status`

```json
{ "mode": "outbox", "outbox": true }
```

## Mapping situation → template

| Code reçu | Template chargé |
|-----------|-----------------|
| `CRITIQUE` | `critique` |
| `ÉLEVÉ` ou `ELEVE` | `eleve` |
| `MOYEN` | `moyen` |
| `BAS` | `bas` |
| `PAYÉ` ou `PAYE` | `paye` |

Le mapping est défini dans `service.js > SITUATION_MAP`. Les sujets sont localisés (FR/EN) dans `subjectMap`.
