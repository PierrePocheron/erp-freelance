import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ProspectionModeView } from "@/components/modules/prospection/ProspectionModeView"
import { PIPELINE_STATUSES } from "@/components/modules/prospection/status-config"
import { prospectionFromAddress } from "@/lib/prospection-email"
import type { ProspectStatus, WebsiteType } from "@/generated/prisma/enums"

const WEBSITE_TYPES: WebsiteType[] = ["SHOWCASE", "ECOMMERCE", "BLOG_CONTENT", "OUTDATED", "OTHER"]

/**
 * Mode prospection : session de démarchage sur une sélection FIGÉE de
 * prospects (?ids=a,b,c — ordre conservé). Un lancement par conditions
 * (?statut= &type= &n=) est d'abord résolu en cette liste d'ids, puis
 * l'URL est réécrite : la session reste stable même quand une action
 * (Perdu, Gagné…) fait sortir un prospect du filtre — sinon le
 * rafraîchissement serveur post-action rétrécit la liste et donne
 * l'illusion d'un passage automatique au suivant.
 */
export default async function ProspectionModePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; statut?: string; type?: string; n?: string }>
}) {
  const { ids, statut, type, n } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  const idList = ids?.split(",").filter(Boolean).slice(0, 100) ?? []

  // ── Lancement par conditions : résoudre une fois, puis figer via ?ids= ──
  if (idList.length === 0) {
    const statusFilter = statut && (PIPELINE_STATUSES as string[]).includes(statut) ? (statut as ProspectStatus) : null
    const typeFilter = type && (WEBSITE_TYPES as string[]).includes(type) ? (type as WebsiteType) : null
    const count = Math.min(Math.max(Number(n) || 10, 1), 50)

    const matching = await prisma.client.findMany({
      where: {
        userId,
        type: "PROSPECT",
        prospectStatus: statusFilter ?? { in: PIPELINE_STATUSES },
        ...(typeFilter ? { websiteType: typeFilter } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: count,
      select: { id: true },
    })

    if (matching.length === 0) {
      return <EmptyState />
    }
    redirect(`/prospection/mode?ids=${matching.map((m) => m.id).join(",")}`)
  }

  const [prospects, templates, callTemplates] = await Promise.all([
    prisma.client.findMany({
      where: { userId, id: { in: idList } },
      include: {
        prospectNotes: { orderBy: { createdAt: "desc" } },
        prospectEvents: { orderBy: { date: "desc" } },
      },
    }),
    prisma.emailTemplate.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, subject: true, body: true },
    }),
    prisma.callTemplate.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, script: true },
    }),
  ])

  // L'ordre de la sélection prime sur l'ordre de la base
  const ordered = idList
    .map((id) => prospects.find((p) => p.id === id))
    .filter((p): p is (typeof prospects)[number] => !!p)

  if (ordered.length === 0) return <EmptyState />

  return (
    <ProspectionModeView
      prospects={ordered}
      templates={templates}
      callTemplates={callTemplates}
      emailFromConfigured={prospectionFromAddress() !== null}
    />
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Aucun prospect à traiter</h1>
      <p className="text-sm text-muted-foreground">Aucun prospect ne correspond à ces conditions.</p>
      <Link
        href="/prospection"
        className="inline-flex items-center h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        ← Retour à la prospection
      </Link>
    </div>
  )
}
