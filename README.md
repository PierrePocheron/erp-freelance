# ERP Freelance

ERP personnel pour freelances — devis, facturation, CRM, projets, time tracking et suivi post-livraison dans une seule application.

## Stack

- **Framework** — Next.js 16 (App Router, Server Actions, Turbopack)
- **UI** — Tailwind CSS v4 + composants Radix / Base UI
- **Base de données** — PostgreSQL + Prisma 7 (output custom `src/generated/prisma`)
- **Auth** — NextAuth.js v5 (Google OAuth + PrismaAdapter)
- **PDF** — @react-pdf/renderer avec styles dynamiques (couleur accent configurable)
- **Email** — Resend
- **Langage** — TypeScript strict

## Modules

| Module | Fonctionnalités |
|---|---|
| **Dashboard** | Widgets temps réel — tâches du jour, échéances, impayés, alertes renouvellement |
| **CRM — Clients** | Fiche client, pipeline de température (COLD/WARM/HOT), interactions (canal + édition), rappels, projets & factures liés, panneau latéral |
| **Projets** | Kanban tâches (priorité, assignation), jalons, livrables, time tracking intégré, journal, liens utiles, membres & collaborateurs |
| **Post-dev** | Suivi post-livraison — URL prod/admin/hébergement, renouvellements domaine/hosting, monitoring de disponibilité |
| **Facturation / Devis** | Pipeline complet DRAFT→SIGNED, acomptes, workflow dépôt (WAITING_DEPOSIT→IN_PROGRESS), envoi email, signature PDF uploadable |
| **Facturation / Factures** | Génération depuis devis, types (acompte/solde/récurrent/standalone), suivi paiement, envoi email + relance, date et heure de création |
| **Facturation / Récurrentes** | Modèles de facturation avec lignes produits, fréquence, activation/désactivation, génération manuelle |
| **Catalogue produits** | Produits/services réutilisables avec unité, prix, TVA, type de facturation |
| **Calendrier** | Vue transversale (tâches, factures, jalons, interactions, renouvellements) |
| **Notifications** | Cloche en temps réel, dropdown avec toutes les notifs, marquage lu individuel/global |
| **Recherche globale** | `⌘K` — navigation instantanée entre pages + recherche DB (clients, projets, devis, factures) avec debounce 200ms |
| **Paramètres** | Profil entreprise, SIRET, IBAN, logo (base64), couleur PDF + palette personnalisée persistée en DB, modèles de conditions générales (CRUD) |

## Démarrage

```bash
# Dépendances
npm install

# Variables d'environnement
cp .env.example .env
# Renseigner DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, RESEND_API_KEY

# Migrations
/opt/homebrew/Cellar/node/25.9.0_3/bin/node node_modules/.bin/prisma db push
# (Node 18+ requis pour le CLI Prisma 7 — Wasm externref)

# Dev
npm run dev
```

## Variables d'environnement

```env
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Architecture

```
src/
├── app/
│   ├── (app)/          # Pages protégées (layout avec sidebar + topbar)
│   │   ├── page.tsx    # Dashboard
│   │   ├── client/     # Module CRM
│   │   ├── projets/    # Projets, tâches, time tracking, post-dev
│   │   ├── facturation/# Devis, factures, récurrentes, produits
│   │   ├── calendrier/
│   │   └── settings/
│   └── api/            # Routes API (PDF devis/facture, export CSV, cron, webhooks)
├── actions/            # Server Actions
│   ├── conditions.ts   # CRUD modèles de conditions générales
│   ├── crm.ts          # Clients, interactions, rappels, fichiers
│   ├── facturation.ts  # Devis, factures, paiements, produits, récurrentes, emails
│   ├── notifications.ts# Lecture / marquage des notifications
│   ├── postdev.ts      # Post-dev, renouvellements, monitoring
│   ├── projet.ts       # Projets, tâches, jalons, livrables, membres, journal
│   ├── search.ts       # Recherche globale multi-modèles
│   ├── settings.ts     # Profil, couleurs accent, suppression compte
│   ├── tags.ts         # Tags projets
│   ├── timetracking.ts # Chronomètre, saisies de temps
│   └── user.ts         # Initialisation client "SELF"
├── components/
│   ├── layout/         # Sidebar, CommandPalette (⌘K), NotificationBell
│   ├── modules/        # Composants métier par module
│   └── ui/             # Composants génériques (Button, Input, Dialog…)
├── generated/prisma/   # Client Prisma généré (ne pas éditer)
└── lib/                # auth, prisma, pdf, utils
```

## Modèle de données (résumé)

| Domaine | Modèles |
|---|---|
| Auth | `User`, `Account`, `Session`, `UserProfile` |
| CRM | `Client`, `Interaction`, `Reminder`, `ClientFile` |
| Projets | `Project`, `Task`, `TimeEntry`, `Milestone`, `Deliverable`, `JournalEntry`, `UsefulLink`, `ProjectMember`, `Tag` |
| Post-dev | `PostDev`, `Renewal`, `MonitoringCheck` |
| Facturation | `Quote`, `QuoteLine`, `Invoice`, `InvoiceLine`, `Payment`, `Product`, `RecurringInvoice`, `RecurringInvoiceLine`, `EmailLog` |
| Calendrier | `CalendarEvent` |
| Notifications | `Notification` |
| Paramètres | `ConditionsTemplate` |

## Notes Prisma

Le client Prisma est généré dans `src/generated/prisma/` (output custom).

Le CLI Prisma 7 requiert **Node 18+** (Wasm `externref`) — utiliser le Node Homebrew pour les migrations :
```bash
/opt/homebrew/Cellar/node/25.9.0_3/bin/node node_modules/.bin/prisma db push
```

En dev, le client Prisma est mis en cache dans `globalThis.prisma`. Après un `db push` + `prisma generate`, **redémarrer le serveur** pour que les nouveaux délégués de modèles soient pris en compte.

## Licence

Usage privé.
