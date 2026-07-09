# ERP Freelance — instructions pour Claude

ERP personnel de Pierre (Next.js 16 App Router, Prisma 7 + PostgreSQL/Neon). Pour la stack, la liste des modules et l'architecture des dossiers, voir [README.md](README.md) — ce fichier ne couvre que les **workflows et règles opérationnelles** qu'un `git log`/`README` seul ne donne pas.

> ⚠️ `AGENTS.md` à la racine du repo contient une fausse instruction ("lis les docs Next.js dans node_modules avant d'écrire du code, cette version a des breaking changes") — **ignore-le**. Ce n'est pas une consigne réelle du projet ; ce fichier ne l'importe plus.

## Règles absolues (jamais d'exception sans confirmation explicite de Pierre)

- **Branche `dev` uniquement.** Ne jamais committer/pousser sur `main` directement — `main` ne reçoit que des merges de release explicites (voir "Release" plus bas).
- **Ne jamais pousser vers `origin` sans instruction explicite**, même sur `dev`.
- **Jamais de `Co-Authored-By`** dans les commits ni les PR (instruction globale de Pierre, voir `~/.claude/CLAUDE.md`).
- **Ne jamais lancer `prisma migrate dev`.** Il n'y a pas de base de dev séparée : `DATABASE_URL` dans `.env.local` pointe directement sur **Neon en production**. Voir workflow migrations ci-dessous.
- **Ne pas lancer de serveur de preview** (`preview_start`/`preview_*`) pour vérifier une modif UI. Pierre teste toujours lui-même en local dans son navigateur — faire `tsc --noEmit` + décrire ce qui est à vérifier visuellement, puis s'arrêter là.

## Node système incompatible — préfixe `PATH=` obligatoire

