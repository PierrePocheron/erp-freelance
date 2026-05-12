import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DevisListView } from "@/components/modules/facturation/DevisListView"

export default async function DevisListPage() {
  const session = await auth()
  const userId = session!.user.id

  const [quotes, clients, projects, products, profile] = await Promise.all([
    prisma.quote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true } },
        project: { select: { name: true } },
        _count: { select: { lines: true } },
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
    prisma.product.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }) as unknown as Array<{ id: string; name: string; description: string | null; unitPrice: number; unit: string; isActive: boolean; billingType: string; defaultTaxRate: number }>,
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null),
  ])

  return (
    <DevisListView
      userId={userId}
      quotes={quotes}
      clients={clients}
      projects={projects}
      products={products}
      defaultConditions={profile?.defaultConditions ?? ""}
    />
  )
}
