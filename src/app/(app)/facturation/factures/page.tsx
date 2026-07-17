import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacturesListView } from "@/components/modules/facturation/FacturesListView"

export default async function FacturesListPage() {
  const session = await auth()
  const userId = session!.user.id

  const [invoices, clients, companies, projects, quotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true, companyId: true } },
        project: { select: { id: true, name: true, companyId: true } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, type: true, companyId: true },
    }),
    prisma.company.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true, companyId: true },
    }),
    prisma.quote.findMany({
      where: { userId, status: { notIn: ["DRAFT", "REJECTED"] } },
      select: {
        id: true, number: true, clientId: true, projectId: true,
        totalHT: true, depositPercent: true, status: true,
        client: { select: { name: true, company: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return (
    <FacturesListView
      userId={userId}
      invoices={invoices}
      clients={clients}
      companies={companies}
      projects={projects}
      quotes={quotes}
    />
  )
}
