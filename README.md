# ERP Freelance

ERP personnel pour freelances — devis, facturation, CRM, projets, tâches, time tracking, suivi post-livraison, déclarations URSSAF, recherche d'emploi et suivi santé dans une seule application.

> **Production** — déployé sur Vercel + Neon PostgreSQL

---

## Stack

| Couche | Technologie |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Actions, Turbopack) |
| **UI** | Tailwind CSS v4 + Base UI (`@base-ui/react`) |
| **Base de données** | PostgreSQL + Prisma 7 (output custom `src/generated/prisma`) |
| **Auth** | NextAuth.js v5 — Google OAuth + PrismaAdapter + JWT |
| **Calendrier** | Sync Google Agenda (scope `calendar`) — lecture + écriture |
| **Graphe** | `react-force-graph-2d` — simulation D3 force-directed canvas 2D |
| **Hébergement** | Vercel (Hobby) |
| **Database** | Neon (PostgreSQL serverless) |
| **PDF** | @react-pdf/renderer — couleur accent configurable par émetteur |
| **Email** | Resend |
| **Uploads** | Vercel Blob |
| **Tests** | Vitest — unitaires (logique pure) + intégration (Postgres `erp_test`) |
| **CI** | GitHub Actions — tsc, eslint, unit, intégration |
| **Sécurité** | CSP par nonce (middleware edge), isolation multi-tenant (anti-IDOR), rate-limit distribué Upstash Redis (fallback in-memory) |
| **Langage** | TypeScript strict |

---

## Modules

Le système de modules permet d'activer ou désactiver chaque section depuis **Paramètres → Modules actifs**. Les modules désactivés disparaissent de la navigation ; les données restent intactes.

