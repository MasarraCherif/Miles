# 03 — Frontend

## Stack

| Lib | Version | Rôle |
|-----|---------|------|
| react / react-dom | ^19.1.1 | UI |
| react-router-dom | ^7.15 | Routing SPA |
| vite | ^7.1 | Build & dev server |
| framer-motion | ^12.38 | Animations (entrée, hover, transitions) |
| chart.js + react-chartjs-2 | ^4.5 / ^5.3 | KPI sparklines, line, bar, doughnut |
| lucide-react | ^0.447 | Iconographie |

## Design system Teamwill

Tous les tokens sont définis dans `src/index.css` puis consommés via `var(--token)`.

### Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-500` | `#8fb339` | Vert Teamwill principal |
| `--brand-300` / `--brand-700` | `#b9d36a` / `#5e7a1f` | Dégradés, hover, accents |
| `--navy-800` / `--navy-900` | `#2a2c32` / `#1c1e23` | Sidebar, panneaux sombres |
| `--success` / `--danger` / `--warning` / `--info` | `#10b981` / `#ef4444` / `#f59e0b` / `#3b82f6` | Badges sémantiques |

### Typographie
- `Inter` 300–800 — UI
- `JetBrains Mono` — kbd, codes
- Classe utilitaire `.num` pour les chiffres tabulaires (`tabular-nums`)

### Échelles
- Rayons : `--radius-sm/md/lg/xl/2xl/full`
- Ombres : `--shadow-xs/sm/md/lg/xl` + `--shadow-glow` (anneau de focus vert)
- Espacement : `--sp-1` (4px) → `--sp-9` (56px)

## Routing

| Chemin | Composant | Description |
|--------|-----------|-------------|
| `/` | `DashboardPage` | Bento KPI + charts + top risk + activity |
| `/impayes` | `Impayes` | Table avec filtres |
| `/notifications` | `Notifications` | Cartes d'alerte par sévérité |
| `/storytelling` | `Storytelling` | Formulaire + IA |
| `/smart-credit-assessment` | `SmartCreditAssessmentChat` | Chat guidé |

Toutes les routes sont **protégées** : si pas de session → `Login`.

## Composants clés

### `Sparkline.jsx`
Mini line-chart pour les KPI cards. Pas d'axes, pas de tooltip, dégradé de remplissage. Accepte `data: number[]`, `color: string`, `height: number`.

### `CountUp.jsx`
Anime un nombre vers une cible (rAF + ease-out cubic, 900 ms par défaut). Accepte une fonction `format` pour la sortie (devise, locale, etc.).

### `services/auth.js`
- Token d'accès stocké **uniquement en mémoire** (variable de module)
- `apiFetch(path)` ajoute automatiquement `Authorization: Bearer …`
- Sur **401**, tente un `/auth/refresh` (cookie httpOnly), rejoue la requête une fois
- `bootstrapSession()` au mount de `<App>` : tente un refresh silencieux pour restaurer la session

### Login (en deux étapes)
1. **Credentials** — email + mot de passe → `POST /auth/login`
   - Si `mfaRequired: true` → passe à l'étape MFA en gardant le `challengeId`
   - Sinon → token reçu, redirection
2. **MFA** — code à 6 chiffres → `POST /auth/mfa/verify`
   - Sélecteur de méthode (Email / TOTP) si plusieurs disponibles
   - Bouton "Renvoyer le code" pour la méthode email
   - Bouton retour pour ressaisir le mot de passe

## Bento Dashboard

```
Row 1   ┌──── KPI 1 ──┬── KPI 2 ──┬── KPI 3 ──┬── KPI 4 ────┐   (sparkline + count-up)
        └──────────────┴───────────┴───────────┴─────────────┘
Row 2   ┌─────── Évolution 6M (3M/6M/12M segmented) ─────┬──── Top clients à risque ─┐
        └──────────────────────────────────────────────────┴────────────────────────────┘
Row 3   ┌──────────────────── Insight IA banner ────────────────────────────────────────┐
        └────────────────────────────────────────────────────────────────────────────────┘
Row 4   ┌─────── Répartition (Bar) ──────────┬─────── Activité récente (timeline) ────┐
        └──────────────────────────────────────┴───────────────────────────────────────┘
Row 5   ┌─── Part impayé/payé (Doughnut) ────┬─────── Storytelling form ─────────────┐
        └─────────────────────────────────────┴────────────────────────────────────────┘
```

Chaque cellule entre en scène via `framer-motion` avec un délai progressif (`i * 0.04s`).

## Mode "DB-less" (frontend)

Quand le backend retourne 503 (DB hors-ligne) ou est inaccessible, les pages clés affichent des données mock pour permettre le développement et la démo :

- `Dashboard` → KPIs simulés (1 248 320 €, 184 impayés, 92 clients, 6 784 € moyen)
- `Impayes` → 8 dossiers représentatifs (mix CRITIQUE / ÉLEVÉ / MOYEN / BAS, IMPAYÉ / PARTIEL / PAYÉ)
- `Notifications` → 5 alertes
- `Storytelling` & `Chat` → formulaires fonctionnels, fallback texte si l'IA n'est pas disponible

## Build

```bash
npm run dev        # http://localhost:5173 (HMR Vite)
npm run build      # dist/ — ~30 KB CSS gz, ~200 KB JS gz
npm run preview    # serve le bundle de prod localement
```
