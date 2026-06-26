import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ApplicationDetailView } from "@/components/modules/entretien/ApplicationDetailView"

export const metadata: Metadata = { title: "Process recrutement — ERP Freelance" }

export default async function EntretienDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const [app, contacts, companies] = await Promise.all([
    prisma.jobApplication.findFirst({
      where: { id, userId },
      include: {
        contact: {
          select: {
            id: true, name: true, email: true, phone: true,
            company: true, linkedinUrl: true, notes: true,
          },
        },
        company: { select: { id: true, name: true, city: true, website: true } },
        events: { orderBy: { date: "asc" } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      select: { id: true, name: true, email: true, phone: true, company: true, linkedinUrl: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.company.findMany({
      where: { userId, OR: [
        { companyType: { in: ["ESN", "RECRUTEMENT", "CLIENT"] } },
        { companyType: null },
      ]},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!app) notFound()

  return <ApplicationDetailView app={app} contacts={contacts} companies={companies} />
}
