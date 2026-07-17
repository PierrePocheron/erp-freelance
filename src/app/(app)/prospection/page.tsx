import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ProspectionTable } from "@/components/modules/prospection/ProspectionTable"
import { ProspectQuickAdd } from "@/components/modules/prospection/ProspectQuickAdd"
import { ImportCsvDialog } from "@/components/modules/prospection/ImportCsvDialog"
import { ALL_STATUSES } from "@/components/modules/prospection/status-config"
import { prospectionFromAddress } from "@/lib/prospection-email"
import { atelierSans, atelierMono } from "@/lib/atelier-fonts"
import type { ProspectStatus } from "@/generated/prisma/enums"
import { Mail, NotebookPen } from "lucide-react"

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
    // Thème « Atelier » : le module occupe sa propre surface crème (annule le
    // padding du <main> pour peindre bord à bord), encre aubergine, DM Mono
    // pour les métadonnées — la DA du portfolio pierrepocheron.fr.
    <div className={`atelier ${atelierSans.variable} ${atelierMono.variable} -m-3 sm:-m-6 min-h-full bg-[var(--at-bg)] p-4 pb-24 sm:p-8 sm:pb-8 space-y-7 text-[color:var(--at-ink)]`}>
      <div className="flex items-end justify-between flex-wrap gap-4">
        {/* Héro éditorial — c'est la pièce d'identité du module, il reste
            affiché en desktop malgré le header d'app générique */}
        <div>
          <p className="at-label text-[11px] text-[color:var(--at-ink-3)] mb-1.5">✿ Pedro Dev · Lyon</p>
          <h1 className="at-display text-4xl sm:text-[2.75rem] leading-none">Prospection</h1>
          <p className="at-label text-[11px] text-[color:var(--at-ink-3)] mt-2.5">
            {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} · démarchage, suivi & relances
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/prospection/brouillons"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-[color:var(--at-rule-strong)] text-sm text-[color:var(--at-ink-2)] hover:border-[color:var(--at-ink)] hover:bg-[var(--at-paper)] transition-colors"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Brouillons
            {pendingDrafts > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[var(--at-plum)] text-[#FBF4EB] text-[11px] font-semibold tabular-nums">
                {pendingDrafts}
              </span>
            )}
          </Link>
          <Link
            href="/prospection/modeles"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-[color:var(--at-rule-strong)] text-sm text-[color:var(--at-ink-2)] hover:border-[color:var(--at-ink)] hover:bg-[var(--at-paper)] transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Modèles de mails
          </Link>
          <ImportCsvDialog />
        </div>
      </div>

      {/* Tuiles du pipeline — cliquables, elles filtrent le tableau */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Actifs" value={active.length} dotCls="bg-[#E9C64F]" href="/prospection" active={!validStatus} />
        <StatTile label="À contacter" value={toContact.length} dotCls="bg-[#6B5E6C] dark:bg-[#A995A9]" href="/prospection?statut=TO_CONTACT" active={validStatus === "TO_CONTACT"} />
        <StatTile label="Gagnés" value={won.length} dotCls="bg-[#E89D7C]" href="/prospection?statut=WON" active={validStatus === "WON"} />
        <StatTile label="Perdus" value={lost.length} dotCls="bg-[#D898AC]" href="/prospection?statut=LOST" active={validStatus === "LOST"} />
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
  label, value, dotCls, href, active,
}: {
  label: string
  value: number
  dotCls: string
  href: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border bg-[var(--at-paper)] p-4 space-y-1 transition-colors ${
        active
          ? "border-[color:var(--at-ink)]"
          : "border-[color:var(--at-rule-strong)] hover:border-[color:var(--at-ink)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
        <span className="at-label text-[10px] text-[color:var(--at-ink-3)]">{label}</span>
      </div>
      <p className="at-display text-3xl tabular-nums">{value}</p>
    </Link>
  )
}