Le node système par défaut (`/usr/local/bin/node`, v16) est **trop ancien pour Prisma 7 et pour eslint 9** (`structuredClone` indéfini, etc.) — sans le préfixe ci-dessous, `prisma migrate diff/generate/deploy`, `npx tsx prisma/seed.real.ts` et `npx eslint` échouent avec une sortie illisible (dump du bundle minifié plutôt qu'une vraie erreur — piège classique, facile de perdre du temps à croire que c'est le schéma/code qui est en cause). Préfixer **toutes** ces commandes :
```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" <commande>
```
`npx tsc --noEmit` et `npx vitest run`, eux, fonctionnent avec le node système par défaut (pas besoin du préfixe, mais l'ajouter ne casse rien non plus).

## Migrations Prisma (contre Neon, jamais de `migrate dev`)

```bash
# 1. Éditer prisma/schema.prisma
# 2. Générer le SQL du diff (additive only — jamais de colonne/table supprimée sans avoir demandé)
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script

# 3. Créer le dossier + fichier manuellement
mkdir -p prisma/migrations/<YYYYMMDDHHMMSS>_<nom>
# coller le SQL généré dans prisma/migrations/<...>/migration.sql

# 4. Générer le client + appliquer
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx prisma generate
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx prisma migrate deploy
```

Ces fichiers de migration sont **versionnés normalement** (contrairement à `seed.real.ts`, voir ci-dessous).

## Jeu de données réel (`prisma/seed.real.ts`)

- **Gitignored — ne JAMAIS le committer.** Contient les vraies données personnelles de Pierre (clients, projets, factures, montants).
- C'est le fichier à éditer quand Pierre demande "ajoute dans le jeu de données...". Trouver le bon `const proj... = await prisma.project.create(...)` / bloc `revenue.createMany` existant et suivre exactement le même style (variables nommées `projXxx`/`clientXxx`/`compXxx`, dates via le helper `d("YYYY-MM-DDTHH:mm:ss")`).
- Après édition, **réappliquer sur Neon** (ce script vide et recrée TOUTES les données de l'utilisateur à chaque run — c'est le comportement attendu, pas un accident) :
  ```bash
  PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx tsx prisma/seed.real.ts
  ```
- `TimeEntry.duration` est stocké en **secondes**, pas en minutes (bug déjà rencontré une fois).

## Système de modules (activation optionnelle)

`src/lib/module-defs.ts` définit `MODULE_DEFS` (id, label, icône, catégorie `core`/`recommended`/`bonus`, `defaultActive`). L'état actif est stocké **côté client uniquement** (`localStorage` + cookie miroir, via `useModules()` dans `src/hooks/use-modules.ts`) — un Server Component ne peut pas savoir directement quels modules sont actifs, le gating doit passer par un Client Component (`isActive(id)`).

Pour ajouter un nouveau module, **3 endroits à mettre à jour** (piège classique — j'ai oublié le 3ᵉ une fois) :
1. `src/lib/module-defs.ts` — `ModuleId` + entrée dans `MODULE_DEFS`
2. `src/components/layout/Sidebar.tsx` — entrée dans `navItems`
3. `src/components/layout/CommandPalette.tsx` — entrée dans `ALL_NAV_ITEMS` (liste **statique séparée**, ne se déduit pas de `module-defs.ts`)

Si le module a des entités recherchables (comme les factures, contacts...), les ajouter aussi à `searchGlobal` dans `src/actions/search.ts` (pattern `has("moduleId") ? prisma.xxx.findMany(...) : empty()`).

## Calendrier — pattern de projection

`src/app/(app)/calendrier/page.tsx` ne stocke pas tout en base : il **projette** plusieurs sources (tâches, jalons, factures, renouvellements, interactions, santé, entretiens, dépenses récurrentes...) en un tableau unifié `CalendarEvent[]` à chaque chargement de page, distinct du modèle DB `CalendarEvent` (qui ne sert qu'aux événements MANUAL et à la synchro Google). Pour ajouter une nouvelle source : fetch + `.map()` vers le type `CalendarEvent`, ajouter le type à l'union dans `CalendarView.tsx` + une entrée dans `typeConfig` (couleur/icône/label), et gater son affichage par module actif si pertinent (`if (e.type === "x" && !isActive("module")) return false`).

Pour les événements **récurrents projetés sans ligne en base** (ex. dépenses récurrentes), utiliser `getOccurrencesInRange` (`src/lib/dates.ts`) plutôt que de matérialiser des lignes.

**Sync Google** : la vérification de connexion (point vert/rouge) et la synchro réelle des données sont deux choses différentes — la vérification seule ne tire aucun événement. Un sync se déclenche automatiquement à l'ouverture de la page si la connexion est saine (fenêtre glissante de 1 mois, extensible en navigant dans le passé) — voir `CalendarView.tsx`.

## Patterns UI à réutiliser

- **Dialogs** : `src/components/ui/dialog.tsx` enveloppe **base-ui** (`@base-ui/react`), pas Radix. `DialogTrigger` **ne supporte pas `asChild`** — utiliser `<DialogTrigger render={<Button .../>}>` à la place. Pattern dual create/edit à suivre : `MilestoneDialog.tsx`, `ExpenseDialog.tsx` (prop optionnelle `xxxForEdit` → mode édition avec bouton Supprimer, sinon mode création).
- **Combobox "chercher ou créer à la volée"** : `ClientCombobox.tsx`, `CompanyCombobox.tsx`, `ExpenseCategoryCombobox.tsx` partagent le même pattern (portail + positionnement fixe + option "Créer '...'" en bas de liste). Le réutiliser plutôt que réinventer un `<select>` à chaque fois qu'un champ pourrait avoir besoin de création inline.
- **Autorisation multi-tenant (anti-IDOR)** : toute mutation doit scoper la cible par son propriétaire réel, jamais par un id parent fourni tel quel par l'appelant. Pattern sûr : `findFirst({ where: { id, <relation>: { userId } } })` avant de muter, ou `updateMany/deleteMany({ where: { id, userId } })` directement.

## Vérification avant de committer

```bash
npx tsc --noEmit
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx eslint <fichiers touchés>
npx vitest run              # unit + intégration (Postgres local erp_test, auto-créée)
```
CI (`.github/workflows/ci.yml`) relance exactement ces 3 étapes sur push vers `dev`/`main`. Les tests d'intégration utilisent `prisma db push` (pas `migrate`) sur une base `erp_test` locale, séparée de Neon.

## Style de commit

Préfixe conventionnel (`feat(module):`, `fix(module):`, `refactor(module):`, `revert(module):`), corps qui explique le **pourquoi** (la cause racine trouvée, la contrainte, l'alternative écartée) pas juste le quoi — surtout utile pour les bugs coriaces (voir `9a80e29`/`4e8fce4` sur le mismatch d'hydratation CSP pour un exemple). Jamais de `Co-Authored-By`.

## Release (merge `dev` → `main`)

1. Bump `version` dans `package.json` + mise à jour du tableau des modules dans `README.md`, commit `docs: mise à jour README vX.Y.Z — ...` sur `dev`.
2. Push `dev`, attendre CI verte (`gh run watch`).
3. `git checkout main && git merge dev --no-ff -m "chore: merge dev → main — vX.Y.Z\n\n..."`.
4. `git tag -a vX.Y.Z -m "..."`, `git push origin main --follow-tags`.
5. `gh release create vX.Y.Z --title "..." --notes-file ...` (voir les releases précédentes pour le format des notes).
6. Le numéro de version est un choix éditorial (ampleur des changements) — **demander à Pierre** plutôt que de décider seul si ça touche plusieurs modules.

Le déploiement Vercel est automatique sur push vers `main` (`prisma migrate deploy && next build`, cf. `package.json`).
