import "server-only"
import { prisma } from "@/lib/prisma"
import { initialsOf } from "@/lib/initials"

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

  // Les deux lectures sont indépendantes (le branding vient de UserProfile, le
  // bloc émetteur de EmitterProfile) → on les lance en parallèle pour économiser
  // un aller-retour DB à chaque génération de PDF.
  const [p, e] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }).catch(() => null),
    emitterProfileId
      ? prisma.emitterProfile.findFirst({ where: { id: emitterProfileId, userId } })
      : Promise.resolve(null),
  ])

  const branding: PdfBranding = {
    // Défauts dynamiques : initiales de l'utilisateur (logo) et raison
    // sociale/nom (sous-titre) — un profil vierge produit déjà un PDF marqué.
    logoText: p?.pdfLogoText?.trim() || initialsOf(userName, userEmail),
    logoSubtext: p?.pdfLogoSubtext?.trim() || (p?.companyName ?? userName ?? "").toUpperCase() || null,
    backgroundColor: p?.pdfBackgroundColor ?? null,
  }

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
