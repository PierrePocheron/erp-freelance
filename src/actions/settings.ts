"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

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
}

export async function saveProfile(userId: string, data: ProfileData) {
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
    },
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
    },
  })
  revalidatePath("/settings")
}

export async function deleteAllUserData(userId: string) {
  // Delete in dependency order to avoid FK conflicts
  await prisma.timeEntry.deleteMany({ where: { userId } })
  await prisma.calendarEvent.deleteMany({ where: { userId } })
  await prisma.emailLog.deleteMany({ where: { userId } })
  await prisma.quote.deleteMany({ where: { userId } })
  await prisma.invoice.deleteMany({ where: { userId } })
  await prisma.product.deleteMany({ where: { userId } })
  // Cascade: client → interactions, reminders, projects → tasks, milestones, postDev, etc.
  await prisma.client.deleteMany({ where: { userId } })
  await prisma.tag.deleteMany({ where: { userId } })
  await prisma.userProfile?.deleteMany({ where: { userId } })
  redirect("/")
}
