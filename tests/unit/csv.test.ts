import { describe, it, expect } from "vitest"
import { parseCsv, detectDelimiter } from "@/lib/csv"

describe("detectDelimiter", () => {
  it("détecte la virgule", () => {
    expect(detectDelimiter("nom,email,ville")).toBe(",")
  })
  it("détecte le point-virgule (exports Excel FR)", () => {
    expect(detectDelimiter("nom;email;ville")).toBe(";")
  })
  it("ignore les délimiteurs à l'intérieur des guillemets", () => {
    expect(detectDelimiter('"Dupont, Jean";email;ville')).toBe(";")
  })
})

describe("parseCsv", () => {
  it("parse un CSV simple avec entêtes", () => {
    const { headers, rows } = parseCsv("nom,email\nJean,jean@a.fr\nMarie,marie@b.fr")
    expect(headers).toEqual(["nom", "email"])
    expect(rows).toEqual([["Jean", "jean@a.fr"], ["Marie", "marie@b.fr"]])
  })

  it("gère les champs entre guillemets contenant le délimiteur", () => {
    const { rows } = parseCsv('nom,adresse\n"Dupont, Jean","12, rue de la Paix"')
    expect(rows[0]).toEqual(["Dupont, Jean", "12, rue de la Paix"])
  })

  it("gère les guillemets échappés (\"\")", () => {
    const { rows } = parseCsv('nom\n"Le ""Bistrot"" Lyonnais"')
    expect(rows[0][0]).toBe('Le "Bistrot" Lyonnais')
  })

  it("gère un champ multi-lignes quoté", () => {
    const { rows } = parseCsv('nom,notes\nJean,"ligne 1\nligne 2"')
    expect(rows).toHaveLength(1)
    expect(rows[0][1]).toBe("ligne 1\nligne 2")
  })

  it("gère CRLF et le point-virgule auto-détecté", () => {
    const { headers, rows, delimiter } = parseCsv("nom;email\r\nJean;jean@a.fr\r\n")
    expect(delimiter).toBe(";")
    expect(headers).toEqual(["nom", "email"])
    expect(rows).toEqual([["Jean", "jean@a.fr"]])
  })

  it("préserve les accents et retire le BOM", () => {
    const { headers, rows } = parseCsv("﻿prénom,région\nJérôme,Auvergne-Rhône-Alpes")
    expect(headers).toEqual(["prénom", "région"])
    expect(rows[0]).toEqual(["Jérôme", "Auvergne-Rhône-Alpes"])
  })

  it("ignore les lignes vides", () => {
    const { rows } = parseCsv("nom\nJean\n\n\nMarie\n")
    expect(rows).toHaveLength(2)
  })
})
