# ERP Freelance

ERP personnel pour freelances — devis, facturation, CRM, projets, tâches, time tracking et suivi post-livraison dans une seule application.

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
| **Hébergement** | Vercel (Hobby) |
| **Database** | Neon (PostgreSQL serverless) |
| **PDF** | @react-pdf/renderer — couleur accent configurable |
| **Email** | Resend |
| **Uploads** | Vercel Blob |
| **Langage** | TypeScript strict |

---

## Modules

| Module | Fonctionnalités |
|---|---|
| **Dashboard** | Widgets temps réel — tâches du jour, échéances, impayés, alertes renouvellement |
| **CRM — Clients** | Fiche client (view/edit animé), type & température, interactions, rappels, tâches associées |
| **Tâches** | Vue globale groupée Client → Projet → Tâches, édition inline du titre, sheet d'édition complète (priorité, importance, échéance, description, heures), sous-tâches |
| **Projets** | Kanban tâches, jalons, livrables, time tracking intégré, journal, liens utiles, membres |
| **Post-dev** | URLs prod/admin/hébergement, renouvellements domaine/hosting, monitoring disponibilité |
| **Facturation / Devis** | Pipeline DRAFT→SIGNED, acomptes, workflow dépôt, envoi email, signature PDF |
| **Facturation / Factures** | Génération depuis devis, types (acompte/solde/récurrent/standalone), suivi paiement, relance |
| **Facturation / Récurrentes** | Modèles avec fréquence, activation/désactivation, génération manuelle |
| **Catalogue produits** | Produits/services réutilisables — unité, prix, TVA, type de facturation |
| **Calendrier** | Vues mois / semaine / jour (grille 24h), sync Google Agenda bidirectionnelle, drag-drop avec animation d'atterrissage, événements journée entière & multi-jours en barres continues (style Google), sélecteurs date/heure custom, raccourcis clavier (C/N, ↵), vue transversale (tâches, factures, jalons, interactions, renouvellements) |
| **Notifications** | Cloche temps réel, dropdown, marquage lu individuel/global |
| **Recherche globale** | `⌘K` — navigation + recherche DB multi-modèles avec debounce 200ms |
| **Paramètres** | Profil entreprise, SIRET, IBAN, logo, couleur PDF, conditions générales, export/import, déconnexion |

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

- **Export** — télécharge `erp-export-YYYY-MM-DD.json` (29 modèles, données métier complètes)
- **Import** — upload d'un fichier JSON via l'UI, import FK-safe en 29 étapes

Pour les migrations d'hébergeur ou les sauvegardes, voir [`docs/EXPORT_IMPORT.md`](docs/EXPORT_IMPORT.md).

```bash
# Import CLI (alternative au UI, pour les cas avancés)
npm run import ./erp-export-2026-05-22.json
```

---

## Architecture

```
src/
├── app/
│   ├── (app)/              # Pages protégées (sidebar + topbar)
│   │   ├── page.tsx        # Dashboard
│   │   ├── client/         # CRM
│   │   ├── taches/         # Vue globale des tâches
│   │   ├── projets/        # Projets, kanban, post-dev, time tracking
│   │   ├── facturation/    # Devis, factures, récurrentes, produits
│   │   ├── calendrier/
│   │   └── settings/
│   └── api/                # Routes API (PDF, upload, cron, webhooks)
├── actions/                # Server Actions
│   ├── crm.ts              # Clients, interactions, rappels
│   ├── export.ts           # Export JSON complet
│   ├── import-data.ts      # Import JSON (server action)
│   ├── facturation.ts      # Devis, factures, paiements, produits
│   ├── notifications.ts
│   ├── postdev.ts          # Post-dev, renouvellements, monitoring
│   ├── projet.ts           # Projets, tâches, jalons, livrables
│   ├── search.ts           # Recherche globale
│   ├── settings.ts         # Profil, suppression compte
│   ├── tags.ts
│   ├── timetracking.ts
│   └── user.ts
├── components/
│   ├── layout/             # Sidebar, CommandPalette (⌘K), TimerBanner
│   ├── modules/            # Composants métier par module
│   └── ui/                 # Button, Input, Dialog…
├── generated/prisma/       # Client Prisma généré (ne pas éditer)
├── lib/                    # auth, prisma, utils
└── scripts/
    └── import.ts           # Script CLI d'import
```

---

## Modèle de données

| Domaine | Modèles |
|---|---|
| Auth | `User`, `Account`, `Session`, `UserProfile` |
| CRM | `Client`, `Interaction`, `Reminder`, `ClientFile` |
| Projets | `Project`, `Task`, `TimeEntry`, `Milestone`, `Deliverable`, `JournalEntry`, `UsefulLink`, `ProjectMember`, `Tag`, `TaskTag` |
| Post-dev | `PostDev`, `Renewal`, `MonitoringCheck` |
| Facturation | `Quote`, `QuoteLine`, `Invoice`, `InvoiceLine`, `Payment`, `Product`, `RecurringInvoice`, `EmailLog` |
| Transversal | `CalendarEvent`, `Notification`, `ConditionsTemplate`, `ProjectIdea` |

---

## Scripts

```bash
npm run dev          # Serveur de développement
npm run build        # Build production (migrate + build)
npm run import       # Import de données : npm run import ./backup.json
npm run seed         # Seed de la base (données de test)
npx prisma studio    # Interface visuelle de la DB
npx prisma migrate dev --name <nom>   # Nouvelle migration
```

---

## Licence

Usage privé.
