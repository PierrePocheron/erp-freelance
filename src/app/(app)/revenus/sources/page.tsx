import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import {
  FiscalSourcesManager,
  type FiscalSourceItem,
  type EmitterSummary,
} from "@/components/modules/settings/FiscalSourcesManager"

export default async function SourcesFiscalesPage() {
  const session = await auth()
  const userId = session!.user.id

  const [fiscalSources, emitters] = await Promise.all([
    prisma.fiscalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        emitterProfiles: { select: { id: true, name: true, companyName: true } },
        _count: { select: { revenues: true } },
      },
    }),
    prisma.emitterProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, companyName: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/revenus"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Revenus
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Sources fiscales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catégorisez vos revenus pour votre déclaration d&apos;impôts
        </p>
      </div>

      <FiscalSourcesManager
        sources={fiscalSources as FiscalSourceItem[]}
        emitters={emitters as EmitterSummary[]}
      />
    </div>
  )
}
