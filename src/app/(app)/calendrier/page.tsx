import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CalendarView, type CalendarEvent } from "@/components/modules/calendrier/CalendarView"

export default async function CalendrierPage() {
  const session = await auth()
  const userId = session!.user.id

  // Fenêtre : 3 mois autour d'aujourd'hui
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
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.milestone.findMany({
      where: {
        project: { userId },
        date: { gte: from, lte: to },
        status: { not: "DONE" },
      },
      include: { project: { select: { id: true } } },
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
    ...tasks.map((t) => ({
      id: t.id,
      date: t.dueDate!,
      title: t.title,
      type: "task" as const,
      href: `/projets/${t.project.id}/dev`,
      isLate: new Date(t.dueDate!) < now,
    })),
    ...milestones.map((m) => ({
      id: m.id,
      date: m.date,
      title: m.name,
      type: "milestone" as const,
      href: `/projets/${m.project.id}/dev`,
      isLate: new Date(m.date) < now,
    })),
    ...reminders.map((r) => ({
      id: r.id,
      date: r.dueDate,
      title: r.client.name + (r.note ? ` — ${r.note}` : ""),
      type: "reminder" as const,
      href: `/client/${r.client.id}/rappels`,
      isLate: new Date(r.dueDate) < now,
    })),
    ...invoices.map((inv) => ({
      id: inv.id,
      date: inv.dueDate!,
      title: inv.number,
      type: "invoice" as const,
      href: `/facturation/factures/${inv.id}`,
      isLate: inv.status === "LATE",
    })),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground">
          Tâches, jalons, rappels, factures et renouvellements
        </p>
      </div>

      <CalendarView events={events} />
    </div>
  )
}
