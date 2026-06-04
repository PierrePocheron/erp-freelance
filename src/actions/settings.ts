"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

export type ProfileData = {
  companyName?: string | null
  siret?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  website?: string | null
  iban?: string | null
  bic?: string | null
  quotePrefix?: string
  invoicePrefix?: string
  quoteNumberFormat?: string
  invoiceNumberFormat?: string
  pdfAccentColor?: string
  customAccentColors?: string | null
  defaultConditions?: string | null
  logoUrl?: string | null
}

export async function saveProfile(_userId: string, data: ProfileData) {
  const userId = await requireAuth()
  await prisma.userProfile?.upsert({
    where: { userId },
    create: {
      userId,
      companyName: data.companyName,
      siret: data.siret,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country ?? "France",
      phone: data.phone,
      website: data.website,
      iban: data.iban,
      bic: data.bic,
      quotePrefix: data.quotePrefix ?? "DEV",
      invoicePrefix: data.invoicePrefix ?? "FAC",
      quoteNumberFormat: data.quoteNumberFormat ?? "PREFIX-YYYY-NNN",
      invoiceNumberFormat: data.invoiceNumberFormat ?? "PREFIX-YYYY-NNN",
      ...(data.pdfAccentColor !== undefined && { pdfAccentColor: data.pdfAccentColor }),
      ...(data.defaultConditions !== undefined && { defaultConditions: data.defaultConditions }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
    } as never,
    update: {
      companyName: data.companyName,
      siret: data.siret,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country ?? undefined,
      phone: data.phone,
      website: data.website,
      iban: data.iban,
      bic: data.bic,
      quotePrefix: data.quotePrefix,
      invoicePrefix: data.invoicePrefix,
      quoteNumberFormat: data.quoteNumberFormat,
      invoiceNumberFormat: data.invoiceNumberFormat,
      ...(data.pdfAccentColor !== undefined && { pdfAccentColor: data.pdfAccentColor }),
      ...(data.defaultConditions !== undefined && { defaultConditions: data.defaultConditions }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
    } as never,
  })
  revalidatePath("/settings")
}

export async function updateAccentColors(_userId: string, colorsJson: string) {
  const userId = await requireAuth()
  await prisma.userProfile?.upsert({
    where: { userId },
    create: { userId, customAccentColors: colorsJson } as never,
    update: { customAccentColors: colorsJson } as never,
  })
}

export async function deleteAllUserData(_userId: string) {
  const userId = await requireAuth()

  // ── Suppression dans l'ordre inverse des dépendances FK ──────────────────

  // Post-Dev (le plus profond : monitoring → renewal → postDev)
  await prisma.monitoringCheck.deleteMany({ where: { postDev: { project: { userId } } } })
  await prisma.renewal.deleteMany({ where: { postDev: { project: { userId } } } })
  await prisma.postDev.deleteMany({ where: { project: { userId } } })

  // Time tracking
  await prisma.timeEntry.deleteMany({ where: { userId } })

  // Facturation : lignes & paiements avant les têtes
  await prisma.payment.deleteMany({ where: { invoice: { userId } } })
  await prisma.invoiceLine.deleteMany({ where: { invoice: { userId } } })
  await prisma.quoteLine.deleteMany({ where: { quote: { userId } } })
  await prisma.emailLog.deleteMany({ where: { userId } })

  // Calendrier & notifications
  await prisma.calendarEvent.deleteMany({ where: { userId } })
  await prisma.notification.deleteMany({ where: { userId } })

  // Tâches : passe 1 → effacer parentTaskId (auto-référence circulaire)
  await prisma.task.updateMany({
    where: { OR: [{ project: { userId } }, { userId }] },
    data: { parentTaskId: null },
  })
  // Tâches : passe 2 → supprimer
  await prisma.task.deleteMany({ where: { OR: [{ project: { userId } }, { userId }] } })
  await prisma.taskTag.deleteMany({ where: { project: { userId } } })

  // Données projet (milestones, journal, livrables, liens, membres)
  await prisma.milestone.deleteMany({ where: { project: { userId } } })
  await prisma.journalEntry.deleteMany({ where: { project: { userId } } })
  await prisma.deliverable.deleteMany({ where: { project: { userId } } })
  await prisma.usefulLink.deleteMany({ where: { project: { userId } } })
  await prisma.projectMember.deleteMany({ where: { project: { userId } } })

  // Facturation têtes (quotes & invoices référencent clients + projets)
  await prisma.recurringInvoice.deleteMany({ where: { userId } })
  await prisma.invoice.deleteMany({ where: { userId } })
  await prisma.quote.deleteMany({ where: { userId } })

  // Projets (maintenant libres de toutes dépendances)
  await prisma.project.deleteMany({ where: { userId } })

  // CRM : interactions, rappels, fichiers puis clients
  await prisma.interaction.deleteMany({ where: { client: { userId } } })
  await prisma.reminder.deleteMany({ where: { client: { userId } } })
  await prisma.clientFile.deleteMany({ where: { client: { userId } } })
  await prisma.client.deleteMany({ where: { userId } })

  // Reste utilisateur
  await prisma.product.deleteMany({ where: { userId } })
  await prisma.tag.deleteMany({ where: { userId } })
  await prisma.conditionsTemplate.deleteMany({ where: { userId } })
  await prisma.projectIdea.deleteMany({ where: { userId } })
  await prisma.emitterProfile.deleteMany({ where: { userId } })
  await prisma.userProfile?.deleteMany({ where: { userId } })

  redirect("/")
}
