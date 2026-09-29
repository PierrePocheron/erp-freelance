import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Garde-fou : la production tourne en UTC (Vercel refuse la variable TZ), et les
// dates « jour » sont stockées à minuit heure de Paris — la veille à 22 h ou 23 h
// en UTC. Un formatage sans fuseau explicite, rendu côté serveur, affiche donc la
// VEILLE : échéance du 31 affichée « 30/10 » sur la page, dans le PDF et dans le
// mail au client. Et un champ date pré-rempli via `toISOString()` recule la date
// d'un jour à chaque ré-enregistrement.
//
// Ce test lit le code source : il échoue dès qu'une de ces formes réapparaît.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === "generated" ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

const FILES = sourceFiles("src")

function offenders(pattern: RegExp, allow: (file: string) => boolean = () => false) {
  const hits: string[] = []
  for (const file of FILES) {
    if (allow(file)) continue
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}  ${line.trim().slice(0, 100)}`)
    })
  }
  return hits
}

describe("dates : pas de formatage dans le fuseau du serveur", () => {
  it("tout toLocaleDateString / toLocaleTimeString précise le fuseau de Paris", () => {
    const hits = offenders(/toLocale(Date|Time)String\((?![^)]*timeZone)/)
    expect(hits).toEqual([])
  })

  it("aucun toLocaleString de date sans fuseau", () => {
    const hits = offenders(/new Date\([^)]*\)\.toLocaleString\((?![^)]*timeZone)/)
    expect(hits).toEqual([])
  })

  it("aucun champ date pré-rempli via toISOString (date UTC) — utiliser zonedDateKey", () => {
    const hits = offenders(
      /toISOString\(\)\.(split\("T"\)\[0\]|slice\(0,\s*10\))/,
      (file) => file.endsWith(join("lib", "dates.ts")), // le commentaire qui l'interdit
    )
    expect(hits).toEqual([])
  })

  it("aucune comparaison de jours via toDateString (jour UTC en prod) — utiliser zonedDateKey", () => {
    expect(offenders(/\.toDateString\(\)/)).toEqual([])
  })
})
