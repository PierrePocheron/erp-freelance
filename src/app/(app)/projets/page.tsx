import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjetsListView } from "@/components/modules/projet/ProjetsListView"
import { ProjectIdeasPanel } from "@/components/modules/projet/ProjectIdeasPanel"

export default async function ProjetsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [projects, companies, contacts, projectTags, projectInvoices, projectRevenues, ideas, jobApplications, projectActivity] = await Promise.all([
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
        issuedAt: true,
        sentAt: true,
        paidAt: true,
        cancelledAt: true,
      },
    }),
    // Revenus hors facturation liés à un projet (études, remboursements...)
    prisma.revenue.findMany({
      where: { userId, projectId: { not: null } },
      select: { projectId: true, amount: true, status: true, receivedAt: true, expectedAt: true },
    }),
    prisma.projectIdea.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, content: true, createdAt: true },
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      select: { id: true, position: true, companyName: true },
    }),
    // Dates d'activité embarquées (pour trier par « dernière activité »). On lit les vraies
    // dates métier (temps passé, événements, jalons, échéances, fin de projet) plutôt que
    // createdAt/updatedAt — ces derniers sont remis à « maintenant » à chaque re-seed.
    prisma.project.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
        tasks: { select: { completedAt: true, dueDate: true, timeEntries: { select: { startedAt: true, endedAt: true } } } },
        milestones: { select: { date: true } },
        events: { select: { date: true } },
      },
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

  // « Dernière activité » = la date métier la plus récente (temps passé, tâche terminée ou
  // échue, jalon, événement, début/fin de projet) qui n'est PAS dans le futur ; à défaut,
  // updatedAt. Le plafond « ≤ maintenant » évite qu'un jalon/événement planifié fasse
  // remonter le projet avant qu'il ne se produise.
  // eslint-disable-next-line react-hooks/purity -- rendu serveur par requête ; « maintenant » sert à plafonner les activités futures
  const nowMs = Date.now()
  // Dates d'activité issues de la facturation et des revenus (facture émise/envoyée/payée/
  // annulée, revenu reçu/attendu) — regroupées par projet.
  const bizDates: Record<string, number[]> = {}
  const addBiz = (pid: string | null, d: Date | null) => { if (pid && d) (bizDates[pid] ??= []).push(d.getTime()) }
  for (const inv of projectInvoices) { addBiz(inv.projectId, inv.issuedAt); addBiz(inv.projectId, inv.sentAt); addBiz(inv.projectId, inv.paidAt); addBiz(inv.projectId, inv.cancelledAt) }
  for (const rev of projectRevenues) { addBiz(rev.projectId, rev.receivedAt); addBiz(rev.projectId, rev.expectedAt) }

  const activityById: Record<string, number> = {}
  for (const p of projectActivity) {
    const cands: number[] = []
    const push = (d: Date | null | undefined) => { if (d) { const t = d.getTime(); if (t <= nowMs) cands.push(t) } }
    push(p.startDate); push(p.endDate)
    for (const t of p.tasks) {
      push(t.completedAt); push(t.dueDate)
      for (const te of t.timeEntries) { push(te.startedAt); push(te.endedAt) }
    }
    for (const m of p.milestones) push(m.date)
    for (const e of p.events) push(e.date)
    for (const t of bizDates[p.id] ?? []) { if (t <= nowMs) cands.push(t) }
    activityById[p.id] = cands.length ? Math.max(...cands) : p.updatedAt.getTime()
  }

  const projectsWithStats = projects
    .map((p) => ({
      ...p,
      tags: tagsById[p.id] ?? [],
      tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
      billing: billingByProject[p.id] ?? { totalFacture: 0, totalEncaisse: 0 },
      revenue: revenueByProject[p.id] ?? { totalRevenu: 0, revenuRecu: 0 },
      lastActivityAt: activityById[p.id] ?? p.createdAt.getTime(),
    }))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)

  return (
    <div className="space-y-8">
      <ProjetsListView userId={userId} projects={projectsWithStats} companies={companies} contacts={contacts} jobApplications={jobApplications} />
      <ProjectIdeasPanel userId={userId} initialIdeas={ideas} companies={companies} />
    </div>
  )
}
