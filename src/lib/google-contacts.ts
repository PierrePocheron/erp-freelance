/**
 * Google People API — lecture des contacts de l'utilisateur (carnet « Mes contacts » +
 * « Autres contacts » que Gmail enregistre automatiquement) pour rapprocher/enrichir
 * les contacts de l'ERP. Lecture seule. Réutilise le compte Google déjà connecté
 * (autorisation incrémentale : 2 scopes supplémentaires, sensibles mais non restreints).
 */

import { prisma } from "@/lib/prisma"
import { getGoogleAccessTokenFor } from "@/lib/google-calendar"
import { normalizePhone, type ImportedContact } from "@/lib/contact-import"

const PEOPLE_API = "https://people.googleapis.com/v1"

export const CONTACTS_SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
]

/** Les deux scopes contacts sont-ils accordés ? (le consentement Google est granulaire) */
export async function hasContactsScope(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({ where: { userId, provider: "google" }, select: { scope: true } })
  const scope = account?.scope ?? ""
  return scope.includes("auth/contacts.readonly") && scope.includes("auth/contacts.other.readonly")
}

export async function getGoogleContactsToken(userId: string): Promise<string | null> {
  return getGoogleAccessTokenFor(userId, "auth/contacts")
}

type Person = {
  resourceName?: string
  names?: { displayName?: string; givenName?: string; familyName?: string; unstructuredName?: string }[]
  emailAddresses?: { value?: string }[]
  phoneNumbers?: { value?: string; canonicalForm?: string }[]
  organizations?: { name?: string }[]
}

async function fetchPaged(url: string, listKey: "connections" | "otherContacts", token: string, maxPages = 10): Promise<Person[]> {
  const out: Person[] = []
  let pageToken: string | undefined
  for (let i = 0; i < maxPages; i++) {
    const u = new URL(url)
    if (pageToken) u.searchParams.set("pageToken", pageToken)
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 429) throw new Error("Quota Google atteint — réessaie dans une minute.")
    if (res.status === 401 || res.status === 403) throw new Error("Accès Google refusé — réautorise l'accès aux contacts dans Réglages.")
    if (!res.ok) throw new Error(`Google People API ${res.status}`)
    const data = await res.json() as { nextPageToken?: string; connections?: Person[]; otherContacts?: Person[] }
    out.push(...(data[listKey] ?? []))
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return out
}

function toImported(p: Person, source: "google" | "google-other"): ImportedContact | null {
  const n = p.names?.[0]
  const emails = [...new Set((p.emailAddresses ?? []).map((e) => (e.value ?? "").trim().toLowerCase()).filter(Boolean))]
  const phones = [...new Set((p.phoneNumbers ?? []).map((t) => t.canonicalForm ?? normalizePhone(t.value ?? "")).filter((x): x is string => !!x))]
  const firstName = n?.givenName?.trim() || undefined
  const lastName  = n?.familyName?.trim() || undefined
  const name = (n?.displayName || n?.unstructuredName || [firstName, lastName].filter(Boolean).join(" ") || emails[0] || "").trim()
  if (!name && emails.length === 0 && phones.length === 0) return null
  return {
    key: p.resourceName ?? `${source}:${name}:${emails[0] ?? phones[0] ?? ""}`,
    source, name: name || emails[0] || phones[0] || "Sans nom",
    firstName, lastName, emails, phones,
    company: p.organizations?.[0]?.name?.trim() || undefined,
  }
}

/**
 * Tous les contacts Google de l'utilisateur (Mes contacts + Autres contacts), normalisés.
 * 1 000 par page, 10 pages max par liste (largement au-dessus d'un carnet perso).
 */
export async function fetchGoogleContacts(token: string): Promise<ImportedContact[]> {
  const [connections, others] = await Promise.all([
    fetchPaged(`${PEOPLE_API}/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=1000`, "connections", token),
    fetchPaged(`${PEOPLE_API}/otherContacts?readMask=names,emailAddresses,phoneNumbers&pageSize=1000`, "otherContacts", token),
  ])
  const out: ImportedContact[] = []
  for (const p of connections) { const c = toImported(p, "google"); if (c) out.push(c) }
  for (const p of others)      { const c = toImported(p, "google-other"); if (c) out.push(c) }
  return out
}
