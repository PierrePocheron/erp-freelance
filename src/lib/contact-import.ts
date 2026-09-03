/**
 * Import / rapprochement de contacts — logique PURE (sans Prisma), testable :
 *  - parseVcf : vCard 3.0/4.0 (iPhone « Partager le contact », export Google/Apple Contacts)
 *  - normalisation : téléphones en E.164 (libphonenumber-js), emails, noms sans accents
 *  - matchContacts : rapproche des contacts importés avec ceux de l'ERP et PROPOSE des
 *    modifications champ par champ, avec un niveau de confiance :
 *      SURE     = email ou téléphone identique
 *      LIKELY   = même nom complet (ordre prénom/nom indifférent)
 *      DOUBTFUL = nom approchant (à valider explicitement)
 *    Rien n'est écrit ici : l'utilisateur valide chaque proposition (voir applyContactImport).
 */

import parsePhoneNumber from "libphonenumber-js/max"

export type ImportSource = "vcf" | "picker" | "google" | "google-other"

export type ImportedContact = {
  key: string
  source: ImportSource
  name: string
  firstName?: string
  lastName?: string
  emails: string[]   // minuscules, dédoublonnés
  phones: string[]   // E.164, dédoublonnés
  company?: string
}

/** Sous-ensemble d'un contact ERP nécessaire au rapprochement. */
export type ErpContact = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  label: string | null
  email: string | null
  personalEmail: string | null
  phone: string | null
  company: string | null
}

export type Confidence = "SURE" | "LIKELY" | "DOUBTFUL"
export type ChangeField = "email" | "personalEmail" | "phone" | "firstName" | "lastName"

export type Change = {
  field: ChangeField
  from: string | null
  to: string
  kind: "fill" | "replace"
  checked: boolean   // pré-coché selon la confiance ; l'utilisateur tranche
}

export type Proposal = {
  id: string
  imported: ImportedContact
  match: { clientId: string; name: string; confidence: Confidence } | null
  candidates: { clientId: string; name: string; confidence: Confidence }[]  // alternatives
  changes: Change[]
  /** Contact inconnu de l'ERP : création proposée (décochée par défaut). */
  createChecked: boolean
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizePhone(raw: string, country: "FR" = "FR"): string | null {
  const cleaned = raw.replace(/^tel:/i, "").trim()
  if (!cleaned) return null
  // Export par défaut = parsePhoneNumberFromString : renvoie undefined (ne lance pas) sur du bruit.
  const p = parsePhoneNumber(cleaned, country)
  return p && p.isPossible() ? p.number : null
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** Nom comparable : sans accents, minuscules, lettres/chiffres seulement, espaces normalisés. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const tokens = (s: string) => normalizeName(s).split(" ").filter(Boolean)

/** « Prénom Nom » non structuré → prénom = 1er mot, nom = le reste (convention FR). */
export function splitName(full: string): { firstName?: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { firstName: parts[0] }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

// ── vCard ─────────────────────────────────────────────────────────────────────

function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1)
    else out.push(line)
  }
  return out.filter((l) => l.trim().length > 0)
}

function unescapeValue(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\")
}

/** Découpe une valeur composée (N:, ORG:) sur les « ; » non échappés. */
function splitStructured(v: string): string[] {
  const out: string[] = []; let cur = ""
  for (let i = 0; i < v.length; i++) {
    const c = v[i]
    if (c === "\\" && i + 1 < v.length) { cur += c + v[++i]; continue }
    if (c === ";") { out.push(cur); cur = ""; continue }
    cur += c
  }
  out.push(cur)
  return out.map(unescapeValue)
}

