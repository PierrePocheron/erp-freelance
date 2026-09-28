// Helpers de numérotation et d'émission — partagés entre facturation.ts ("use server")
// et renewal-invoice.ts (lib). Pas de directive pour rester importable des deux côtés.

import { prisma } from "@/lib/prisma"
import { type NumberFormat, buildNumberParts } from "@/lib/number-format"

export async function nextInvoiceNumber(userId: string): Promise<string> {
  const profile = await prisma.userProfile?.findUnique({
    where: { userId },
    select: { invoicePrefix: true, invoiceNumberFormat: true },
  }).catch(() => null)
  const prefix = profile?.invoicePrefix ?? "FAC"
  const format = (profile?.invoiceNumberFormat ?? "PREFIX-YYYY-NNN") as NumberFormat
  const { scopePrefix, digits } = buildNumberParts(format, prefix, new Date())
  const existing = await prisma.invoice.findMany({
    where: { userId, number: { startsWith: scopePrefix } },
    select: { number: true },
  })
  return nextNumberFrom(existing.map((i) => i.number), scopePrefix, digits)
}

/**
 * Prochain numéro de séquence, dérivé du plus GRAND suffixe déjà attribué.
 *
 * Un `count() + 1` réutilisait un numéro dès qu'un document était supprimé :
 * avec FAC-2026-001/002/003, supprimer la 002 fait retomber le compte à 2 et le
 * document suivant s'appelait FAC-2026-003 — deux documents différents, même
 * numéro, séquence légale rompue.
 *
 * Le maximum est calculé en NUMÉRIQUE et non par tri de chaînes : au passage de
 * 999 à 1000, l'ordre lexicographique mettrait « …-999 » après « …-1000 ».
 */
export function nextNumberFrom(numbers: string[], scopePrefix: string, digits: number): string {
  let max = 0
  for (const n of numbers) {
    const seq = Number.parseInt(n.slice(scopePrefix.length), 10)
    if (Number.isFinite(seq) && seq > max) max = seq
  }
  return `${scopePrefix}${String(max + 1).padStart(digits, "0")}`
}

// Le profil "par défaut" est sélectionné en premier grâce à orderBy isDefault desc.
// Un seul aller-retour DB au lieu de deux requêtes successives.
export async function defaultEmitterId(userId: string): Promise<string | null> {
  const profile = await prisma.emitterProfile.findFirst({
    where: { userId },
    orderBy: { isDefault: "desc" },
    select: { id: true },
  })
  return profile?.id ?? null
}
