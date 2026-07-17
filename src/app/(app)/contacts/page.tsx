import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CreateClientDialog } from "@/components/modules/crm/CreateClientDialog"
import { CrmList } from "@/components/modules/crm/CrmList"
import { Users, Thermometer, TrendingUp, AlertCircle, Target } from "lucide-react"
import { isContactIncomplete } from "@/lib/contact"
import { IncompleteContactsSheet } from "@/components/modules/crm/IncompleteContactsSheet"

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
        status: true,
        totalHT: true,
        depositDeducted: true,
        payments: { select: { amount: true } },
      },
    }),
  ])

  const billingByClient: Record<string, { totalFacture: number; totalEncaisse: number }> = {}
  for (const inv of clientInvoices) {
    if (!inv.clientId) continue
    const net = inv.totalHT - inv.depositDeducted
    const paid = inv.status === "PAID"
      ? net
      : inv.payments.reduce((s, p) => s + p.amount, 0)
    const entry = billingByClient[inv.clientId] ?? { totalFacture: 0, totalEncaisse: 0 }
    entry.totalFacture += net
    entry.totalEncaisse += paid
    billingByClient[inv.clientId] = entry
  }

  const clientsWithBilling = clients.map((c) => ({
    ...c,
    billing: billingByClient[c.id] ?? { totalFacture: 0, totalEncaisse: 0 },
    incomplete: isContactIncomplete(c),
  }))

  const incompleteContacts = clientsWithBilling.filter((c) => c.incomplete)
  const incompleteCount = incompleteContacts.length
  const toComplete     = clientsWithBilling.filter((c) => c.type === "TO_COMPLETE")
  const prospectCount  = clientsWithBilling.filter((c) => c.type === "PROSPECT").length
  const activeClients  = clientsWithBilling.filter((c) => c.type === "CLIENT")
  const personalClients = clientsWithBilling.filter((c) => c.type === "PERSONAL")
  const pendingReminders = clients.reduce((acc, c) => acc + c.reminders.length, 0)

  const groups = [
    ...(toComplete.length > 0 ? [{ key: "TO_COMPLETE", label: "À compléter", items: toComplete }] : []),
    { key: "CLIENT",   label: "Clients",  items: activeClients  },
    { key: "PERSONAL", label: "Perso",    items: personalClients },
    { key: "INACTIVE", label: "Inactifs", items: clientsWithBilling.filter((c) => c.type === "INACTIVE") },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{clients.length} contact{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <CreateClientDialog userId={userId} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<Users className="h-4 w-4" />}               label="Total"      value={clients.length} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-500" />} label="Clients" value={activeClients.length} />
        <StatCard icon={<Target className="h-4 w-4 text-amber-500" />} label="Prospects"  value={prospectCount} link="/prospection" />
        <StatCard icon={<Users className="h-4 w-4 text-violet-500" />} label="Perso"     value={personalClients.length} />
        {toComplete.length > 0 && (
          <StatCard icon={<AlertCircle className="h-4 w-4 text-rose-500" />} label="À compléter" value={toComplete.length} highlight="rose" />
        )}
        {/* Données manquantes (prénom/nom ou coordonnées) — distinct du type "À compléter" ci-dessus */}
        {incompleteCount > 0 ? (
          <IncompleteContactsSheet
            contacts={incompleteContacts.map((c) => ({
              id: c.id, name: c.name, company: c.company,
              firstName: c.firstName, lastName: c.lastName,
              email: c.email, phone: c.phone,
            }))}
          />
        ) : (
          <StatCard icon={<Thermometer className="h-4 w-4 text-amber-500" />} label="Rappels" value={pendingReminders} />
        )}
      </div>

      {/* Liste CRM — clients, perso, inactifs */}
      <CrmList groups={groups} userId={userId} />
    </div>
  )
}

function StatCard({
  icon, label, value, highlight, link,
}: {
  icon: React.ReactNode
  label: string
  value: number
  highlight?: "rose" | "amber"
  link?: string
}) {
  const cls = highlight === "rose"
    ? { border: "border-rose-500/30 bg-rose-500/5", text: "text-rose-600" }
    : highlight === "amber"
    ? { border: "border-amber-500/30 bg-amber-500/5", text: "text-amber-600" }
    : { border: "border-border/50 bg-card", text: "" }
  const inner = (
    <div className={`rounded-xl border p-4 space-y-1 transition-colors ${cls.border} ${link ? "hover:border-border cursor-pointer" : ""}`}>
      <div className={`flex items-center gap-2 text-xs ${highlight ? cls.text : "text-muted-foreground"}`}>{icon}{label}</div>
      <p className={`text-2xl font-bold ${cls.text}`}>{value}</p>
    </div>
  )
  return link ? <Link href={link}>{inner}</Link> : inner
}