function decodeQuotedPrintable(v: string): string {
  try {
    const bytes = v.replace(/=\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    return decodeURIComponent(bytes.split("").map((ch) => "%" + ch.charCodeAt(0).toString(16).padStart(2, "0")).join(""))
  } catch { return v }
}

/**
 * Parse un fichier .vcf (un ou plusieurs contacts). Tolérant : groupes Apple (`item1.TEL`),
 * paramètres `TYPE=…` ou nus (2.1), lignes repliées, échappements, `tel:` (4.0),
 * quoted-printable (vieux exports Outlook). PHOTO et le reste sont ignorés.
 */
export function parseVcf(text: string): ImportedContact[] {
  const lines = unfoldLines(text)
  const cards: ImportedContact[] = []
  let cur: { fn?: string; first?: string; last?: string; emails: string[]; phones: string[]; org?: string } | null = null
  let idx = 0
  for (const line of lines) {
    const colon = line.indexOf(":")
    if (colon < 0) continue
    const left = line.slice(0, colon); const rawValue = line.slice(colon + 1)
    const [propWithGroup, ...params] = left.split(";")
    const prop = (propWithGroup.includes(".") ? propWithGroup.split(".").pop()! : propWithGroup).toUpperCase()
    const qp = params.some((p) => /^(ENCODING=)?QUOTED-PRINTABLE$/i.test(p))
    const value = qp ? decodeQuotedPrintable(rawValue) : rawValue
    if (prop === "BEGIN" && value.toUpperCase() === "VCARD") { cur = { emails: [], phones: [] }; continue }
    if (prop === "END" && value.toUpperCase() === "VCARD") {
      if (cur) {
        const name = (cur.fn || [cur.first, cur.last].filter(Boolean).join(" ") || cur.org || cur.emails[0] || cur.phones[0] || "").trim()
        if (name || cur.emails.length || cur.phones.length) {
          const split = cur.first || cur.last ? { firstName: cur.first, lastName: cur.last } : splitName(name)
          cards.push({
            key: `vcf:${idx++}:${name}`, source: "vcf", name: name || "Sans nom",
            firstName: split.firstName?.trim() || undefined, lastName: split.lastName?.trim() || undefined,
            emails: [...new Set(cur.emails)], phones: [...new Set(cur.phones)], company: cur.org?.trim() || undefined,
          })
        }
      }
      cur = null; continue
    }
    if (!cur) continue
    switch (prop) {
      case "FN": cur.fn = unescapeValue(value).trim(); break
      case "N": { const [last, first] = splitStructured(value); cur.last = last?.trim() || undefined; cur.first = first?.trim() || undefined; break }
      case "EMAIL": { const e = normalizeEmail(unescapeValue(value)); if (e) cur.emails.push(e); break }
      case "TEL": { const t = normalizePhone(unescapeValue(value)); if (t) cur.phones.push(t); break }
      case "ORG": { cur.org = splitStructured(value)[0]?.trim() || undefined; break }
      default: break
    }
  }
  return cards
}

/** Résultat brut du Contact Picker (Android Chrome) → contacts normalisés. */
export function fromPicker(items: { name?: string[]; email?: string[]; tel?: string[] }[]): ImportedContact[] {
  return items.map((it, i) => {
    const name = (it.name?.[0] ?? "").trim()
    const emails = [...new Set((it.email ?? []).map(normalizeEmail).filter((x): x is string => !!x))]
    const phones = [...new Set((it.tel ?? []).map((t) => normalizePhone(t)).filter((x): x is string => !!x))]
    const split = splitName(name)
    return { key: `picker:${i}:${name}`, source: "picker" as const, name: name || emails[0] || phones[0] || "Sans nom", ...split, emails, phones }
  }).filter((c) => c.name || c.emails.length || c.phones.length)
}

// ── Rapprochement ─────────────────────────────────────────────────────────────

const CONF_RANK: Record<Confidence, number> = { SURE: 0, LIKELY: 1, DOUBTFUL: 2 }

function erpEmails(c: ErpContact): string[] {
  return [c.email, c.personalEmail].map((e) => (e ? normalizeEmail(e) : null)).filter((x): x is string => !!x)
}
function erpNameTokens(c: ErpContact): string[] {
  const structured = [c.firstName, c.lastName].filter(Boolean).join(" ")
  return tokens(structured || c.label || c.name)
}

function confidenceFor(imp: ImportedContact, c: ErpContact): Confidence | null {
  const erpPhone = c.phone ? normalizePhone(c.phone) : null
  if (imp.emails.some((e) => erpEmails(c).includes(e))) return "SURE"
  if (erpPhone && imp.phones.includes(erpPhone)) return "SURE"
  const a = tokens(imp.firstName || imp.lastName ? [imp.firstName, imp.lastName].filter(Boolean).join(" ") : imp.name)
  const b = erpNameTokens(c)
  if (a.length === 0 || b.length === 0) return null
  const sa = new Set(a), sb = new Set(b)
  const inter = [...sa].filter((t) => sb.has(t))
  if (a.length >= 2 && inter.length === sa.size && sa.size === sb.size) return "LIKELY"      // même nom, ordre indifférent
  const strong = inter.some((t) => t.length >= 4)
  const jaccard = inter.length / new Set([...sa, ...sb]).size
  if (strong && jaccard >= 0.5) return "DOUBTFUL"                                             // « Elisa Renaud » vs « E. Renaud »
  return null
}

function buildChanges(imp: ImportedContact, c: ErpContact, conf: Confidence): Change[] {
  const checkedDefault = conf !== "DOUBTFUL"
  const changes: Change[] = []
  const have = new Set(erpEmails(c))
  let emailSlotFree = !c.email, personalSlotFree = !c.personalEmail
  for (const e of imp.emails) {
    if (have.has(e)) continue
    if (emailSlotFree)        { changes.push({ field: "email", from: null, to: e, kind: "fill", checked: checkedDefault }); emailSlotFree = false }
    else if (personalSlotFree) { changes.push({ field: "personalEmail", from: null, to: e, kind: "fill", checked: checkedDefault }); personalSlotFree = false }
    else changes.push({ field: "personalEmail", from: c.personalEmail, to: e, kind: "replace", checked: false })
  }
  const erpPhone = c.phone ? normalizePhone(c.phone) ?? c.phone : null
  for (const t of imp.phones) {
    if (erpPhone === t) continue
    if (!erpPhone) { changes.push({ field: "phone", from: null, to: t, kind: "fill", checked: checkedDefault }); break }
    changes.push({ field: "phone", from: c.phone, to: t, kind: "replace", checked: false }); break
  }
  if (!c.firstName && !c.lastName) {
    if (imp.firstName) changes.push({ field: "firstName", from: null, to: imp.firstName, kind: "fill", checked: checkedDefault })
    if (imp.lastName)  changes.push({ field: "lastName",  from: null, to: imp.lastName,  kind: "fill", checked: checkedDefault })
  }
  return changes
}

/**
 * Rapproche chaque contact importé avec le carnet ERP.
 * `proposeCreate` : proposer la création des inconnus (import téléphone) — pas pour Google
 * (des milliers d'« autres contacts »), où seuls les rapprochements utiles sont retournés.
 */
export function matchContacts(imported: ImportedContact[], erp: ErpContact[], opts: { proposeCreate: boolean }): Proposal[] {
  const out: Proposal[] = []
  for (const imp of imported) {
    const scored = erp
      .map((c) => ({ c, conf: confidenceFor(imp, c) }))
      .filter((x): x is { c: ErpContact; conf: Confidence } => x.conf !== null)
      .sort((a, b) => CONF_RANK[a.conf] - CONF_RANK[b.conf] || a.c.name.localeCompare(b.c.name, "fr"))
    const best = scored[0]
    if (!best) {
      if (opts.proposeCreate) out.push({ id: imp.key, imported: imp, match: null, candidates: [], changes: [], createChecked: false })
      continue
    }
    const changes = buildChanges(imp, best.c, best.conf)
    if (!opts.proposeCreate && changes.length === 0) continue   // Google : rien à apporter → on n'affiche pas
    out.push({
      id: imp.key, imported: imp,
      match: { clientId: best.c.id, name: best.c.name, confidence: best.conf },
      candidates: scored.slice(1, 6).map((x) => ({ clientId: x.c.id, name: x.c.name, confidence: x.conf })),
      changes, createChecked: false,
    })
  }
  // Les plus sûrs d'abord, puis ceux qui ont quelque chose à apporter, puis les inconnus.
  return out.sort((a, b) => {
    const ra = a.match ? CONF_RANK[a.match.confidence] : 3, rb = b.match ? CONF_RANK[b.match.confidence] : 3
    return ra - rb || (b.changes.length - a.changes.length) || a.imported.name.localeCompare(b.imported.name, "fr")
  })
}

/** Recalcule les changements quand l'utilisateur choisit un autre contact ERP pour un import. */
export function rematch(imp: ImportedContact, c: ErpContact): { match: Proposal["match"]; changes: Change[] } {
  const conf = confidenceFor(imp, c) ?? "DOUBTFUL"
  return { match: { clientId: c.id, name: c.name, confidence: conf }, changes: buildChanges(imp, c, conf) }
}
