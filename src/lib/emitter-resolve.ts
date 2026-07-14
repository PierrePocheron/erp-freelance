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

// Branding PDF global (UserProfile) consommé par le template « Pedro ».
export type PdfBranding = {
  logoText: string | null
  logoSubtext: string | null
  backgroundColor: string | null
}

/**
 * Initiales de l'utilisateur (2 lettres max) — défaut du logo texte quand
 * aucun n'est configuré. « Pierre Pocheron » → « PP » ; un seul mot → ses
 * 2 premières lettres ; sans nom → 1re lettre de l'email.
 */
function initialsOf(name: string | null, email: string | null): string {
  const clean = (name ?? "").trim()
  if (clean) {
    const words = clean.split(/\s+/).filter(Boolean)
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return words[0].slice(0, 2).toUpperCase()
  }
  return (email?.[0] ?? "•").toUpperCase()
}

// Résout le bloc émetteur d'un document (devis/facture).
// - Si le document est rattaché à un EmitterProfile → on l'utilise.
// - Sinon (vieux document détaché, FK SET NULL) → fallback sur UserProfile.
// Dans les deux cas, `name` reste l'identité de la personne (compte Google) et
// `companyName` la raison sociale. Le branding PDF (logo texte, sous-titre,
// fond de page) est global : il vient toujours de UserProfile, quelle que soit
// la société émettrice.
export async function resolveEmitter(opts: {
  userId: string
  emitterProfileId: string | null
  userName: string | null
  userEmail: string | null
}): Promise<{ emitter: EmitterBlock; accentColor: string | null; branding: PdfBranding }> {
  const { userId, emitterProfileId, userName, userEmail } = opts

  const p = await prisma.userProfile.findUnique({ where: { userId } }).catch(() => null)
  const branding: PdfBranding = {
    // Défauts dynamiques : initiales de l'utilisateur (logo) et raison
    // sociale/nom (sous-titre) — un profil vierge produit déjà un PDF marqué.
    logoText: p?.pdfLogoText?.trim() || initialsOf(userName, userEmail),
    logoSubtext: p?.pdfLogoSubtext?.trim() || (p?.companyName ?? userName ?? "").toUpperCase() || null,
    backgroundColor: p?.pdfBackgroundColor ?? null,
  }

  if (emitterProfileId) {
    const e = await prisma.emitterProfile.findFirst({ where: { id: emitterProfileId, userId } })
    if (e) {
      return {
        accentColor: e.pdfAccentColor,
        branding,
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
  return {
    accentColor: p?.pdfAccentColor ?? null,
    branding,
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
      bankName: p?.pdfBankName,
      iban: p?.iban,
      bic: p?.bic,
    },
  }
}
