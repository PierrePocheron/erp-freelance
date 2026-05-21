# Export & Import des données

## Pourquoi c'est important

La portabilité des données, c'est ton indépendance vis-à-vis de n'importe quel hébergeur.
Un export complet te permet de :

- **Changer d'hébergeur** sans perdre tes données (Vercel → VPS, ou l'inverse)
- **Créer une sauvegarde** avant une mise à jour risquée
- **Développer en local avec tes vraies données** au lieu de fausses seeds
- **Restaurer** suite à une erreur de manipulation

---

## Export — depuis l'application

Va dans **Paramètres → Export & Import des données** et clique sur **"Télécharger mes données"**.

Le fichier téléchargé s'appelle `erp-export-YYYY-MM-DD.json`.

### Ce qui est exporté

```
✅ Profil professionnel        ✅ Clients & interactions
✅ Projets & jalons             ✅ Tâches & sous-tâches
✅ Devis & lignes               ✅ Factures & paiements
✅ Produits & conditions        ✅ Entrées de temps
✅ Calendrier                   ✅ Post-dev & renouvellements
✅ Tags & idées projets         ✅ Journal de bord

❌ Tokens OAuth & sessions      (inutiles dans un autre env)
❌ Logs email & notifications   (données transientes)
```

### Format du fichier

```json
{
  "version": "0.1.0",
  "exportedAt": "2026-05-21T10:30:00Z",
  "stats": {
    "clients": 12,
    "projects": 8,
    "tasks": 47,
    "quotes": 15,
    "invoices": 23,
    "interactions": 34,
    "timeEntries": 156
  },
  "data": {
    "userProfile": { ... },
    "clients": [ ... ],
    "projects": [ { ..., "tagIds": ["id1", "id2"] } ],
    "tasks": [ { ..., "taskTagIds": ["id1"] } ],
    "quotes": [ ... ],
    "quoteLines": [ ... ],
    "invoices": [ ... ],
    "invoiceLines": [ ... ],
    "payments": [ ... ],
    ...
  }
}
```

> **Note :** `tagIds` et `taskTagIds` sont ajoutés à l'export pour restaurer les relations
> many-to-many (tags → projets, tags → tâches) lors de l'import.

---

## Import — script CLI

### Prérequis

1. Node.js installé
2. `DATABASE_URL` (et `DIRECT_URL` si Neon) configurés dans `.env.local`
3. Les migrations Prisma appliquées : `npx prisma migrate deploy`
4. Au moins un utilisateur créé via l'app (connecte-toi une fois d'abord)

### Commande

```bash
npm run import ./erp-export-2026-05-21.json
```

Ou directement :

```bash
npx tsx scripts/import.ts ./erp-export-2026-05-21.json
```

### Sortie attendue

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦  ERP Freelance — Import des données
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📅  Export du   : 2026-05-21T10:30:00Z
  🏷️   Version    : 0.1.0
  📊  Contenu    : 12 clients · 8 projets · 23 factures

  👤  Utilisateur : pierre@example.com
  🆔  userId      : clxxx...

📥 Début de l'import...

  ✅ UserProfile                 1 enregistrement
  ✅ Tags                        5 enregistrements
  ✅ Clients                     12 enregistrements
  ✅ Interactions                34 enregistrements
  ✅ Projets                     8 enregistrements
  ✅ Tâches                      47 enregistrements
  ✅ Sous-tâches liées           12 enregistrements
  ✅ Devis                       15 enregistrements
  ✅ Factures                    23 enregistrements
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✨  Import terminé — 287 enregistrements traités
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Ordre d'import (respect des clés étrangères)

Le script insère les données dans cet ordre précis pour éviter les erreurs de FK :

```
 1. UserProfile           (dépend de : userId)
 2. Tags                  (dépend de : userId)
 3. Conditions générales  (dépend de : userId)
 4. Clients               (dépend de : userId)
 5. Interactions          (dépend de : clientId)
 6. Rappels               (dépend de : clientId)
 7. Fichiers clients      (dépend de : clientId)
 8. Produits              (dépend de : userId)
 9. Projets               (dépend de : userId, clientId)
10. Tags → Projets M2M    (dépend de : projectId, tagId)
11. Jalons                (dépend de : projectId)
12. Tags de tâches        (dépend de : projectId)
13. Tâches (passe 1)      (dépend de : projectId, clientId, milestoneId)
14. Tâches (passe 2)      (restaure parentTaskId → sous-tâches)
15. Tags → Tâches M2M     (dépend de : taskId, taskTagId)
16. Entrées de temps      (dépend de : taskId, userId)
17. Journal de bord       (dépend de : projectId)
18. Livrables             (dépend de : projectId)
19. Liens utiles          (dépend de : projectId)
20. Post-Dev              (dépend de : projectId)
21. Renouvellements       (dépend de : postDevId)
22. Devis                 (dépend de : userId, clientId, projectId?)
23. Lignes de devis       (dépend de : quoteId, productId?)
24. Factures              (dépend de : userId, clientId, projectId?, quoteId?)
25. Lignes de factures    (dépend de : invoiceId, productId?)
26. Paiements             (dépend de : invoiceId)
27. Factures récurrentes  (dépend de : userId, clientId, projectId?)
28. Événements calendrier (dépend de : userId)
29. Idées projets         (dépend de : userId)
```

---

## Gestion des migrations de schéma

Le cas délicat : tu exportes avec la version `0.7.0` du schema, et tu importes dans la version `0.9.0` où des colonnes ont été ajoutées.

### Comment le script gère ça

```
Export v0.7.0 → colonnes A, B, C

Import dans v0.9.0 (colonnes A, B, C + D avec DEFAULT, E required)
  ✅ A, B, C → importés depuis le JSON
  ✅ D → ignoré dans le JSON, Prisma applique le DEFAULT
  ⚠️  E required sans DEFAULT → le script plantera sur ce modèle
```

### Règle de migration safe

**Toujours ajouter des colonnes avec une valeur par défaut** pour ne pas casser les imports :

```prisma
// ✅ Safe — a un DEFAULT
model Client {
  contractSigned Boolean @default(false)   // nouveau champ
}

// ⚠️ Risqué — required sans DEFAULT
model Client {
  contractRef String   // plantera sur l'import si données existantes
}
```

---

## Workflow recommandé

### Sauvegarde hebdomadaire

```bash
# Depuis l'UI : Paramètres → Télécharger mes données
# Stocker le fichier dans un dossier sécurisé (pas dans git — données sensibles)
~/Backups/erp/erp-export-2026-05-21.json
```

### Migration d'hébergeur

```bash
# 1. Exporter depuis l'ancienne env (UI)
# 2. Configurer le nouvel env (.env.local)
# 3. Appliquer les migrations
npx prisma migrate deploy
# 4. Connecte-toi une fois via l'app pour créer le compte
# 5. Importer les données
npm run import ./erp-export-2026-05-21.json
```

### Dev local avec vraies données

```bash
# 1. Exporter depuis la prod (UI)
# 2. Configurer .env.local avec ta DB locale
# 3. npm run import ./erp-export-2026-05-21.json
# 4. npm run dev → tu as tes vraies données en local ✅
```
