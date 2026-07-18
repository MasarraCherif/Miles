# 01 — Overview & MVP

## Mission

Donner aux équipes de recouvrement (banques, sociétés de financement, leasing) un poste de travail unifié pour :

1. **Visualiser** la pression des impayés en temps réel (KPIs, tendances, top clients à risque)
2. **Prioriser** les dossiers via un scoring de risque automatisé
3. **Comprendre** chaque client grâce à un storytelling propulsé par l'IA
4. **Agir** avec des relances personnalisées par situation (CRITIQUE / ÉLEVÉ / MOYEN / BAS / PAYÉ)
5. **Décider** des nouveaux crédits via un assistant d'évaluation de solvabilité

## Périmètre MVP

### ✅ Inclus dans le MVP actuel

| Module | Description | Statut |
|--------|-------------|--------|
| **Dashboard** | KPI animés avec sparklines, graphiques évolution / répartition / part impayé, top clients à risque, timeline d'activité | ✅ Livré |
| **Liste des impayés** | Table filtrable (statut, recherche), badges de statut/risque, compteurs dynamiques, exports | ✅ Livré |
| **Notifications de risque** | Cartes d'alerte par sévérité (CRITIQUE / ÉLEVÉ / MOYEN), avec icônes contextuelles | ✅ Livré |
| **Storytelling client** | Génération IA contextualisée par client (Groq Llama 3.1) en FR/EN/ES/AR | ✅ Livré |
| **Assistant crédit** | Chat guidé d'évaluation de solvabilité avec barre de progression et résultat structuré | ✅ Livré |
| **Authentification** | Login email/password, JWT (access + refresh), MFA TOTP + email, lockout, audit | ✅ Livré |
| **Mailing personnalisé** | Templates Handlebars par situation, mode mock-outbox, multi-langue | ✅ Livré |
| **Sécurité** | Helmet, rate-limit, CSRF (originGuard), policy mot de passe, endpoint health | ✅ Livré |

### 🚧 Hors-MVP (roadmap)

- UI d'enrôlement TOTP (`/settings/security`)
- UI de mailing en masse (sélection de filtres → preview → envoi)
- Gestion multi-rôles (`agent`, `manager`, `client`)
- Tableau d'audit et logs d'authentification
- Webhooks pour intégration CRM / téléphonie
- Mobile responsive (≥ tablette OK aujourd'hui, mobile à affiner)

## Personas

### 🎯 Marie — Responsable Recouvrement (utilisateur principal)
- **Mission** : superviser le portefeuille d'impayés, fixer les priorités hebdomadaires
- **Pain points** : manque de visibilité globale, données éparpillées entre Excel et le système core
- **Apports MILES** : dashboard unifié, alertes priorisées, mails de relance pré-rédigés

### 🎯 Karim — Agent de recouvrement
- **Mission** : appeler / relancer les clients en retard
- **Apports MILES** : storytelling IA pour préparer les appels, génération de mails contextuels en 1 clic

### 🎯 Sami — Analyste crédit
- **Mission** : décider de l'octroi de crédit pour les nouveaux dossiers
- **Apports MILES** : assistant intelligent pour évaluer rapidement un dossier (taux d'endettement, reste à vivre, score)

### 🎯 Naïma — Responsable Sécurité (transverse)
- **Mission** : garantir la conformité et la traçabilité
- **Apports MILES** : MFA, audit log, JWT court avec rotation, policy mot de passe forte

## Indicateurs de succès du MVP

- Temps de relance moyen divisé par 2 (vs Excel + Outlook manuel)
- Taux de récupération sur les CRITIQUES augmenté de +15 % grâce aux mails ciblés
- 100 % des connexions admin protégées par MFA
- Zéro fuite d'identifiant sur 6 mois (XSS-resistant grâce au token mémoire + cookie httpOnly)
