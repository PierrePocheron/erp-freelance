import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ProspectionTable } from "@/components/modules/prospection/ProspectionTable"
import { ProspectQuickAdd } from "@/components/modules/prospection/ProspectQuickAdd"
import { ImportCsvDialog } from "@/components/modules/prospection/ImportCsvDialog"
import { ALL_STATUSES } from "@/components/modules/prospection/status-config"
import { prospectionFromAddress } from "@/lib/prospection-email"
import { StartSessionDialog } from "@/components/modules/prospection/StartSessionDialog"
import type { ProspectStatus } from "@/generated/prisma/enums"
import { TrendingUp, Send, CheckCircle2, XCircle, Mail, NotebookPen } from "lucide-react"

export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>
}) {
  const { statut: initialStatus } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  const [prospects, templates, pendingDrafts] = await Promise.all([
    prisma.client.findMany({
      // Inclut les gagnés convertis en CLIENT (prospectStatus WON) : ils
      // restent visibles dans le pipeline comme trophées + réversibles.
      where: {
        userId,
        OR: [
          { type: "PROSPECT" },
          { type: "CLIENT", prospectStatus: "WON" },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { interactions: true } },
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true, channel: true } },
      },
    }),
    prisma.emailTemplate.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, subject: true, body: true },
    }),
    // Badge de la file de brouillons : à relire (DRAFT) + relus non envoyés (READY)
    prisma.emailDraft.count({ where: { userId, status: { in: ["DRAFT", "READY"] } } }),
  ])

  const active    = prospects.filter((p) => !["WON", "LOST"].includes(p.prospectStatus))
  const toContact = prospects.filter((p) => p.prospectStatus === "TO_CONTACT")
  const won       = prospects.filter((p) => p.prospectStatus === "WON")
  const lost      = prospects.filter((p) => p.prospectStatus === "LOST")

  const validStatus = initialStatus && (ALL_STATUSES as string[]).includes(initialStatus)
    ? (initialStatus as ProspectStatus)
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Prospection</h1>
          <p className="text-sm text-muted-foreground">
            {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} · démarchage, suivi et relances
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StartSessionDialog />
          <Link
            href="/prospection/brouillons"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Brouillons
            {pendingDrafts > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums">
                {pendingDrafts}
              </span>
            )}
          </Link>
          <Link
            href="/prospection/modeles"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Modèles de mails
          </Link>
          <ImportCsvDialog />
        </div>
      </div>

      {/* Stats — cliquables, elles filtrent le tableau */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={<TrendingUp className="h-4 w-4 text-amber-500" />} label="Actifs" value={active.length} href="/prospection" active={!validStatus} />
        <StatTile icon={<Send className="h-4 w-4 text-blue-500" />} label="À contacter" value={toContact.length} href="/prospection?statut=TO_CONTACT" active={validStatus === "TO_CONTACT"} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Gagnés" value={won.length} href="/prospection?statut=WON" active={validStatus === "WON"} variant="success" />
        <StatTile icon={<XCircle className="h-4 w-4 text-red-400" />} label="Perdus" value={lost.length} href="/prospection?statut=LOST" active={validStatus === "LOST"} variant="muted" />
      </div>

      <ProspectQuickAdd />

      <ProspectionTable
        key={validStatus ?? "all"}
        prospects={prospects}
        userId={userId}
        initialStatus={validStatus}
        templates={templates}
        emailFromConfigured={prospectionFromAddress() !== null}
      />
    </div>
  )
}

function StatTile({
  icon, label, value, href, active, variant,
}: {
  icon: React.ReactNode
  label: string
  value: number
  href: string
  active?: boolean
  variant?: "success" | "muted"
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border bg-card p-4 space-y-1 transition-colors ${
        active ? "border-primary" : "border-border/50 hover:border-border"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={`text-2xl font-bold ${variant === "success" ? "text-emerald-600" : variant === "muted" ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
    </Link>
  )
}
