import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacturesListView } from "@/components/modules/facturation/FacturesListView"

export default async function FacturesListPage() {
  const session = await auth()
  const userId = session!.user.id

  const [invoices, clients, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, type: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ])

  return (
    <FacturesListView
      userId={userId}
      invoices={invoices}
      clients={clients}
      projects={projects}
    />
  )
}
