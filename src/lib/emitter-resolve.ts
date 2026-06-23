import "server-only"
import { prisma } from "@/lib/prisma"

// Bloc émetteur tel que consommé par le template PDF (@/lib/pdf).
export type EmitterBlock = {
  name: string
  email: string
  companyName?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  siret?: string | null
  phone?: string | null
  website?: string | null
  bankName?: string | null
  iban?: string | null
  bic?: string | null
}

// Résout le bloc émetteur d'un document (devis/facture).
// - Si le document est rattaché à un EmitterProfile → on l'utilise.
// - Sinon (vieux document détaché, FK SET NULL) → fallback sur UserProfile.
// Dans les deux cas, `name` reste l'identité de la personne (compte Google) et
// `companyName` la raison sociale ; le template affiche la raison sociale en gros.
export async function resolveEmitter(opts: {
  userId: string
  emitterProfileId: string | null
  userName: string | null
  userEmail: string | null
}): Promise<{ emitter: EmitterBlock; accentColor: string | null }> {
  const { userId, emitterProfileId, userName, userEmail } = opts

  if (emitterProfileId) {
    const e = await prisma.emitterProfile.findFirst({ where: { id: emitterProfileId, userId } })
    if (e) {
      return {
        accentColor: e.pdfAccentColor,
        emitter: {
          name: userName ?? "Freelance",
          email: e.email ?? userEmail ?? "",
          // À défaut de raison sociale, on retombe sur le libellé interne pour
          // ne pas laisser le bloc sans marque.
          companyName: e.companyName?.trim() || e.name,
          address: e.address,
          postalCode: e.postalCode,
          city: e.city,
          siret: e.siret,
          phone: e.phone,
          website: e.website,
          bankName: e.bankName,
          iban: e.iban,
          bic: e.bic,
        },
      }
    }
  }

  // Fallback : ancienne identité émetteur portée par UserProfile.
  const p = await prisma.userProfile.findUnique({ where: { userId } }).catch(() => null)
  return {
    accentColor: p?.pdfAccentColor ?? null,
    emitter: {
      name: userName ?? "Freelance",
      email: userEmail ?? "",
      companyName: p?.companyName,
      address: p?.address,
      postalCode: p?.postalCode,
      city: p?.city,
      siret: p?.siret,
      phone: p?.phone,
      website: p?.website,
      iban: p?.iban,
      bic: p?.bic,
    },
  }
}
