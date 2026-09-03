/**
 * Copie les SVG Devicon des technos déclarées dans src/lib/tech-icons.ts vers
 * public/tech-icons/<slug>.svg (bundlés en local — aucune requête réseau au runtime).
 * Rejouer après avoir ajouté une techno : `PATH=".../node@22/bin:$PATH" npx tsx scripts/gen-tech-icons.ts`.
 * `devicon` est une devDependency ; les SVG produits sont versionnés.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { ALL_TECHS } from "../src/lib/tech-icons"

// Lancé depuis la racine du repo (`npx tsx scripts/gen-tech-icons.ts`).
const root = process.cwd()
const iconsDir = join(root, "node_modules/devicon/icons")
const outDir = join(root, "public/tech-icons")
mkdirSync(outDir, { recursive: true })

const VARIANT_FALLBACKS = ["original", "plain", "original-wordmark", "plain-wordmark", "line", "line-wordmark"]
const missing: string[] = []
const withSlug = ALL_TECHS.filter((t) => t.slug)
let copied = 0

for (const t of withSlug) {
  const slug = t.slug!
  let done = false
  for (const v of [t.variant ?? "original", ...VARIANT_FALLBACKS]) {
    const src = join(iconsDir, slug, `${slug}-${v}.svg`)
    if (existsSync(src)) {
      writeFileSync(join(outDir, `${slug}.svg`), readFileSync(src))
      copied++
      done = true
      break
    }
  }
  if (!done) missing.push(`${slug} (${t.label})`)
}

console.log(`✅ ${copied}/${withSlug.length} icônes copiées dans public/tech-icons`)
if (missing.length) console.warn(`⚠️  Introuvables : ${missing.join(", ")}`)
