import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjetsListView } from "@/components/modules/projet/ProjetsListView"
import { ProjectIdeasPanel } from "@/components/modules/projet/ProjectIdeasPanel"

export default async function ProjetsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [projects, clients, projectTags, projectInvoices, ideas] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true, type: true } },
        members: { select: { userId: true } },
        _count: { select: { tasks: true } },
        tasks: { select: { status: true }, where: { parentTaskId: null } },
      },
    }),
    prisma.client.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, company: true, type: true },
    }),
    prisma.project.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
      select: { id: true, tags: { select: { id: true, name: true, color: true } } },
    }).catch(() => [] as { id: string; tags: { id: string; name: string; color: string }[] }[]),
    prisma.invoice.findMany({
      where: { userId, projectId: { not: null }, status: { not: "DRAFT" } },
      select: {
        projectId: true,
        totalHT: true,
        depositDeducted: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.projectIdea.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, content: true, createdAt: true },
    }),
  ])

  const billingByProject: Record<string, { totalFacture: number; totalEncaisse: number }> = {}
  for (const inv of projectInvoices) {
    if (!inv.projectId) continue
    const net = inv.totalHT - inv.depositDeducted
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
    const entry = billingByProject[inv.projectId] ?? { totalFacture: 0, totalEncaisse: 0 }
    entry.totalFacture += net
    entry.totalEncaisse += paid
    billingByProject[inv.projectId] = entry
  }

  const tagsById = Object.fromEntries(projectTags.map((p) => [p.id, p.tags]))

  const projectsWithStats = projects.map((p) => ({
    ...p,
    tags: tagsById[p.id] ?? [],
    tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
    billing: billingByProject[p.id] ?? { totalFacture: 0, totalEncaisse: 0 },
  }))

  const clientsForIdeas = clients.map((c) => ({ id: c.id, name: c.name, company: c.company }))

  return (
    <div className="space-y-8">
      <ProjectIdeasPanel userId={userId} initialIdeas={ideas} clients={clientsForIdeas} />
      <ProjetsListView userId={userId} projects={projectsWithStats} clients={clients} />
    </div>
  )
}
