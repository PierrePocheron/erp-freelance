#!/bin/bash
# Garde-fou de dérive (#9) : reconstruit une base NEUVE à partir de prisma/migrations puis
# exige qu'elle soit identique au schéma. Échoue si une migration casse à la reconstruction
# ou si le schéma contient quelque chose qu'aucune migration ne crée (typiquement : un
# `prisma db push` fait sur la production sans migration).
#
# Usage : MIGCHECK_DATABASE_URL=postgresql://…@localhost:5432/erp_migcheck bash scripts/check-migrations.sh
# (base LOCALE jetable — elle est supprimée puis recréée).
set -euo pipefail
cd "$(dirname "$0")/.."
URL="${MIGCHECK_DATABASE_URL:?MIGCHECK_DATABASE_URL requis (base locale jetable)}"
case "$URL" in *localhost*|*127.0.0.1*) ;; *) echo "✗ refusé : base non locale"; exit 1 ;; esac

DB=$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$URL")
MAINT=$(node -e 'const u=new URL(process.argv[1]);u.pathname="/postgres";u.search="";console.log(u.toString())' "$URL")
node -e '
const { Client } = require("pg");
(async () => { const c = new Client({ connectionString: process.argv[1] }); await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${process.argv[2]}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${process.argv[2]}"`); await c.end() })()' "$MAINT" "$DB"

echo "→ Rejeu de toutes les migrations sur une base neuve…"
TEST_DATABASE_URL="$URL" npx prisma migrate deploy --config prisma.test.config.ts

echo "→ Comparaison avec le schéma…"
TEST_DATABASE_URL="$URL" npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code --config prisma.test.config.ts \
  && echo "✓ migrations et schéma identiques" \
  || { echo "✗ dérive : le schéma contient des objets qu'aucune migration ne crée (voir le SQL ci-dessus)"; exit 1; }
