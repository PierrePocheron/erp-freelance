"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

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
  await prisma.userProfile.upsert({
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
