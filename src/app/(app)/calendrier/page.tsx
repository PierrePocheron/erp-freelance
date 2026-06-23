import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CalendarView, type CalendarEvent, type CalendarCategory, type ProjectOption, type ClientOption } from "@/components/modules/calendrier/CalendarView"
import { getOrCreateDefaultCategories } from "@/actions/calendar"
import { hasCalendarScope } from "@/lib/google-calendar"

// Shape des événements bruts retournés par $queryRaw
type RawCalEvent = {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date | null
  allDay: boolean
  sourceType: string
  categoryId: string | null
  category: CalendarCategory | null
  projectId: string | null
  clientId: string | null
  projectName: string | null
  clientName: string | null
}

export default async function CalendrierPage() {
  const session = await auth()
  const userId = session!.user.id

  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const to = new Date()
  to.setMonth(to.getMonth() + 2)

  const [categories, googleScope, projects, clients, tasks, milestones, reminders, interactions, invoices, renewals, calEvents, healthConsultations, jobApplications, jobEvents] = await Promise.all([
    getOrCreateDefaultCategories(),
    hasCalendarScope(userId),
    prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        client: { select: { id: true, name: true, company: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { userId },
      select: { id: true, name: true, company: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: {
        OR: [{ project: { userId } }, { client: { userId } }, { userId }],
        dueDate: { gte: from, lte: to },
        status: { not: "DONE" },
        parentTaskId: null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true, company: true } },
          },
        },
        client: { select: { id: true, name: true, company: true } },
      },
    }),
    prisma.milestone.findMany({
      where: {
        project: { userId },
        date: { gte: from, lte: to },
        status: { not: "DONE" },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true, company: true } },
          },
        },
      },
    }),
    prisma.reminder.findMany({
      where: {
        client: { userId },
        dueDate: { gte: from, lte: to },
        isDone: false,
      },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.interaction.findMany({
      where: {
        client: { userId },
        date: { gte: from, lte: to },
      },
      include: { client: { select: { id: true, name: true, company: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        dueDate: { gte: from, lte: to },
        status: { in: ["SENT", "LATE"] },
      },
      select: { id: true, number: true, status: true, totalHT: true, depositDeducted: true, dueDate: true },
    }),
    prisma.renewal.findMany({
      where: {
        postDev: { project: { userId } },
        expiresAt: { gte: from, lte: to },
      },
      include: { postDev: { include: { project: { select: { id: true } } } } },
    }),
    // $queryRaw car CalendarCategory n'est pas encore dans le client généré
    prisma.$queryRaw<RawCalEvent[]>`
      SELECT
        e.id, e.title, e.description,
        e."startDate", e."endDate", e."allDay",
        e."sourceType", e."categoryId",
        e."projectId", e."clientId",
        p.name AS "projectName",
        COALESCE(cl.company, cl.name) AS "clientName",
        CASE WHEN c.id IS NOT NULL THEN
          jsonb_build_object(
            'id', c.id, 'userId', c."userId",
            'name', c.name, 'color', c.color,
            'isDefault', c."isDefault"
          )
        ELSE NULL END AS category
      FROM "CalendarEvent" e
      LEFT JOIN "CalendarCategory" c ON c.id = e."categoryId"
      LEFT JOIN "Project" p ON p.id = e."projectId"
      LEFT JOIN "Client" cl ON cl.id = COALESCE(e."clientId", p."clientId")
      WHERE e."userId" = ${userId}
        AND e."startDate" >= ${from}
        AND e."startDate" <= ${to}
      ORDER BY e."startDate" ASC
    `.catch(() => [] as RawCalEvent[]),
    // Santé : consultations dans la fenêtre
    prisma.healthConsultation.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: { id: true, date: true, title: true, practitionerName: true, practitionerType: true },
    }),
    // Entretiens : prochains points planifiés
    prisma.jobApplication.findMany({
      where: { userId, nextActionAt: { gte: from, lte: to } },
      select: { id: true, nextActionAt: true, nextActionLabel: true, companyName: true, position: true },
    }),
    // Entretiens : points de contact passés/datés
    prisma.jobApplicationEvent.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: {
        id: true, date: true, title: true, type: true,
        application: { select: { id: true, companyName: true, position: true } },
      },
    }),
  ])

  const now = new Date()

  // Index catégories par id pour lookup O(1)
  const catById = Object.fromEntries(categories.map(c => [c.id, c]))

  // Prépare la liste de projets pour CalendarView (projets sans contact sont exclus)
  const projectOptions: ProjectOption[] = projects
    .filter((p) => p.client !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      clientId: p.client!.id,
      clientName: p.client!.company ?? p.client!.name,
    }))

  // Liste de clients (tous, groupables par type côté UI)
  const clientOptions: ClientOption[] = clients.map(c => ({
    id: c.id,
    label: c.company ?? c.name,
    type: c.type,
  }))

  // Catégories par défaut mappées sur les types ERP
  const catTasks     = categories.find(c => c.name === "Tâches")
  const catBilling   = categories.find(c => c.name === "Facturation")
  const catMilestone = categories.find(c => c.name === "Jalons")
  const catRenewal   = categories.find(c => c.name === "Renouvellements")

  const events: CalendarEvent[] = [
    ...tasks.map((t) => {
      // tâche projet OU tâche client directe
      const proj = t.project
      const cli  = t.client ?? proj?.client ?? null
      const clientLabel = cli ? ((cli as { company?: string | null; name: string }).company ?? cli.name) : null
      const d = new Date(t.dueDate!)
      const isAllDay = d.getHours() === 0 && d.getMinutes() === 0
      const subtitle = proj
        ? `${proj.name}${clientLabel ? ` · ${clientLabel}` : ""}`
        : (clientLabel ?? undefined)
      return {
        id: t.id,
        date: t.dueDate!,
        allDay: isAllDay,
        title: t.title,
        description: t.description ?? null,
        subtitle,
        type: "task" as const,
        href: proj ? `/projets/${proj.id}/dev` : (t.clientId ? `/contacts/${t.clientId}` : undefined),
        isLate: new Date(t.dueDate!) < now,
        categoryId: catTasks?.id ?? null,
        categoryColor: catTasks?.color ?? null,
        projectId: proj?.id ?? null,
        clientId: t.clientId ?? null,
        projectName: proj?.name ?? null,
        clientName: clientLabel,
      }
    }),
    ...milestones.map((m) => {
      const clientLabel = m.project.client?.company ?? m.project.client?.name ?? ""
      const d = new Date(m.date)
      const isAllDay = d.getHours() === 0 && d.getMinutes() === 0
      return {
        id: m.id,
        date: m.date,
        allDay: isAllDay,
        title: m.name,
        subtitle: `${m.project.name} · ${clientLabel}`,
        type: "milestone" as const,
        href: `/projets/${m.project.id}/dev`,
        isLate: new Date(m.date) < now,
        categoryId: catMilestone?.id ?? null,
        categoryColor: catMilestone?.color ?? null,
        projectId: m.project.id,
        projectName: m.project.name,
        clientName: clientLabel,
      }
    }),
    ...reminders.map((r) => ({
      id: r.id,
      date: r.dueDate,
      title: r.client.name + (r.note ? ` — ${r.note}` : ""),
      type: "reminder" as const,
      href: `/contacts/${r.client.id}/rappels`,
      isLate: new Date(r.dueDate) < now,
      clientId: r.client.id,
      clientName: r.client.name,
    })),
    ...interactions.map((i) => {
      const clientLabel = i.client.company ?? i.client.name
      const d = new Date(i.date)
      const isAllDay = d.getHours() === 0 && d.getMinutes() === 0
      return {
        id: i.id,
        date: i.date,
        allDay: isAllDay,
        title: i.summary,
        description: i.response ?? null,
        subtitle: `${clientLabel} · ${i.channel.toLowerCase()}`,
        type: "interaction" as const,
        href: `/contacts/${i.client.id}`,
        clientId: i.client.id,
        clientName: clientLabel,
      }
    }),
    ...invoices.map((inv) => {
      const net = inv.totalHT - inv.depositDeducted
      return {
        id: inv.id,
        date: inv.dueDate!,
        title: inv.number,
        subtitle: `Échéance · ${net.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`,
        type: "invoice" as const,
        href: `/facturation/factures/${inv.id}`,
        isLate: inv.status === "LATE",
        categoryId: catBilling?.id ?? null,
        categoryColor: catBilling?.color ?? null,
      }
    }),
    ...renewals.map((r) => ({
      id: r.id,
      date: r.expiresAt,
      title: r.name,
      type: "renewal" as const,
      href: `/projets/${r.postDev.project.id}/post-dev`,
      isLate: new Date(r.expiresAt) < now,
      categoryId: catRenewal?.id ?? null,
      categoryColor: catRenewal?.color ?? null,
    })),
    // Événements CalendarEvent (manuels + Google synchro)
    ...calEvents.map((e) => {
      const cat = e.categoryId
        ? (catById[e.categoryId] ?? e.category ?? null)
        : null
      return {
        id: e.id,
        date: e.startDate,
        endDate: e.endDate ?? null,
        allDay: e.allDay,
        title: e.title,
        description: e.description ?? null,
        subtitle: e.sourceType === "GOOGLE" ? "Google Calendar" : undefined,
        type: "manual" as const,
        isGoogle: e.sourceType === "GOOGLE",
        categoryId: e.categoryId,
        categoryColor: (cat as { color?: string } | null)?.color ?? null,
        projectId: e.projectId ?? null,
        clientId: e.clientId ?? null,
        projectName: e.projectName ?? null,
        clientName: e.clientName ?? null,
      }
    }),
    // Santé : consultations
    ...healthConsultations.map((c) => {
      const d = new Date(c.date)
      const isAllDay = d.getHours() === 0 && d.getMinutes() === 0
      return {
        id: `health-${c.id}`,
        date: c.date,
        allDay: isAllDay,
        title: `🥼 ${c.practitionerName}`,
        subtitle: c.title,
        type: "health" as const,
        href: "/sante",
        isLate: false,
      }
    }),
    // Entretiens : prochains points planifiés
    ...jobApplications.map((a) => {
      const d = new Date(a.nextActionAt!)
      const isAllDay = d.getHours() === 0 && d.getMinutes() === 0
      return {
        id: `jobnext-${a.id}`,
        date: a.nextActionAt!,
        allDay: isAllDay,
        title: a.nextActionLabel ?? `Entretien · ${a.position}`,
        subtitle: `${a.companyName} · ${a.position}`,
        type: "interview" as const,
        href: "/entretiens",
        isLate: new Date(a.nextActionAt!) < now,
      }
    }),
    // Entretiens : points de contact datés
    ...jobEvents.map((ev) => {
      const d = new Date(ev.date)
      const isAllDay = d.getHours() === 0 && d.getMinutes() === 0
      return {
        id: `jobevent-${ev.id}`,
        date: ev.date,
        allDay: isAllDay,
        title: ev.title,
        subtitle: `${ev.application.companyName} · ${ev.application.position}`,
        type: "interview" as const,
        href: "/entretiens",
      }
    }),
  ]

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground">
          Tâches, jalons, rappels, factures, entretiens et santé
        </p>
      </div>

      <CalendarView
        events={events}
        categories={categories}
        projects={projectOptions}
        clients={clientOptions}
        hasGoogleCalendar={googleScope}
        className="flex-1 min-h-0"
      />
    </div>
  )
}
