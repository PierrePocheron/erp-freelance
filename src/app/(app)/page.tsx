import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  CheckSquare, AlertCircle, Clock, Users,
  TrendingUp, Bell, Code2, Calendar, Circle,
} from "lucide-react"
import { QuickActionsBar } from "@/components/modules/dashboard/QuickActionsBar"

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user.id
  const firstName = session?.user?.name?.split(" ")[0] ?? "vous"

  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0))
  const todayEnd = new Date(today.setHours(23, 59, 59, 999))

  const [
    tasksDueToday,
    tasksInProgress,
    upcomingReminders,
    unpaidInvoices,
    lateInvoices,
    activeProjects,
    pendingQuotes,
    recentInteractions,
    upcomingMilestones,
    quickClients,
    quickProjects,
    quickProducts,
    userProfile,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: { userId },
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { not: "DONE" },
        parentTaskId: null,
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        project: { userId },
        status: "IN_PROGRESS",
        parentTaskId: null,
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.reminder.findMany({
      where: {
        client: { userId },
        isDone: false,
        dueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { userId, status: "SENT" },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.invoice.count({ where: { userId, status: "LATE" } }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.quote.count({ where: { userId, status: "SENT" } }),
    prisma.interaction.findMany({
      where: { client: { userId } },
      orderBy: { date: "desc" },
      take: 3,
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.milestone.findMany({
      where: {
        project: { userId },
        status: { not: "DONE" },
        date: { gte: new Date() },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      select: { id: true, name: true, company: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    }) as unknown as Array<{ id: string; name: string; description: string | null; unitPrice: number; unit: string; isActive: boolean; billingType: string; defaultTaxRate: number }>,
    prisma.userProfile.findUnique({ where: { userId } }),
  ])

  const totalPending = unpaidInvoices.reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bonjour" : "Bonsoir"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Raccourcis */}
      <QuickActionsBar userId={userId} clients={quickClients} projects={quickProjects} products={quickProducts} defaultConditions={userProfile?.defaultConditions ?? ""} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard href="/projets" icon={<Code2 className="h-4 w-4" />} label="Projets actifs" value={activeProjects} color="indigo" />
        <KPICard href="/facturation/factures" icon={<TrendingUp className="h-4 w-4" />} label="En attente" value={`${totalPending.toLocaleString("fr-FR")} €`} color="blue" />
        <KPICard href="/facturation/factures" icon={<AlertCircle className="h-4 w-4" />} label="En retard" value={lateInvoices} color={lateInvoices > 0 ? "red" : "muted"} />
        <KPICard href="/facturation/devis" icon={<Clock className="h-4 w-4" />} label="Devis envoyés" value={pendingQuotes} color="amber" />
        <KPICard href="/crm" icon={<Bell className="h-4 w-4" />} label="Rappels" value={upcomingReminders.length} color={upcomingReminders.some(r => new Date(r.dueDate) < new Date()) ? "red" : "muted"} />
        <KPICard href="/projets" icon={<CheckSquare className="h-4 w-4" />} label="En cours" value={tasksInProgress.length} color="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">

          {/* Tâches en cours */}
          {tasksInProgress.length > 0 && (
            <Section title="Tâches en cours" icon={<CheckSquare className="h-4 w-4" />} href="/projets">
              <div className="space-y-1.5">
                {tasksInProgress.map((task) => (
                  <Link key={task.id} href={`/projets/${task.project.id}/dev`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.project.name}</p>
                    </div>
                    {task.dueDate && (
                      <span className={`text-xs shrink-0 ${new Date(task.dueDate) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Tâches dues aujourd'hui */}
          {tasksDueToday.length > 0 && (
            <Section title="Échéances aujourd'hui" icon={<Calendar className="h-4 w-4" />} href="/projets">
              <div className="space-y-1.5">
                {tasksDueToday.map((task) => (
                  <Link key={task.id} href={`/projets/${task.project.id}/dev`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.project.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Factures impayées */}
          {unpaidInvoices.length > 0 && (
            <Section title="Factures en attente" icon={<TrendingUp className="h-4 w-4" />} href="/facturation/factures">
              <div className="space-y-1.5">
                {unpaidInvoices.map((inv) => {
                  const isLate = inv.dueDate && new Date(inv.dueDate) < new Date()
                  return (
                    <Link key={inv.id} href={`/facturation/factures/${inv.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${isLate ? "bg-red-500" : "bg-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono">{inv.number}</p>
                        <p className="text-xs text-muted-foreground">{inv.client.company ?? inv.client.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isLate ? "text-red-500" : ""}`}>
                          {(inv.totalHT - inv.depositDeducted).toLocaleString("fr-FR")} €
                        </p>
                        {inv.dueDate && (
                          <p className={`text-xs ${isLate ? "text-red-500" : "text-muted-foreground"}`}>
                            {isLate ? "En retard · " : ""}
                            {new Date(inv.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Jalons à venir */}
          {upcomingMilestones.length > 0 && (
            <Section title="Jalons à venir" icon={<Calendar className="h-4 w-4" />} href="/projets">
              <div className="space-y-1.5">
                {upcomingMilestones.map((m) => (
                  <Link key={m.id} href={`/projets/${m.project.id}/dev`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.project.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Colonne secondaire */}
        <div className="space-y-6">
          {/* Rappels */}
          {upcomingReminders.length > 0 && (
            <Section title="Rappels" icon={<Bell className="h-4 w-4" />} href="/crm">
              <div className="space-y-1.5">
                {upcomingReminders.map((r) => {
                  const isLate = new Date(r.dueDate) < new Date()
                  return (
                    <div key={r.id} className="flex items-start gap-2 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                      <form action={async () => {
                        "use server"
                        const { toggleReminder } = await import("@/actions/crm")
                        await toggleReminder(r.id, r.client.id, true)
                      }}>
                        <button type="submit" title="Marquer comme fait" className="mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors shrink-0">
                          <Circle className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <Link href={`/crm/${r.client.id}/rappels`} className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.client.name}</p>
                        {r.note && <p className="text-xs text-muted-foreground truncate">{r.note}</p>}
                        <p className={`text-xs ${isLate ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {new Date(r.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          {isLate && " · En retard"}
                        </p>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Activité récente */}
          {recentInteractions.length > 0 && (
            <Section title="Activité récente" icon={<Users className="h-4 w-4" />} href="/crm">
              <div className="space-y-1.5">
                {recentInteractions.map((i) => (
                  <Link key={i.id} href={`/crm/${i.client.id}/interactions`} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{i.client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(i.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Tous ok */}
          {tasksInProgress.length === 0 && tasksDueToday.length === 0 && unpaidInvoices.length === 0 && upcomingReminders.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              Tout est à jour ✓
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({
  href, icon, label, value, color,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string | number
  color: "indigo" | "blue" | "amber" | "red" | "emerald" | "muted"
}) {
  const colorMap = {
    indigo: "text-indigo-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
    red: "text-red-600",
    emerald: "text-emerald-600",
    muted: "text-muted-foreground",
  }
  return (
    <Link href={href}>
      <div className="rounded-xl border border-border/50 bg-card p-4 hover:border-border hover:shadow-sm transition-all space-y-1">
        <div className={`flex items-center gap-1.5 text-xs ${colorMap[color]}`}>{icon}{label}</div>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Link>
  )
}

function Section({
  title, icon, href, children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </div>
        <Link href={href} className="text-xs text-primary hover:underline">Voir tout →</Link>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}
