import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ContactsNav } from "@/components/modules/crm/ContactsNav"
import { ProspectsView } from "@/components/modules/crm/ProspectsView"
import { STAGE_CONFIG, type ProspectStage } from "@/components/modules/crm/ProspectsView"
import { TrendingUp, Flame, CheckCircle2, XCircle } from "lucide-react"

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage: initialStage } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  const prospects = await prisma.client.findMany({
    where: { userId, type: "PROSPECT" },
    orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { interactions: true, projects: true } },
      interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true, channel: true } },
      reminders: { where: { isDone: false }, orderBy: { dueDate: "asc" }, take: 1 },
    },
  })

  // Statistiques pipeline
  const active = prospects.filter((p) =>
    !["WON", "LOST", "ON_HOLD"].includes(p.prospectStage)
  )
  const hot  = prospects.filter((p) => p.temperature === "HOT")
  const won  = prospects.filter((p) => p.prospectStage === "WON")
  const lost = prospects.filter((p) => p.prospectStage === "LOST")

  // Validation du stage initial (passé via ?stage=)
  const validStage = initialStage && initialStage in STAGE_CONFIG
    ? (initialStage as ProspectStage)
    : undefined

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Onglets */}
      <ContactsNav />

      {/* Stats pipeline */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
          label="En pipeline"
          value={active.length}
        />
        <StatCard
          icon={<Flame className="h-4 w-4 text-red-500" />}
          label="Chauds"
          value={hot.length}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Gagnés"
          value={won.length}
          variant="success"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-red-400" />}
          label="Perdus"
          value={lost.length}
          variant="muted"
        />
      </div>

      {/* Vue pipeline complète */}
      <ProspectsView prospects={prospects} userId={userId} initialStage={validStage} />
    </div>
  )
}

function StatCard({
  icon, label, value, variant,
}: {
  icon: React.ReactNode
  label: string
  value: number
  variant?: "success" | "muted"
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={`text-2xl font-bold ${variant === "success" ? "text-emerald-600" : variant === "muted" ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
    </div>
  )
}
