/**
 * Parser CSV minimal (RFC 4180) : guillemets, guillemets échappés (""),
 * champs multi-lignes quotés, CRLF, auto-détection du délimiteur (les exports
 * Excel FR utilisent ";", les extensions de scraping plutôt ","). ~60 lignes,
 * unit-testé — évite une dépendance pour des fichiers de quelques centaines
 * de lignes.
 */

export type ParsedCsv = {
  headers: string[]
  rows: string[][]
  delimiter: string
}

/** Détecte le délimiteur le plus probable sur la première ligne (hors guillemets). */
export function detectDelimiter(firstLine: string): string {
  let inQuotes = false
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 }
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  // Retire un éventuel BOM (exports Excel)
  const input = text.replace(/^﻿/, "")
  const firstLineEnd = input.search(/\r?\n/)
  const delim = delimiter ?? detectDelimiter(firstLineEnd === -1 ? input : input.slice(0, firstLineEnd))

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++ } // "" échappé
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(field); field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++
      row.push(field); field = ""
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  // Dernier champ/ligne (fichier sans saut de ligne final)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Ignore les lignes entièrement vides
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0))
  const [headers = [], ...dataRows] = nonEmpty
  return {
    headers: headers.map((h) => h.trim()),
    rows: dataRows,
    delimiter: delim,
  }
}
