import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ProspectionModeView } from "@/components/modules/prospection/ProspectionModeView"
import { atelierSans, atelierMono } from "@/lib/atelier-fonts"

/**
 * Mode prospection : session de démarchage plein écran sur une sélection de
 * prospects (?ids=a,b,c — l'ordre de sélection est conservé). Sans sélection,
 * démarre sur les 10 plus anciens « À contacter ».
 */
export default async function ProspectionModePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  const idList = ids?.split(",").filter(Boolean).slice(0, 100) ?? []

  const prospects = await prisma.client.findMany({
    where: idList.length > 0
      ? { userId, id: { in: idList } }
      : { userId, type: "PROSPECT", prospectStatus: "TO_CONTACT" },
    ...(idList.length === 0 ? { orderBy: { createdAt: "asc" as const }, take: 10 } : {}),
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
      <div className={`atelier ${atelierSans.variable} ${atelierMono.variable} -m-3 sm:-m-6 min-h-full bg-[var(--at-bg)] p-8 flex flex-col items-center justify-center gap-4 text-[color:var(--at-ink)]`}>
        <p className="at-label text-[11px] text-[color:var(--at-ink-3)]">✿ Mode prospection</p>
        <h1 className="at-display text-3xl">Aucun prospect à traiter</h1>
        <Link href="/prospection" className="inline-flex items-center h-9 px-4 rounded-full border border-[color:var(--at-rule-strong)] text-sm hover:border-[color:var(--at-ink)] transition-colors">
          ← Retour à la prospection
        </Link>
      </div>
    )
  }

  return <ProspectionModeView prospects={ordered} />
}
