import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CalendarView, type CalendarEvent } from "@/components/modules/calendrier/CalendarView"

export default async function CalendrierPage() {
  const session = await auth()
  const userId = session!.user.id

  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const to = new Date()
  to.setMonth(to.getMonth() + 2)

  const [tasks, milestones, reminders, invoices, renewals] = await Promise.all([
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
  ])

  const now = new Date()

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
      }
    }),
    ...renewals.map((r) => ({
      id: r.id,
      date: r.expiresAt,
      title: r.name,
      type: "renewal" as const,
      href: `/projets/${r.postDev.project.id}/post-dev`,
      isLate: new Date(r.expiresAt) < now,
    })),
  ]

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground">
          Tâches, jalons, rappels, factures et renouvellements
        </p>
      </div>

      <CalendarView events={events} className="flex-1 min-h-0" />
    </div>
  )
}
