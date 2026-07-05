import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CreateClientDialog } from "@/components/modules/crm/CreateClientDialog"
import { CrmList } from "@/components/modules/crm/CrmList"
import { ContactsNav } from "@/components/modules/crm/ContactsNav"
import { STAGE_CONFIG } from "@/components/modules/crm/ProspectsView"
import { Users, Flame, Thermometer, TrendingUp, AlertCircle, ChevronRight } from "lucide-react"
import { isContactIncomplete } from "@/lib/contact"

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

  const incompleteCount = clientsWithBilling.filter((c) => c.incomplete).length
  const toComplete     = clientsWithBilling.filter((c) => c.type === "TO_COMPLETE")
  const prospects      = clientsWithBilling.filter((c) => c.type === "PROSPECT")
  const activeClients  = clientsWithBilling.filter((c) => c.type === "CLIENT")
  const personalClients = clientsWithBilling.filter((c) => c.type === "PERSONAL")
  const hot            = clients.filter((c) => c.temperature === "HOT")
  const pendingReminders = clients.reduce((acc, c) => acc + c.reminders.length, 0)

  // Comptage par étape pour l'aperçu pipeline
  const stageKeys = Object.keys(STAGE_CONFIG) as (keyof typeof STAGE_CONFIG)[]
  const stageCounts = stageKeys
    .map((s) => ({ stage: s, count: prospects.filter((p) => p.prospectStage === s).length }))
    .filter((s) => s.count > 0)

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
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{clients.length} contact{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <CreateClientDialog userId={userId} />
      </div>

      {/* Onglets */}
      <ContactsNav />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard icon={<Users className="h-4 w-4" />}               label="Total"      value={clients.length} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-500" />} label="Clients" value={activeClients.length} />
        <StatCard icon={<Users className="h-4 w-4 text-amber-500" />} label="Prospects"  value={prospects.length} link="/contacts/prospects" />
        <StatCard icon={<Users className="h-4 w-4 text-violet-500" />} label="Perso"     value={personalClients.length} />
        <StatCard icon={<Flame className="h-4 w-4 text-red-500" />}   label="Chauds"     value={hot.length} />
        {toComplete.length > 0 && (
          <StatCard icon={<AlertCircle className="h-4 w-4 text-rose-500" />} label="À compléter" value={toComplete.length} highlight="rose" />
        )}
        {/* Données manquantes (prénom/nom ou coordonnées) — distinct du type "À compléter" ci-dessus */}
        {incompleteCount > 0 ? (
          <StatCard icon={<AlertCircle className="h-4 w-4 text-amber-500" />} label="Infos manquantes" value={incompleteCount} highlight="amber" />
        ) : (
          <StatCard icon={<Thermometer className="h-4 w-4 text-amber-500" />} label="Rappels" value={pendingReminders} />
        )}
      </div>

      {/* Aperçu prospects — encart compact avec lien vers la page dédiée */}
      {prospects.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aperçu prospection</h2>
            <Link
              href="/contacts/prospects"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Voir le pipeline complet <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stageCounts.map(({ stage, count }) => {
              const cfg = STAGE_CONFIG[stage]
              return (
                <Link
                  key={stage}
                  href={`/contacts/prospects?stage=${stage}`}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${cfg.cls}`}
                >
                  {cfg.label} ({count})
                </Link>
              )
            })}
          </div>
        </div>
      )}

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
