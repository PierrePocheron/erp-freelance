# ERP Freelance

ERP personnel pour freelances — devis, facturation, CRM, projets, time tracking et suivi post-livraison dans une seule application.

## Stack

- **Framework** — Next.js 16 (App Router, Server Actions, Turbopack)
- **UI** — Tailwind CSS v4 + composants Radix / Base UI
- **Base de données** — PostgreSQL + Prisma 7 (output custom `src/generated/prisma`)
- **Auth** — NextAuth.js v5 (Google OAuth + PrismaAdapter)
- **PDF** — @react-pdf/renderer avec styles dynamiques (couleur accent configurable)
- **Email** — Resend
- **Fichiers** — Vercel Blob
- **Langage** — TypeScript strict

## Modules

| Module | Fonctionnalités |
|---|---|
| **Dashboard** | Widgets temps réel — tâches du jour, échéances, impayés, alertes renouvellement |
| **Module client** | Fiche client, pipeline de température, interactions (canal + édition), rappels, projets liés |
| **Projets** | Kanban tâches, jalons, livrables, time tracking intégré, liens & renouvellements |
| **Facturation / Devis** | Pipeline complet DRAFT→SIGNED, acomptes, workflow dépôt (WAITING_DEPOSIT→IN_PROGRESS), vue liste/cartes |
| **Facturation / Factures** | Génération depuis devis, types (acompte/solde/récurrent/standalone), suivi paiement, vue liste/cartes |
| **Facturation / Récurrentes** | Modèles de facturation avec lignes produits, fréquence, activation/désactivation |
| **Catalogue produits** | Produits/services réutilisables avec unité, prix, TVA, type de facturation |
| **Calendrier** | Vue transversale (tâches, factures, jalons, interactions, renouvellements) |
| **Paramètres** | Profil entreprise, SIRET, IBAN, logo, couleur PDF, conditions générales par défaut |

## Démarrage

```bash
# Dépendances
npm install

# Variables d'environnement
cp .env.example .env
# Renseigner DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, BLOB_READ_WRITE_TOKEN, RESEND_API_KEY

# Migrations
npx prisma migrate deploy

# Seed (optionnel)
npm run seed

# Dev
npm run dev
```

## Variables d'environnement

```env
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
BLOB_READ_WRITE_TOKEN=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Architecture

```
src/
├── app/
│   ├── (app)/          # Pages protégées (layout avec sidebar)
│   │   ├── page.tsx    # Dashboard
│   │   ├── crm/        # Module client
│   │   ├── projets/    # Projets & tasks
│   │   ├── facturation/# Devis, factures, récurrentes, produits
│   │   ├── calendrier/
│   │   └── settings/
│   ├── api/            # Routes API (PDF, upload, auth)
│   └── login/
├── actions/            # Server Actions (crm, facturation, projets…)
├── components/
│   ├── modules/        # Composants métier par module
│   └── ui/             # Composants génériques (Button, Input, Dialog…)
├── generated/prisma/   # Client Prisma généré (ne pas éditer)
└── lib/                # auth, prisma, pdf, utils
```

## Notes Prisma

Le client Prisma est généré dans `src/generated/prisma/` (output custom). Certains modèles ont été ajoutés via migrations SQL brutes (`RecurringInvoice`, `RecurringInvoiceLine`) sans regénération du client — ils sont accédés via le pattern `(prisma as never as { model: ... }).model`.

Les champs ajoutés manuellement (`pdfAccentColor`, `defaultConditions`, `logoUrl` sur `UserProfile`) nécessitent une mise à jour de `src/generated/prisma/models/UserProfile.ts` après `prisma generate`.

## Licence

Usage privé.
