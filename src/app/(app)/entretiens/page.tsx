import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { EntretienView, type JobAppStatus } from "@/components/modules/entretien/EntretienView"
import { STATUS_CONFIG } from "@/components/modules/entretien/status-config"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Entretiens — ERP Freelance" }

export default async function EntretiensPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: initialStatus } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  const [applications, contacts, companies] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true, company: true, linkedinUrl: true } },
        company: { select: { id: true, name: true } },
        events: { orderBy: { date: "desc" } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      select: { id: true, name: true, email: true, phone: true, company: true, linkedinUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const CLOSED: JobAppStatus[] = ["ACCEPTED", "REJECTED", "WITHDRAWN", "GHOSTED"]
  const active   = applications.filter((a) => !CLOSED.includes(a.status as JobAppStatus))
  const upcoming = applications.filter((a) => a.nextActionAt && new Date(a.nextActionAt) >= new Date(new Date().setHours(0, 0, 0, 0)))
  const offers   = applications.filter((a) => a.status === "OFFER" || a.status === "ACCEPTED")
  const accepted = applications.filter((a) => a.status === "ACCEPTED")

  const validStatus = initialStatus && initialStatus in STATUS_CONFIG
    ? (initialStatus as JobAppStatus)
    : undefined

  return (
    <EntretienView
      applications={applications}
      contacts={contacts}
      companies={companies}
      initialStatus={validStatus}
      stats={{ active: active.length, upcoming: upcoming.length, offers: offers.length, accepted: accepted.length }}
    />
  )
}
