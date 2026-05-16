import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateClientDialog } from "@/components/modules/crm/CreateClientDialog"
import { CrmList } from "@/components/modules/crm/CrmList"
import { Users, Flame, Thermometer, TrendingUp, AlertCircle } from "lucide-react"

export default async function CRMPage() {
  const session = await auth()
  const userId = session!.user.id

  const [clients, clientInvoices] = await Promise.all([
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { interactions: true, projects: true } },
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true, channel: true } },
        reminders: { where: { isDone: false }, orderBy: { dueDate: "asc" }, take: 1 },
      },
    }),
    prisma.invoice.findMany({
      where: { userId, status: { not: "DRAFT" } },
      select: {
        clientId: true,
        totalHT: true,
        depositDeducted: true,
        payments: { select: { amount: true } },
      },
    }),
  ])

  const billingByClient: Record<string, { totalFacture: number; totalEncaisse: number }> = {}
  for (const inv of clientInvoices) {
    const net = inv.totalHT - inv.depositDeducted
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
    const entry = billingByClient[inv.clientId] ?? { totalFacture: 0, totalEncaisse: 0 }
    entry.totalFacture += net
    entry.totalEncaisse += paid
    billingByClient[inv.clientId] = entry
  }

  const clientsWithBilling = clients.map((c) => ({
    ...c,
    billing: billingByClient[c.id] ?? { totalFacture: 0, totalEncaisse: 0 },
  }))

  const toComplete = clientsWithBilling.filter((c) => c.type === "TO_COMPLETE")
  const prospects = clientsWithBilling.filter((c) => c.type === "PROSPECT")
  const activeClients = clientsWithBilling.filter((c) => c.type === "CLIENT")
  const personalClients = clientsWithBilling.filter((c) => c.type === "PERSONAL")
  const hot = clients.filter((c) => c.temperature === "HOT")
  const pendingReminders = clients.reduce((acc, c) => acc + c.reminders.length, 0)

  const groups = [
    ...(toComplete.length > 0 ? [{ key: "TO_COMPLETE", label: "À compléter", items: toComplete }] : []),
    { key: "CLIENT", label: "Clients", items: activeClients },
    { key: "PROSPECT", label: "Prospects", items: prospects },
    { key: "PERSONAL", label: "Perso", items: personalClients },
    { key: "INACTIVE", label: "Inactifs", items: clientsWithBilling.filter((c) => c.type === "INACTIVE") },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} contact{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <CreateClientDialog userId={userId} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<Users className="h-4 w-4" />} label="Contacts" value={clients.length} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-500" />} label="Clients" value={activeClients.length} />
        <StatCard icon={<Users className="h-4 w-4 text-violet-500" />} label="Perso" value={personalClients.length} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Prospects" value={prospects.length} />
        <StatCard icon={<Flame className="h-4 w-4 text-red-500" />} label="Chauds" value={hot.length} />
        {toComplete.length > 0 ? (
          <StatCard icon={<AlertCircle className="h-4 w-4 text-rose-500" />} label="À compléter" value={toComplete.length} highlight />
        ) : (
          <StatCard icon={<Thermometer className="h-4 w-4 text-amber-500" />} label="Rappels" value={pendingReminders} />
        )}
      </div>

      <CrmList groups={groups} userId={userId} />
    </div>
  )
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${highlight ? "border-rose-500/30 bg-rose-500/5" : "border-border/50 bg-card"}`}>
      <div className={`flex items-center gap-2 text-xs ${highlight ? "text-rose-600" : "text-muted-foreground"}`}>{icon}{label}</div>
      <p className={`text-2xl font-bold ${highlight ? "text-rose-600" : ""}`}>{value}</p>
    </div>
  )
}
