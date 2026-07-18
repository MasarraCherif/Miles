# 09 — Roadmap & idées de business logic

> Ce document liste des fonctionnalités à forte valeur ajoutée pour MILES, classées par **gain métier**, avec une estimation d'effort. Toutes sont cohérentes avec l'architecture en place.

---

## 🎯 Tier 1 — Quick wins à très fort impact

### 1. Stratégie de relance multi-étapes (dunning workflow)

**Problème métier** : aujourd'hui un mail = un événement isolé. Or le recouvrement est un **enchaînement** : J+1 rappel doux → J+7 sérieux → J+14 critique → J+21 mise en demeure → contentieux.

**Implémentation** :
- Table `dunning_workflows` : étapes ordonnées { délai_jours, template, canal (mail/SMS/appel), condition_arrêt (paiement reçu) }
- Cron quotidien (`node-cron`) qui scanne les impayés et déclenche les bonnes étapes
- Suspendre automatiquement le workflow si paiement détecté
- Dashboard "Pipeline de relance" : combien de clients à chaque étape

**Effort** : ~3 jours · **Impact** : 🚀🚀🚀 (le cœur du métier)

---

### 2. Score de risque dynamique (scoring engine)

**Problème métier** : aujourd'hui le `niveau_risque` est statique. Il devrait évoluer avec les comportements (paiements, retards, communications).

**Implémentation** :
- Module `src/scoring/engine.js` — pondérations configurables (admin) :
  - Ancienneté de l'impayé
  - Nombre d'incidents historiques
  - Taux d'endettement
  - Réactivité aux relances précédentes
  - Secteur d'activité
- Recalcul automatique sur événements (paiement, nouveau impayé, mail ouvert)
- Endpoint `POST /api/scoring/recompute/:clientId`
- Évolution du score visible en sparkline sur la fiche client

**Effort** : ~4 jours · **Impact** : 🚀🚀🚀

---

### 3. Promesses de paiement (payment promises)

**Problème métier** : un client appelle, promet de payer "vendredi". Aujourd'hui : note papier, oublié.

**Implémentation** :
- Table `payment_promises` : { client_id, montant, date_promise, créé_par, statut: pending|kept|broken }
- UI : bouton "Enregistrer une promesse" sur la fiche client
- Cron quotidien qui marque "broken" si la date est passée sans paiement
- Une promesse rompue impacte le score + déclenche un workflow de relance accéléré
- KPI Dashboard : "Promesses en attente cette semaine"

**Effort** : ~2 jours · **Impact** : 🚀🚀🚀 (très demandé par les agents)

---

### 4. Notes & historique de communication par client

**Problème métier** : aucun moyen de tracer "j'ai appelé Atlas Trading le 12/04, ils ont demandé un délai".

