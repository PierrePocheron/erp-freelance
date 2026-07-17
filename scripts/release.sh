#!/bin/bash
# Release ERP Freelance — la version passée en argument pilote TOUT :
# package.json, la PR, le tag git et la GitHub release restent synchronisés
# par construction (demande de Pierre : « relier la montée de version aux
# releases », 11 juillet 2026).
#
# Usage :
#   bash scripts/release.sh 1.2.0 "Titre de la release" [notes.md]
#
# Étapes : garde-fous → tests → bump package.json (commit) → push dev →
# PR dev→main → attente CI → merge → tag vX.Y.Z sur main → GitHub release.
# Prérequis : gh authentifié, branche dev, arbre propre, README déjà à jour
# (le tableau des modules reste une décision éditoriale, pas scriptable).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:?usage: release.sh <version> \"<titre>\" [notes.md]}"
TITLE="${2:?titre de release requis (ex: \"v1.2.0 — PWA mobile\")}"
NOTES_FILE="${3:-}"

NODE22='/opt/homebrew/opt/node@22/bin'
export PATH="$NODE22:$PATH"

# ── Garde-fous ────────────────────────────────────────────────────────────────
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "✗ version invalide : $VERSION (attendu X.Y.Z)"; exit 1; }
[ "$(git branch --show-current)" = "dev" ]   || { echo "✗ il faut être sur dev"; exit 1; }
[ -z "$(git status --porcelain)" ]           || { echo "✗ arbre de travail non propre"; exit 1; }
git rev-parse "v$VERSION" >/dev/null 2>&1    && { echo "✗ le tag v$VERSION existe déjà"; exit 1; }
CURRENT=$(node -p "require('./package.json').version")
echo "→ Release v$VERSION (actuelle : v$CURRENT)"

# ── Tests (règle du projet : vitest au moment de la release) ─────────────────
echo "→ Tests…"
npx vitest run --silent || { echo "✗ tests en échec — release annulée"; exit 1; }

# ── Bump piloté par la release ───────────────────────────────────────────────
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
git add package.json
git commit -m "chore: bump version v$VERSION (release)"

# ── Push + PR + CI + merge ───────────────────────────────────────────────────
echo "→ Push dev + PR vers main…"
git push origin dev
# PR complète : assignée à Pierre + label release. (Pas de reviewer : GitHub
# refuse de demander une review à l'auteur de la PR, et gh est authentifié
# avec le compte de Pierre.)
GH_USER=$(gh api user --jq .login)
PR_ARGS=(--base main --head dev --title "Release v$VERSION — $TITLE" --assignee "$GH_USER" --label release)
if [ -n "$NOTES_FILE" ]; then PR_ARGS+=(--body-file "$NOTES_FILE"); else PR_ARGS+=(--fill); fi
PR_URL=$(gh pr create "${PR_ARGS[@]}")
PR_NUM=$(basename "$PR_URL")
echo "→ PR #$PR_NUM — attente CI…"
gh pr checks "$PR_NUM" --watch --interval 20
gh pr merge "$PR_NUM" --merge --subject "chore: merge dev → main — v$VERSION"

# ── Tag + GitHub release (sans quitter dev) ──────────────────────────────────
echo "→ Tag + release…"
git fetch origin
git fetch origin main:main 2>/dev/null || true
git tag -a "v$VERSION" -m "v$VERSION — $TITLE" origin/main
git push origin "v$VERSION"
REL_ARGS=(--title "v$VERSION — $TITLE")
if [ -n "$NOTES_FILE" ]; then REL_ARGS+=(--notes-file "$NOTES_FILE"); else REL_ARGS+=(--generate-notes); fi
gh release create "v$VERSION" "${REL_ARGS[@]}"

echo "✓ v$VERSION publiée — $(gh release view "v$VERSION" --json url --jq .url)"
echo "  (déploiement Vercel déclenché par le push main)"
