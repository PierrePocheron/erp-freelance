import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ProspectionModeView } from "@/components/modules/prospection/ProspectionModeView"
import { PIPELINE_STATUSES } from "@/components/modules/prospection/status-config"
import type { ProspectStatus, WebsiteType } from "@/generated/prisma/enums"

const WEBSITE_TYPES: WebsiteType[] = ["SHOWCASE", "ECOMMERCE", "BLOG_CONTENT", "OUTDATED", "OTHER"]

/**
 * Mode prospection : session de démarchage sur une sélection de prospects
 * (?ids=a,b,c — l'ordre de sélection est conservé), ou sur des conditions
 * choisies dans le dialog de lancement (?statut= &type= &n=).
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
  const statusFilter = statut && (PIPELINE_STATUSES as string[]).includes(statut) ? (statut as ProspectStatus) : null
  const typeFilter = type && (WEBSITE_TYPES as string[]).includes(type) ? (type as WebsiteType) : null
  const count = Math.min(Math.max(Number(n) || 10, 1), 50)

  const prospects = await prisma.client.findMany({
    where: idList.length > 0
      ? { userId, id: { in: idList } }
      : {
          userId,
          type: "PROSPECT",
          // Sans condition de statut : tous les statuts actifs du pipeline
          prospectStatus: statusFilter ?? { in: PIPELINE_STATUSES },
          ...(typeFilter ? { websiteType: typeFilter } : {}),
        },
    ...(idList.length === 0 ? { orderBy: { createdAt: "asc" as const }, take: count } : {}),
    include: {
      prospectNotes: { orderBy: { createdAt: "desc" } },
      prospectEvents: { orderBy: { date: "desc" } },
    },
  })

  // L'ordre de la sélection prime sur l'ordre de la base
  const ordered = idList.length > 0
    ? idList.map((id) => prospects.find((p) => p.id === id)).filter((p): p is (typeof prospects)[number] => !!p)
    : prospects

  if (ordered.length === 0) {
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

  return <ProspectionModeView prospects={ordered} />
}