**Implémentation** :
- Table `client_communications` : { client_id, type: call|mail|note|sms, content, agent_id, date, outcome }
- Onglet "Historique" sur la fiche client (timeline verticale comme l'activity feed du dashboard)
- Auto-log : tout mail envoyé via `/api/mail/send` y atterrit automatiquement
- Recherche full-text sur les notes
- Exportable PDF pour le contentieux

**Effort** : ~2-3 jours · **Impact** : 🚀🚀🚀

---

### 5. Plans de paiement échelonné (installments)

**Problème métier** : pour les CRITIQUE, le client peut négocier un échéancier 3-6-12 mois. Il faut le tracer.

**Implémentation** :
- Table `payment_plans` : { client_id, créé_par, total, statut, créé_le }
- Table `installments` : { plan_id, n°, date_due, montant, statut: due|paid|late }
- UI de création : montant total + nombre d'échéances → calcul auto + tableau modifiable
- Cron qui vérifie les échéances dues et déclenche relances ciblées
- Génération automatique d'un PDF du plan signé

**Effort** : ~3-4 jours · **Impact** : 🚀🚀🚀

---

## 🎯 Tier 2 — Différenciants forts

### 6. Prédiction de paiement (ML)

**Problème métier** : "lequel de mes 50 dossiers vais-je récupérer en priorité ?"

**Implémentation** :
- Modèle simple (régression logistique sur sklearn ou directement avec Llama via Groq) : entrée = caractéristiques client, sortie = probabilité de paiement à 30 jours
- Endpoint `GET /api/predictions/:clientId` qui combine le score + la proba
- Tri du dashboard "Top clients à risque" par **probabilité de récupération × montant** (= valeur attendue), pas juste par montant brut

**Effort** : 1 semaine (avec données historiques) · **Impact** : 🚀🚀

---

### 7. Détection d'anomalies & alertes intelligentes

**Problème métier** : un client paie 5 000 € mensuel depuis 3 ans, soudain rien depuis 2 mois → ce n'est pas un retard banal, c'est un signal.

**Implémentation** :
- Job nocturne qui calcule la déviation du comportement de paiement (z-score sur le delay vs historique)
- Si > seuil → notification automatique avec contexte
- Apparaît dans la timeline d'activité du dashboard avec icône warning

**Effort** : ~3 jours · **Impact** : 🚀🚀

---

### 8. Multi-canal : SMS et WhatsApp

**Problème métier** : les mails arrivent souvent en SPAM. SMS et WhatsApp ont des taux d'ouverture > 95 %.

**Implémentation** :
- Adaptateur dans `src/messaging/`
  - `sms.js` (Twilio / OVH SMS)
  - `whatsapp.js` (WhatsApp Cloud API)
- Templates équivalents aux mails, plus courts (160 caractères pour SMS)
- Le workflow de dunning choisit le canal selon l'étape (J+1: SMS amical, J+7: mail, J+14: appel + mail)

**Effort** : ~3 jours · **Impact** : 🚀🚀🚀 (gros gain de taux de réponse)

---

### 9. Portail self-service client

**Problème métier** : les clients veulent payer en ligne sans appeler.

**Implémentation** :
- Sous-domaine `pay.miles.io/<token>` avec route publique sécurisée par token signé
- Le mail de relance contient `payUrl` qui pointe vers cette page
- La page affiche : montant dû, options (paiement immédiat ou échéancier auto-proposé), CTA Stripe / Paymee
- Webhook de confirmation → marque l'impayé `PAYÉ` + envoie le template `paye`

**Effort** : 1 semaine (avec intégration paiement) · **Impact** : 🚀🚀🚀 (réduit drastiquement les appels)

---

### 10. Génération de courriers PDF (mise en demeure)

**Problème métier** : pour les dossiers contentieux, il faut un PDF avec mention légale, signature, en-tête société.

**Implémentation** :
- `pdfkit` ou `puppeteer` pour générer un PDF signé numériquement à partir du même contenu Handlebars
- Endpoint `POST /api/documents/mise-en-demeure/:clientId` → renvoie un PDF
- Stocké dans `documents/<client_id>/<date>.pdf`, accessible depuis la fiche client

**Effort** : ~2 jours · **Impact** : 🚀🚀

---

## 🎯 Tier 3 — Nice to have / outillage

### 11. Tableau d'analyse cohorte
"Les clients onboardés en 2024 Q2 ont un taux d'impayé de X% à 12 mois, vs Y% pour Q1." Permet d'évaluer la qualité du sourcing.

### 12. UI d'enrôlement TOTP `/settings/security`
Aujourd'hui l'API existe mais pas l'écran. Ajouter une page **Sécurité** avec QR code + champ de confirmation.

### 13. UI de mailing en masse
Page `/relances` qui liste les clients par situation, pré-rempli un template, preview en iframe (`/api/mail/preview`), bouton "Envoyer à tous les sélectionnés".

### 14. Webhooks sortants
Émettre des événements JSON vers une URL configurable (`payment_received`, `escalation_needed`, etc.) pour intégration CRM.

### 15. Import CSV des clients / impayés
Pour le bootstrapping. Endpoint `POST /api/import/csv` (admin), validation Joi, dry-run, rapport d'erreurs ligne à ligne.

### 16. Multi-tenancy
Si la solution est vendue à plusieurs sociétés de financement : ajouter un `tenant_id` partout, JWT contient le tenant, filtrage automatique des requêtes. Investissement structurel à faire **avant** d'avoir trop de données.

### 17. Plage horaire de relance & RGPD
- Pas de mails entre 21h et 8h
- Respect des opt-outs (header `List-Unsubscribe`)
- Page de gestion des consentements client

### 18. Mode lecture seule pour le contentieux externe
Lien temporaire signé qui donne accès en lecture seule à un dossier précis (avocat, huissier).

### 19. Indicateurs avancés
- **DSO** (Days Sales Outstanding) — jours moyens d'encaissement
- **Recovery rate** par cohorte / par agent
- **Promised vs received** ratio
- **Mail open rate** par template (nécessite tracking pixel)

### 20. Espace agent
- "Mes dossiers" filtré par `assigned_to`
- Objectifs hebdo (montant à récupérer, nombre d'appels)
- Leaderboard interne (gamification douce)

---

## 🛡️ Sécurité — niveau enterprise

| # | Item | Effort |
|---|------|--------|
| 21 | **Single Sign-On** SAML / OIDC (entreprise cliente avec AD) | 1 sem |
| 22 | **WebAuthn / passkeys** comme méthode MFA additionnelle | 3 j |
| 23 | **Audit log immuable** vers une append-only DB (SQLite WAL ou PostgreSQL avec triggers) | 2 j |
| 24 | **Détection d'usurpation** sur refresh token (réutilisation d'un `jti` révoqué = forçage du logout global de l'utilisateur) | 1 j |
| 25 | **Chiffrement au repos** des secrets (TOTP, refresh tokens) avec KMS | 2 j |
| 26 | **Rate-limit distribué** Redis (multi-instance ready) | 1 j |
| 27 | **Dependabot + Snyk** dans CI pour les CVE | 2 h |
| 28 | **Pen test** annuel + bug bounty programme | externe |

---

## 📊 Quel ordre attaquer ?

Recommandé pour les 6 prochaines semaines :

| Sprint | Items | Pourquoi |
|--------|-------|----------|
| Sprint 1 | #4 Notes & historique + #3 Promesses | Données qui manquent fondamentalement aujourd'hui |
| Sprint 2 | #1 Workflow de relance + UI mailing en masse (#13) | Le cœur métier |
| Sprint 3 | #5 Plans de paiement + génération PDF (#10) | Pour fermer la boucle CRITIQUE |
| Sprint 4 | #2 Scoring dynamique + #6 Prédiction | Différenciation IA |
| Sprint 5 | #8 SMS / WhatsApp + #9 Portail self-service | Effet levier sur le taux de récupération |
| Sprint 6 | #12 UI TOTP + #21 SSO + #19 Indicateurs avancés | Maturité enterprise |

Chaque sprint est autonome — vous pouvez réordonner selon les priorités commerciales.
