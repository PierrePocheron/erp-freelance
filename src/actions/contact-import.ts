"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeContactName } from "@/lib/contact"
import {
  parseVcf, fromPicker, matchContacts, rematch, normalizeEmail, normalizePhone,
  type ErpContact, type Proposal, type ChangeField, type ImportedContact,
} from "@/lib/contact-import"
import { hasContactsScope, getGoogleContactsToken, fetchGoogleContacts } from "@/lib/google-contacts"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  return session.user.id
}

const ERP_SELECT = { id: true, name: true, firstName: true, lastName: true, label: true, email: true, personalEmail: true, phone: true, company: true } as const

async function loadErpContacts(userId: string): Promise<ErpContact[]> {
  return prisma.client.findMany({ where: { userId }, select: ERP_SELECT, orderBy: { name: "asc" } })
}

// ── Prévisualisation (rien n'est écrit) ──────────────────────────────────────

/** Fichier .vcf (iPhone « Partager », export Google/Apple Contacts) → propositions. */
export async function previewVcfImport(text: string): Promise<Proposal[]> {
  const userId = await requireAuth()
  if (text.length > 5_000_000) throw new Error("Fichier trop volumineux (5 Mo max)")
  const imported = parseVcf(text)
  if (imported.length === 0) throw new Error("Aucun contact lisible dans ce fichier .vcf")
  return matchContacts(imported, await loadErpContacts(userId), { proposeCreate: true })
}

/** Résultat du sélecteur natif (Contact Picker, Android Chrome) → propositions. */
export async function previewPickedImport(items: { name?: string[]; email?: string[]; tel?: string[] }[]): Promise<Proposal[]> {
  const userId = await requireAuth()
  const imported = fromPicker(items.slice(0, 500))
  if (imported.length === 0) throw new Error("Aucun contact sélectionné")
  return matchContacts(imported, await loadErpContacts(userId), { proposeCreate: true })
}

/**
 * Google Contacts (+ « Autres contacts » Gmail) → propositions d'enrichissement des
 * contacts ERP existants uniquement (pas de création : le carnet Gmail est trop large).
 */
export async function previewGoogleEnrichment(): Promise<{ proposals: Proposal[]; scanned: number }> {
  const userId = await requireAuth()
  if (!(await hasContactsScope(userId))) throw new Error("NO_SCOPE")
  const token = await getGoogleContactsToken(userId)
  if (!token) throw new Error("Jeton Google indisponible — réautorise l'accès aux contacts dans Réglages.")
  const google = await fetchGoogleContacts(token)
  const proposals = matchContacts(google, await loadErpContacts(userId), { proposeCreate: false })
  return { proposals, scanned: google.length }
}

/** Recalcule match + changements quand l'utilisateur désigne un autre contact ERP. */
export async function rematchProposal(imported: ImportedContact, clientId: string) {
  const userId = await requireAuth()
  const c = await prisma.client.findFirst({ where: { id: clientId, userId }, select: ERP_SELECT })
  if (!c) throw new Error("Contact introuvable")
  return rematch(imported, c)
}

// ── Application des décisions validées ───────────────────────────────────────

export type ImportDecision = {
  /** Contact ERP à enrichir (null = création). */
  clientId: string | null
  changes: { field: ChangeField; to: string }[]
  create?: { firstName?: string; lastName?: string; name: string; email?: string; phone?: string; company?: string; source: string }
}

const ALLOWED_FIELDS: ReadonlySet<ChangeField> = new Set(["email", "personalEmail", "phone", "firstName", "lastName"])

function sanitize(field: ChangeField, to: string): string | null {
  const v = to.trim()
  if (!v) return null
  if (field === "email" || field === "personalEmail") return normalizeEmail(v)
  if (field === "phone") return normalizePhone(v) ?? v
  return v.slice(0, 120)
}

/**
 * Applique UNIQUEMENT les modifications cochées par l'utilisateur. Chaque cible est
 * re-vérifiée côté serveur (appartenance au user — anti-IDOR, champs autorisés, valeurs
 * normalisées) ; `name` est recalculé si prénom/nom changent.
 */
export async function applyContactImport(decisions: ImportDecision[]): Promise<{ updated: number; created: number }> {
  const userId = await requireAuth()
  let updated = 0, created = 0
  for (const d of decisions.slice(0, 500)) {
    if (d.clientId) {
      const data: Partial<Record<ChangeField | "name", string>> = {}
      for (const ch of d.changes) {
        if (!ALLOWED_FIELDS.has(ch.field)) continue
        const v = sanitize(ch.field, ch.to)
        if (v) data[ch.field] = v
      }
      if (Object.keys(data).length === 0) continue
      const cur = await prisma.client.findFirst({ where: { id: d.clientId, userId }, select: { firstName: true, lastName: true, label: true, company: true } })
      if (!cur) continue
      if ("firstName" in data || "lastName" in data) {
        data.name = computeContactName({ label: cur.label, firstName: data.firstName ?? cur.firstName, lastName: data.lastName ?? cur.lastName, companyName: cur.company })
      }
      const { count } = await prisma.client.updateMany({ where: { id: d.clientId, userId }, data })
      if (count) { updated++; revalidatePath(`/contacts/${d.clientId}`) }
    } else if (d.create) {
      const firstName = d.create.firstName?.trim() || null
      const lastName  = d.create.lastName?.trim()  || null
      const email = d.create.email ? normalizeEmail(d.create.email) : null
      const phone = d.create.phone ? (normalizePhone(d.create.phone) ?? d.create.phone.trim()) : null
      const label = !firstName && !lastName ? d.create.name.trim().slice(0, 120) || null : null
      const name = computeContactName({ label, firstName, lastName, companyName: d.create.company ?? null })
      if (name === "Sans nom" && !email && !phone) continue
      await prisma.client.create({
        data: {
          userId, type: "TO_COMPLETE", firstName, lastName, label, name,
          company: d.create.company?.trim() || null, email, phone,
          notes: `Importé depuis ${d.create.source === "google" ? "Google Contacts" : d.create.source === "picker" ? "le carnet du téléphone" : "un fichier .vcf"} le ${new Date().toLocaleDateString("fr-FR")}.`,
        },
      })
      created++
    }
  }
  revalidatePath("/contacts")
  return { updated, created }
}