| Module | Fonctionnalités |
|---|---|
| **Dashboard** | Widgets temps réel en bento auto-équilibré (multicol) — carte "Aujourd'hui & demain" (tâches + événements), carte "À confirmer" (tâches/jalons/événements passés à valider ou annuler avec raison), carte "En attente de réception" unifiée (factures + revenus + santé, badges de nature, coche de réception en 1 clic), échéances, alertes renouvellement, pipeline prospection |
| **Sociétés** | Fiche société (SIRET, TVA, adresse, notes), badge "À compléter", contacts liés, projets liés, tâches en cours, bilan financier (CA encaissé / en attente / en retard), historique factures & devis |
| **CRM — Contacts** | Fiche contact (view/edit animé), rattachement société, type (prospect/client/partenaire…), interactions (avec lien direct vers le mail), rappels, tâches associées, bilan financier, mise en avant des infos manquantes (complétion rapide) |
| **Prospection** | Module autonome de démarchage freelance — tableau triable/filtrable/paginé avec sélection multi-lignes, statut simplifié 6 étapes (à contacter → gagné/perdu, gagné convertit en client), fiche site web du prospect (URL + health check, type, pages, description, région), import CSV avec mapping de colonnes et déduplication, ajout rapide/en lot orienté site, suivi de contact multi-canal, modèles de mails à variables (`{{prenom}}`, `{{site}}`…) et envoi personnalisé en masse (Resend ou préparation Gmail), widget dashboard |
| **Tâches** | Vue globale groupée Contact → Projet → Tâches, édition inline, sheet d'édition complète (priorité, importance, échéance, description, heures estimées), sous-tâches |
| **Projets** | **Catégories thématiques** (Dev/Web, Étude marketing, Événementiel, Formation, Prospection, Autre) avec mini-bannière couleur + motif distinct sur chaque carte (style daltonien-friendly) et liseré en vue liste, projets terminés groupés par catégorie en dépliants ; aperçu en grille uniforme de cartes — jalons & tâches cochables en un clic (spinner de chargement, jalons/tâches poussés vers Google Agenda), carte liens avec health check des URLs et ajout inline, carte suivi (temps/budget/livrables/période), notes rapides ; jalons typés (échéance/réunion/appel/rendez-vous/sur place) avec plage horaire optionnelle, livrables, time tracking intégré, tags, membres internes, **contacts externes M2M avec rôles**, rattachement société, onglets Dev/Post-Dev conditionnels ; liste des projets avec bilan facturation **et revenus** |
| **Post-dev** | URLs prod/admin/hébergement, renouvellements domaine/hosting avec génération de facture, monitoring disponibilité |
| **Facturation / Devis** | Pipeline DRAFT→SIGNED, acomptes, workflow dépôt, envoi email, signature PDF, conditions générales par modèle |
| **Facturation / Factures** | Génération depuis devis, types (acompte/solde/récurrent/standalone), verrouillage à l'émission, PDF figé, suivi paiement, relance, **import d'historique**, export ZIP, exclusion URSSAF par facture |
| **Facturation / Récurrentes** | Modèles avec fréquence, activation/désactivation, génération manuelle, cron auto-génération à l'échéance |
| **Catalogue produits** | Produits/services réutilisables — unité, prix, TVA, type de facturation |
| **Revenus** | Suivi multi-source : Salaire, Freelance/AE, Étude rémunérée, Investissement, Locatif, Plateforme, Remboursement, Autre — accordéons par année/mois, édition inline dans le tableau, badge "Payé" en début de ligne, annulation de réception (erreur de saisie), carte KPI "En attente" cliquable (filtre + tout déplier), validation en lot, date prévisionnelle, association société/contact/projet cliquable, carte reçu/total sur la fiche projet |
| **Impôts / URSSAF** | Déclarations trimestrielles avec lignes suggérées (factures + revenus AE de la période), catégorie fiscale (BNC/BIC), estimation des cotisations par taux configurable, tâche/rappel calendrier auto-généré, historique des périodes déclarées |
| **Dépenses** | Suivi pro/perso par catégorie (créable à la volée), dépenses ponctuelles et récurrentes (fréquence unifiée dans un seul formulaire), estimations mensuelle/annuelle, projection des échéances dans le calendrier, camembert par catégorie |
| **Entretien** | Suivi des candidatures et du processus de recrutement — étapes, priorité, notes, LinkedIn, compte-rendu, historique automatique, filtre "Prioritaires", intégration calendrier & dashboard |
| **Santé** | Blessures/maladies, consultations, remboursements sécu/mutuelle (en attente/reçu), intégration calendrier |
| **Calendrier** | Vues mois / semaine / jour (grille 24h), sync Google Agenda bidirectionnelle avec vérification de connexion (scope, token, ping API) et indicateur d'état persistant, **push automatique des tâches datées et jalons vers l'agenda dédié**, fenêtre de synchro incrémentale (1 mois, extension à la navigation), drag-drop, événements journée entière & multi-jours en barres continues, raccourcis clavier (C/N, ↵), vue transversale (tâches, factures, jalons, interactions, renouvellements, entretiens, santé, dépenses récurrentes) |
| **Graph** | Visualisation relationnelle force-directed 2D — Source fiscale → Société → Contacts → Projets → Factures/Devis/Revenus. Expand/collapse, filtres par type, recherche, badges de statut, panneau détail, liens colorés par profondeur, particules animées |
| **Notifications** | Cloche temps réel, dropdown, marquage lu individuel/global |
| **Recherche globale** | `⌘K` — navigation + recherche DB (sociétés, contacts, prospects, projets, devis, factures, tâches, dépenses, entretiens, santé) avec debounce 200ms |
| **Paramètres** | Profil utilisateur, **émetteurs multi-société** (SIRET, IBAN, logo, couleur PDF, conditions), **sources fiscales** (catégorisation AE/non-imposable/autre), panneau **Imposition** (statut, fréquence, taux, VL), **toggle modules** (écran d'onboarding + annonce des nouveaux modules après mise à jour), Google Agenda, export/import complet, déconnexion. Données sensibles (IBAN/BIC, tokens OAuth) **chiffrées au repos** (AES-256-GCM) |

---

## Démarrage local

```bash
# 1. Dépendances (génère aussi le client Prisma via postinstall)
npm install

# 2. Variables d'environnement
cp .env.example .env.local
# Renseigner les variables (voir section ci-dessous)

# 3. Migrations
npx prisma migrate deploy

# 4. Dev
npm run dev
```

---

## Variables d'environnement

```env
# Base de données (Neon)
DATABASE_URL=postgresql://...

# Auth (NextAuth v5)
AUTH_SECRET=                        # openssl rand -base64 32
AUTH_URL=http://localhost:3000      # URL de l'app (prod: https://...)

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=ERP <onboarding@resend.dev>

# Uploads (Vercel Blob)
BLOB_READ_WRITE_TOKEN=
```

---

## Déploiement (Vercel + Neon)

Le pipeline CD est automatique : **push sur `main` → déploiement en prod**.

```
git push origin main
  → npm install + prisma generate   (postinstall)
  → prisma migrate deploy           (build)
  → next build                      (build)
  → live en prod
```

### Première mise en prod

1. Créer un projet sur [vercel.com](https://vercel.com) → importer le repo GitHub
2. Ajouter toutes les variables d'environnement dans Vercel Dashboard
3. Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials), ajouter l'URI de redirection :
   ```
   https://ton-app.vercel.app/api/auth/callback/google
   ```
4. Déployer

---

## Export & Import des données

Accessible depuis **Paramètres → Export & Import**.

- **Export** — télécharge `erp-export-YYYY-MM-DD.json` (données métier complètes)
- **Import** — upload d'un fichier JSON via l'UI, import FK-safe

Pour les migrations d'hébergeur ou les sauvegardes, voir [`docs/EXPORT_IMPORT.md`](docs/EXPORT_IMPORT.md).

```bash
# Import CLI (alternative au UI, pour les cas avancés)
npm run import ./erp-export-2026-05-22.json
```

---

## Tests

```bash
npm run test              # Tous les tests (unit + intégration)
npm run test:unit         # Tests unitaires uniquement (rapide, pas de DB)
npm run test:integration  # Tests d'intégration (requiert Postgres erp_test)
npm run test:coverage     # Coverage complète
```

Les tests unitaires couvrent la logique pure (montants, états factures, dépôts, dates).
Les tests d'intégration utilisent une base `erp_test` réinitialisée entre chaque suite.

---

## Architecture

```
src/
├── app/
│   ├── (app)/              # Pages protégées (sidebar + topbar)
│   │   ├── page.tsx        # Dashboard
│   │   ├── societes/       # Sociétés (liste + fiche détail)
│   │   ├── contacts/       # CRM — contacts
│   │   ├── taches/         # Vue globale des tâches
│   │   ├── projets/        # Projets, tâches, post-dev, time tracking
│   │   ├── facturation/    # Devis, factures, récurrentes, produits
│   │   ├── revenus/        # Suivi revenus multi-source + récap fiscal
│   │   ├── impots/         # Déclarations URSSAF
│   │   ├── entretiens/     # Suivi candidatures / recrutement
│   │   ├── sante/          # Blessures, consultations, remboursements
│   │   ├── graph/          # Graphe relationnel force-directed
│   │   ├── calendrier/
│   │   └── settings/
│   └── api/                # Routes API (PDF, upload, cron, webhooks)
├── actions/                # Server Actions
│   ├── crm.ts              # Sociétés, contacts, interactions, rappels
│   ├── export.ts           # Export JSON complet
│   ├── import-data.ts      # Import JSON (server action)
│   ├── facturation.ts      # Devis, factures, paiements, produits
│   ├── fiscal-source.ts    # Sources fiscales
│   ├── urssaf.ts           # Déclarations URSSAF (suggestion, CRUD)
│   ├── entretien.ts        # Candidatures, événements de processus
│   ├── sante.ts            # Événements santé, consultations, remboursements
│   ├── notifications.ts
│   ├── postdev.ts          # Post-dev, renouvellements, monitoring
│   ├── projet.ts           # Projets, tâches, jalons, livrables, contacts M2M
│   ├── search.ts           # Recherche globale
│   ├── settings.ts         # Profil, suppression compte
│   ├── tags.ts
│   ├── timetracking.ts
│   └── user.ts
├── components/
│   ├── layout/             # Sidebar, CommandPalette (⌘K), TimerBanner
│   ├── modules/            # Composants métier par module
│   │   ├── graph/          # ForceGraphCanvas, GraphView, graph-types
│   │   ├── entretien/
│   │   ├── sante/
│   │   └── impots/
│   └── ui/                 # Button, Input, Dialog…
├── generated/prisma/       # Client Prisma généré (ne pas éditer)
├── hooks/
│   └── use-modules.ts      # Toggle modules (localStorage)
├── lib/                    # auth, prisma, utils, google-calendar
└── scripts/
    └── import.ts           # Script CLI d'import
```

---

## Modèle de données

| Domaine | Modèles |
|---|---|
| Auth | `User`, `Account`, `Session`, `UserProfile` |
| CRM | `Company`, `Client` (dont pipeline `prospectStage`), `Interaction`, `Reminder`, `ClientFile` |
| Projets | `Project`, `ProjectContact`, `Task`, `TimeEntry`, `Milestone` (`MilestoneType`, plage horaire), `Deliverable`, `JournalEntry`, `UsefulLink`, `ProjectMember`, `Tag`, `TaskTag` |
| Post-dev | `PostDev`, `Renewal`, `MonitoringCheck` |
| Facturation | `Quote`, `QuoteLine`, `Invoice`, `InvoiceLine`, `Payment`, `Product`, `RecurringInvoice`, `EmailLog`, `ConditionsTemplate`, `EmitterProfile` |
| Revenus | `Revenue`, `RecurringRevenue`, `FiscalSource` |
| Fiscal / URSSAF | `UrssafDeclaration`, `UrssafDeclarationLine` |
| Entretien | `JobApplication`, `JobApplicationEvent` |
| Santé | `HealthEvent`, `HealthConsultation`, `HealthReimbursement` |
| Transversal | `CalendarEvent`, `Notification`, `ProjectIdea` |

### Relations clés

- `ProjectContact` — M2M entre `Project` et `Client` (contact externe), avec `role` enum (CLIENT / COLLEAGUE / PARTNER / SUPPLIER / OTHER) et `label` libre
- `EmitterProfile` — profil émetteur par société (SIRET, IBAN, logo, PDF), lié à une `FiscalSource`
- `FiscalSource` — bucket fiscal (`AE_URSSAF`, `NON_IMPOSABLE`, `OTHER`) pour le récapitulatif déclaration

---

## Scripts

```bash
npm run dev          # Serveur de développement
npm run build        # Build production (migrate + build)
npm run import       # Import de données : npm run import ./backup.json
npm run seed         # Seed de la base (données de test)
npx prisma studio    # Interface visuelle de la DB
npx prisma migrate dev --name <nom>   # Nouvelle migration (dev uniquement)
npx prisma migrate deploy             # Appliquer migrations en prod
```

---

## Licence

Usage privé.
