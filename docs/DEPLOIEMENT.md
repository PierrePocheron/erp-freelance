# Déploiement — ERP Freelance

## Stack de production

| Couche | Service | Rôle |
|--------|---------|------|
| App | **Vercel** | Hébergement Next.js, déploiement automatique sur `main` |
| Base de données | **Neon** | PostgreSQL managé (connexion via `@prisma/adapter-pg`) |
| Auth | **NextAuth v5** | Google OAuth + liste blanche `AUTH_ALLOWED_EMAILS` |
| Fichiers | **Vercel Blob** | PDF figés des factures, fichiers importés |
| Emails | **Resend** | Envoi des devis / factures / relances |
| Tâche planifiée | **Vercel Cron** | `/api/cron/renewals` chaque jour à 7 h (renouvellements) |

> Il n'y a **pas de base de développement séparée** : `.env.local` pointe sur Neon en production.
> Voir les règles absolues de [`CLAUDE.md`](../CLAUDE.md).

---

## Pipeline

```
branche dev ──(PR, CI)──► release ──► main ──► Vercel
                                                 ├─ npm install + prisma generate (postinstall)
                                                 ├─ prisma migrate deploy        (script build)
                                                 ├─ next build
                                                 └─ déploiement en production
```

- On travaille sur `dev` (ou une branche de fonctionnalité → PR vers `dev`). Les pushes sur `dev` ne déclenchent **pas** de déploiement Vercel (`vercel.json`).
- La mise en production passe par **`npm run release -- <version> "<titre>" [notes.md]`** (`scripts/release.sh`) : bump de version, PR `dev → main`, attente de la CI, merge, tag et release GitHub. Vercel déploie ensuite `main`.
- ⚠️ **Ne jamais lancer `npm run build` en local** : le script build exécute `prisma migrate deploy` contre la base de production. Pour vérifier la compilation : `npx next build`.

---

## Migrations Prisma

Jamais de `prisma migrate dev` (il n'y a pas de base de dev ; la commande peut réinitialiser la base).
Le workflow complet est dans [`CLAUDE.md`](../CLAUDE.md#migrations-prisma-contre-neon-jamais-de-migrate-dev) :

1. modifier `prisma/schema.prisma` ;
2. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (SQL du diff, **additif uniquement**) ;
3. créer `prisma/migrations/<AAAAMMJJHHMMSS>_<nom>/migration.sql` avec ce SQL ;
4. `npx prisma generate` puis `npx prisma migrate deploy`.

Les tests d'intégration utilisent `prisma db push` sur une base **locale** `erp_test` (jamais Neon).

---

## Variables d'environnement

À configurer dans **Vercel → Settings → Environment Variables** (référence : `.env.example`).

```env
# Base de données (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Chiffrement au repos (IBAN/BIC, jetons OAuth) — openssl rand -base64 32
# ⚠️ Une valeur factice ou changée rend les données chiffrées illisibles (panne de connexion déjà vécue).
ENCRYPTION_KEY=

# Auth (NextAuth v5)
AUTH_SECRET=                     # openssl rand -base64 32
AUTH_URL=https://ton-app.vercel.app
AUTH_ALLOWED_EMAILS=toi@exemple.fr   # sans elle, aucune nouvelle inscription possible

# Google OAuth (connexion + Agenda + Contacts)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Emails (Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=ERP <onboarding@resend.dev>

# Fichiers (Vercel Blob)
BLOB_READ_WRITE_TOKEN=

# Vercel Cron — protège /api/cron/*
CRON_SECRET=

# Notifications push (web-push) — npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:toi@exemple.fr

# Optionnels
UPSTASH_REDIS_REST_URL=          # rate-limiter distribué (repli en mémoire si absent)
UPSTASH_REDIS_REST_TOKEN=
PDF_LOGO_FONT_URL=               # police du logo dans les PDF
```

> `TZ` est une variable **réservée** chez Vercel : la production tourne en UTC. Tout le code de dates
> passe par les helpers `zoned*` de `src/lib/dates.ts` (heure de Paris) — ne jamais compter sur le fuseau du serveur.

---

## Déploiement initial

1. **Neon** : créer le projet, copier `DATABASE_URL`.
2. **Vercel** : importer le repo GitHub, renseigner toutes les variables ci-dessus.
3. **Google Cloud** : client OAuth (URI de redirection `https://<app>/api/auth/callback/google`), activer les API Calendar et People.
4. **Première mise en production** : `npm run release -- <version>` depuis `dev` ; le build applique toutes les migrations sur Neon.
