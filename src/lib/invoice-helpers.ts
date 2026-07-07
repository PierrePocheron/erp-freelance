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
  const count = await prisma.invoice.count({
    where: { userId, number: { startsWith: scopePrefix } },
  })
  return `${scopePrefix}${String(count + 1).padStart(digits, "0")}`
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
