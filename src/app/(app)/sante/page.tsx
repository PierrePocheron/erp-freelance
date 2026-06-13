import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { HealthView } from "@/components/modules/sante/HealthView"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Santé — ERP Freelance" }

export default async function SantePage() {
  const session = await auth()
  const userId = session!.user.id

  const currentYear = new Date().getFullYear()
  const yearStart   = new Date(currentYear, 0, 1)
  const yearEnd     = new Date(currentYear, 11, 31, 23, 59, 59)

  const [events, consultations, reimbursements] = await Promise.all([
    prisma.healthEvent.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.healthConsultation.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: {
        healthEvent: { select: { id: true, title: true, bodyPart: true } },
        reimbursements: true,
      },
    }),
    prisma.healthReimbursement.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: {
        consultation: { select: { id: true, title: true, practitionerName: true } },
      },
    }),
  ])

  // Stats année courante
  const consultationsThisYear = consultations.filter(
    (c) => c.date >= yearStart && c.date <= yearEnd
  )
  const spentThisYear = consultationsThisYear
    .reduce((s, c) => s + (c.cost ?? 0), 0)
  const reimbursedThisYear = reimbursements
    .filter((r) => r.date >= yearStart && r.date <= yearEnd)
    .reduce((s, r) => s + r.amount, 0)
  const activeIssues = events.filter((e) => !e.resolvedAt).length

  return (
    <HealthView
      events={events}
      consultations={consultations}
      reimbursements={reimbursements}
      stats={{ consultationsThisYear: consultationsThisYear.length, spentThisYear, reimbursedThisYear, activeIssues }}
      currentYear={currentYear}
    />
  )
}
