import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PlatformDetail } from "@/components/modules/investissements/PlatformDetail"

export default async function PlatformDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const platform = await prisma.investmentPlatform.findFirst({
    where: { id, userId },
    include: {
      entries: {
        orderBy: { date: "asc" },
        select: { id: true, date: true, capital: true, contribution: true, note: true },
      },
    },
  })
  if (!platform) notFound()

  const data = {
    id: platform.id,
    name: platform.name,
    type: platform.type,
    url: platform.url,
    notes: platform.notes,
    entries: platform.entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      capital: e.capital,
      contribution: e.contribution,
      note: e.note,
    })),
  }

  return <PlatformDetail platform={data} />
}
