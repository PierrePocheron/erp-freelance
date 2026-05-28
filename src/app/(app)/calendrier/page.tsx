import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CalendarView, type CalendarEvent } from "@/components/modules/calendrier/CalendarView"
import { getOrCreateDefaultCategories } from "@/actions/calendar"
import { hasCalendarScope } from "@/lib/google-calendar"

export default async function CalendrierPage() {
  const session = await auth()
  const userId = session!.user.id

  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const to = new Date()
  to.setMonth(to.getMonth() + 2)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any

  const [categories, googleScope, tasks, milestones, reminders, invoices, renewals, manualEvents] = await Promise.all([
    // Catégories : auto-création des défauts au premier accès
    getOrCreateDefaultCategories(),
    hasCalendarScope(userId),
    prisma.task.findMany({
      where: {
        project: { userId },
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
    // Événements CalendarEvent (manuels + Google synchro)
    db.calendarEvent.findMany({
      where: {
        userId,
        startDate: { gte: from, lte: to },
      },
      include: { category: true },
    }).catch(() => []),
  ])

  const now = new Date()

  // Index catégories pour lookup rapide
  const catById = Object.fromEntries(
    (categories as { id: string; name: string; color: string }[]).map(c => [c.id, c])
  )

  // Mappage type → catégorie par défaut
  const catTasks     = (categories as { id: string; name: string; color: string }[]).find(c => c.name === "Tâches")
  const catBilling   = (categories as { id: string; name: string; color: string }[]).find(c => c.name === "Facturation")
  const catMilestone = (categories as { id: string; name: string; color: string }[]).find(c => c.name === "Jalons")
  const catRenewal   = (categories as { id: string; name: string; color: string }[]).find(c => c.name === "Renouvellements")

  const events: CalendarEvent[] = [
    ...tasks.map((t) => {
      const clientLabel = t.project!.client.company ?? t.project!.client.name
      return {
        id: t.id,
        date: t.dueDate!,
        title: t.title,
        subtitle: `${t.project!.name} · ${clientLabel}`,
        type: "task" as const,
        href: `/projets/${t.project!.id}/dev`,
        isLate: new Date(t.dueDate!) < now,
        categoryId: catTasks?.id ?? null,
        categoryColor: catTasks?.color ?? null,
      }
    }),
    ...milestones.map((m) => {
      const clientLabel = m.project.client.company ?? m.project.client.name
      return {
        id: m.id,
        date: m.date,
        title: m.name,
        subtitle: `${m.project.name} · ${clientLabel}`,
        type: "milestone" as const,
        href: `/projets/${m.project.id}/dev`,
        isLate: new Date(m.date) < now,
        categoryId: catMilestone?.id ?? null,
        categoryColor: catMilestone?.color ?? null,
      }
    }),
    ...reminders.map((r) => ({
      id: r.id,
      date: r.dueDate,
      title: r.client.name + (r.note ? ` — ${r.note}` : ""),
      type: "reminder" as const,
      href: `/client/${r.client.id}/rappels`,
      isLate: new Date(r.dueDate) < now,
    })),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...manualEvents.map((e: any) => {
      const cat = e.categoryId ? (catById[e.categoryId] ?? e.category) : null
      const isGoogle = e.sourceType === "GOOGLE"
      return {
        id: e.id,
        date: e.startDate,
        title: e.title,
        subtitle: isGoogle ? "Google Calendar" : undefined,
        type: "manual" as const,
        categoryId: e.categoryId ?? null,
        categoryColor: cat?.color ?? null,
      }
    }),
  ]

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground">
          Tâches, jalons, rappels, factures et renouvellements
        </p>
      </div>

      <CalendarView
        events={events}
        categories={categories}
        hasGoogleCalendar={googleScope}
        className="flex-1 min-h-0"
      />
    </div>
  )
}
