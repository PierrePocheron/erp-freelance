# Déploiement — ERP Freelance

## Stack de production

| Couche | Service | Rôle |
|--------|---------|------|
| App | **Vercel** | Hébergement Next.js, CD automatique |
| Base de données | **Neon** | PostgreSQL managé, serverless |
| Auth | **NextAuth v5** | Google OAuth |
| Fichiers | **Cloudinary** | Upload et stockage des assets |

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│                        TON POSTE LOCAL                      │
│                                                             │
│  code + schema.prisma  →  git commit  →  git push main     │
└─────────────────────────────┬───────────────────────────────┘
                              │  webhook GitHub
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                           VERCEL                            │
│                                                             │
│  1. Détecte le push sur main                                │
│  2. Clone le repo                                           │
│  3. npm install                                             │
│  4. ⚡ prisma migrate deploy  ← applique les migrations     │
│  5. next build                                              │
│  6. Deploy en production                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │  migration SQL + requêtes app
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                        NEON (PostgreSQL)                    │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  _prisma_migra- │    │  tables métier               │   │
│  │  tions (suivi)  │    │  clients, invoices, tasks…   │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│                                                             │
│  ✅ Données conservées — migrations non-destructives        │
└─────────────────────────────────────────────────────────────┘
```

---

## Pipeline CD — Comment ça fonctionne

### Cas 1 — Modification de code uniquement (sans schéma)

```
git push main
      │
      ▼
 Vercel build
      │
      ├─ npm install
      ├─ prisma generate     (génère le client TypeScript)
      ├─ next build
      └─ deploy ✅

→ Aucune migration, Neon non touché
```

### Cas 2 — Modification du schéma Prisma

```
# En local :
1. Modifier schema.prisma
2. npx prisma migrate dev --name "add_column_xyz"
   └─ crée : prisma/migrations/20240520_add_column_xyz/migration.sql
3. git add prisma/
4. git commit + push main

      │
      ▼
 Vercel build
      │
      ├─ npm install
      ├─ prisma migrate deploy   ← applique migration.sql sur Neon
      │     └─ ALTER TABLE ... ADD COLUMN xyz  (jamais de DROP)
      ├─ next build
      └─ deploy ✅

→ Neon mis à jour, données conservées ✅
```

---

## Règle d'or — Les 3 commandes Prisma

```
┌──────────────────────┬──────────────────────────────────────┐
│ Commande             │ Usage                                │
├──────────────────────┼──────────────────────────────────────┤
│ prisma migrate dev   │ EN LOCAL uniquement                  │
│                      │ Crée les fichiers .sql de migration  │
│                      │ Peut réinitialiser la DB locale      │
├──────────────────────┼──────────────────────────────────────┤
│ prisma migrate deploy│ EN PRODUCTION (Vercel)               │
│                      │ Applique SEULEMENT les migrations    │
│                      │ en attente — jamais de DROP          │
│                      │ Sans risque pour les données ✅      │
├──────────────────────┼──────────────────────────────────────┤
│ prisma db push       │ ⛔ JAMAIS en production              │
│                      │ Synchronise brutalement              │
│                      │ Peut supprimer des colonnes/tables   │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Structure des migrations dans le repo

```
erp/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20240101_init/
│       │   └── migration.sql        ← "CREATE TABLE clients..."
│       ├── 20240315_add_tasks/
│       │   └── migration.sql        ← "CREATE TABLE tasks..."
│       └── 20240520_add_column_xyz/
│           └── migration.sql        ← "ALTER TABLE clients ADD COLUMN xyz"
```

Chaque migration est un **fichier SQL versionné dans git**.
Tu sais exactement ce qui a été appliqué, quand, et tu peux revenir en arrière.

---

## Configuration requise

### `package.json` — Script build

```json
{
  "scripts": {
    "build": "prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

> `prisma migrate deploy` s'exécute **avant** le build à chaque déploiement Vercel.

### `prisma/schema.prisma` — Double URL Neon

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // connexion poolée (requêtes app)
  directUrl = env("DIRECT_URL")     // connexion directe (migrations)
}
```

**Pourquoi deux URLs ?**
Neon utilise un connection pooler (PgBouncer) pour les requêtes normales — rapide et scalable.
Mais Prisma a besoin d'une connexion directe sans pooler pour exécuter les migrations, sinon elles échouent.

---

## Variables d'environnement Vercel

À configurer dans **Vercel → Settings → Environment Variables** :

```env
# Base de données Neon
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Auth
NEXTAUTH_SECRET=une-clé-aléatoire-longue
NEXTAUTH_URL=https://ton-app.vercel.app

# Google OAuth (Google Cloud Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Cloudinary (si upload de fichiers)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## Étapes de déploiement initial

```
Étape 1 — Créer la DB sur Neon
  → neon.tech → New Project
  → Copier DATABASE_URL (pooled) et DIRECT_URL (direct)

Étape 2 — Connecter Vercel au repo GitHub
  → vercel.com → New Project → Import depuis GitHub
  → Sélectionner le repo erp-freelance

Étape 3 — Configurer les variables d'env sur Vercel
  → Settings → Environment Variables
  → Coller toutes les clés ci-dessus

Étape 4 — Modifier package.json
  → "build": "prisma migrate deploy && next build"

Étape 5 — Modifier schema.prisma
  → Ajouter directUrl = env("DIRECT_URL")

Étape 6 — Commit + push main
  → Vercel build automatique
  → prisma migrate deploy applique toutes les migrations sur Neon
  → App en production ✅
```

---

## Workflow quotidien (une fois déployé)

```
┌─ Modification CODE uniquement ──────────────────────────────┐
│  git commit + push main  →  Vercel rebuild  →  deploy ✅    │
└─────────────────────────────────────────────────────────────┘

┌─ Modification SCHÉMA ───────────────────────────────────────┐
│  1. modifier schema.prisma                                  │
│  2. npx prisma migrate dev --name "description"             │
│  3. git add prisma/ && git commit + push main               │
│  4. Vercel : prisma migrate deploy → next build → deploy ✅  │
└─────────────────────────────────────────────────────────────┘
```

---

## Futur — Migration vers un serveur dédié (serveur pote)

Quand tu seras prêt à migrer sur un VPS, le process sera :

```
docker-compose.yml
  ├─ service: app (Next.js)
  ├─ service: postgres (PostgreSQL)
  └─ service: caddy (reverse proxy + HTTPS automatique)
```

Le principe reste identique : `prisma migrate deploy` au démarrage du container.
Les données PostgreSQL sont dans un volume Docker persistant (pas de perte si redémarrage).

> Voir `docs/DEPLOIEMENT_VPS.md` (à créer le moment venu)
