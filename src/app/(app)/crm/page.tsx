import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateClientDialog } from "@/components/modules/crm/CreateClientDialog"
import { CrmList } from "@/components/modules/crm/CrmList"
import { Users, Flame, Thermometer, TrendingUp } from "lucide-react"

export default async function CRMPage() {
  const session = await auth()
  const userId = session!.user.id

  const clients = await prisma.client.findMany({
    where: { userId, type: { not: "SELF" } },
    orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { interactions: true, projects: true } },
      interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true, channel: true } },
      reminders: { where: { isDone: false }, orderBy: { dueDate: "asc" }, take: 1 },
    },
  })

  const prospects = clients.filter((c) => c.type === "PROSPECT")
  const activeClients = clients.filter((c) => c.type === "CLIENT")
  const hot = clients.filter((c) => c.temperature === "HOT")
  const pendingReminders = clients.reduce((acc, c) => acc + c.reminders.length, 0)

  const groups = [
    { key: "CLIENT", label: "Clients actifs", items: activeClients },
    { key: "PROSPECT", label: "Prospects", items: prospects },
    { key: "INACTIVE", label: "Inactifs", items: clients.filter((c) => c.type === "INACTIVE") },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">{clients.length} contact{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <CreateClientDialog userId={userId} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Contacts" value={clients.length} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Prospects" value={prospects.length} />
        <StatCard icon={<Flame className="h-4 w-4 text-red-500" />} label="Chauds" value={hot.length} />
        <StatCard icon={<Thermometer className="h-4 w-4 text-amber-500" />} label="Rappels" value={pendingReminders} />
      </div>

      <CrmList groups={groups} userId={userId} />
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
