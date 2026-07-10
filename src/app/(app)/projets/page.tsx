import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjetsListView } from "@/components/modules/projet/ProjetsListView"
import { ProjectIdeasPanel } from "@/components/modules/projet/ProjectIdeasPanel"

export default async function ProjetsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [projects, companies, contacts, projectTags, projectInvoices, projectRevenues, ideas] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        contactLinks: {
          select: { role: true, client: { select: { id: true, name: true, company: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        members: { select: { userId: true } },
        _count: { select: { tasks: true } },
        tasks: { select: { status: true }, where: { parentTaskId: null } },
      },
    }),
    prisma.company.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.client.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, company: true, companyId: true },
    }),
    prisma.project.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
      select: { id: true, tags: { select: { id: true, name: true, color: true } } },
    }).catch(() => [] as { id: string; tags: { id: string; name: string; color: string }[] }[]),
    prisma.invoice.findMany({
      where: { userId, projectId: { not: null }, status: { not: "DRAFT" } },
      select: {
        projectId: true,
        status: true,
        totalHT: true,
        depositDeducted: true,
        payments: { select: { amount: true } },
      },
    }),
    // Revenus hors facturation liés à un projet (études, remboursements...)
    prisma.revenue.findMany({
      where: { userId, projectId: { not: null } },
      select: { projectId: true, amount: true, status: true },
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
    // Si la facture est PAID mais sans enregistrements Payment, on considère le net comme encaissé
    const paid = inv.status === "PAID"
      ? net
      : inv.payments.reduce((s, p) => s + p.amount, 0)
    const entry = billingByProject[inv.projectId] ?? { totalFacture: 0, totalEncaisse: 0 }
    entry.totalFacture += net
    entry.totalEncaisse += paid
    billingByProject[inv.projectId] = entry
  }

  const revenueByProject: Record<string, { totalRevenu: number; revenuRecu: number }> = {}
  for (const rev of projectRevenues) {
    if (!rev.projectId) continue
    const entry = revenueByProject[rev.projectId] ?? { totalRevenu: 0, revenuRecu: 0 }
    entry.totalRevenu += rev.amount
    if (rev.status === "RECEIVED") entry.revenuRecu += rev.amount
    revenueByProject[rev.projectId] = entry
  }

  const tagsById = Object.fromEntries(projectTags.map((p) => [p.id, p.tags]))

  const projectsWithStats = projects.map((p) => ({
    ...p,
    tags: tagsById[p.id] ?? [],
    tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
    billing: billingByProject[p.id] ?? { totalFacture: 0, totalEncaisse: 0 },
    revenue: revenueByProject[p.id] ?? { totalRevenu: 0, revenuRecu: 0 },
  }))

  return (
    <div className="space-y-8">
      <ProjetsListView userId={userId} projects={projectsWithStats} companies={companies} contacts={contacts} />
      <ProjectIdeasPanel userId={userId} initialIdeas={ideas} companies={companies} />
    </div>
  )
}
