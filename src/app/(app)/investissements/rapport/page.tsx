import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { InvestmentReport } from "@/components/modules/investissements/InvestmentReport"

export const metadata: Metadata = { title: "Rapport investissements — ERP Freelance" }

export default async function RapportInvestissementsPage() {
  const session = await auth()
  const userId = session!.user.id

  const platforms = await prisma.investmentPlatform.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      entries: {
        orderBy: { date: "asc" },
        select: { id: true, date: true, capital: true, contribution: true, note: true },
      },
    },
  })

  const data = platforms.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    url: p.url,
    notes: p.notes,
    entries: p.entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      capital: e.capital,
      contribution: e.contribution,
      note: e.note,
    })),
  }))

  return <InvestmentReport platforms={data} userName={session!.user.name ?? ""} />
}
