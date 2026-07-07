import { Fragment } from "react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Building2, AlertCircle, Users, FolderOpen, Wallet, ArrowRight } from "lucide-react"
import { CreateCompanyDialog } from "@/components/modules/societes/CreateCompanyDialog"
import { CompanyTypeSelect, COMPANY_TYPE_CONFIG } from "@/components/modules/societes/CompanyTypeSelect"
import { AddFiscalSourceButton } from "@/components/modules/settings/FiscalSourcesManager"

const BUCKET_LABELS: Record<string, string> = {
  AE_URSSAF:     "AE / URSSAF",
  NON_IMPOSABLE: "Non imposable",
  OTHER:         "Autre",
}

export default async function SocietesPage() {
  const session = await auth()
  const userId = session!.user.id

  const [companies, fiscalSources] = await Promise.all([
    prisma.company.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, phone: true, siret: true,
        website: true, address: true, city: true,
        companyType: true, fiscalSourceId: true,
        _count: { select: { contacts: true, projects: true } },
      },
    }),
    prisma.fiscalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, bucket: true, color: true, isActive: true,
        _count: { select: { companies: true } },
      },
    }),
  ])

  // Group companies by fiscal source (null = sans source)
  const grouped: Array<{
    source: typeof fiscalSources[number] | null
    companies: typeof companies
  }> = []

  // Sources with companies
  for (const src of fiscalSources) {
    const list = companies.filter(c => c.fiscalSourceId === src.id)
    if (list.length > 0) grouped.push({ source: src, companies: list })
  }

  // Companies without a fiscal source
  const unlinked = companies.filter(c => !c.fiscalSourceId)
  if (unlinked.length > 0) grouped.push({ source: null, companies: unlinked })

  const hasGroups = grouped.some(g => g.source !== null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sociétés</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} société{companies.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateCompanyDialog userId={userId} fiscalSources={fiscalSources} />
      </div>

      {/* Carte Sources fiscales */}
      {fiscalSources.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Sources fiscales</h2>
              <span className="text-xs text-muted-foreground">({fiscalSources.length})</span>
            </div>
            <Link
              href="/revenus/sources"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Gérer <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fiscalSources.map((src) => (
              <Link
                key={src.id}
                href="/revenus/sources"
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-muted/50 ${
                  src.isActive ? "border-border/50" : "border-border/30 opacity-50"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: src.color }}
                />
                <span className="font-medium">{src.name}</span>
                <span className="text-muted-foreground">{BUCKET_LABELS[src.bucket] ?? src.bucket}</span>
                <span className="text-muted-foreground tabular-nums">
                  · {src._count.companies} société{src._count.companies !== 1 ? "s" : ""}
                </span>
                {!src.isActive && (
                  <span className="text-muted-foreground italic">inactif</span>
                )}
              </Link>
            ))}
            <AddFiscalSourceButton />
          </div>
        </div>
      )}

      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="font-medium">Aucune société</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première société cliente</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Société</th>
                <th className="px-4 py-3 text-left font-medium">Ville</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Contacts</th>
                <th className="px-4 py-3 text-left font-medium">Projets</th>
              </tr>
            </thead>
            <tbody>
              {hasGroups
                ? grouped.map(({ source, companies: list }) => (
                    <Fragment key={source?.id ?? "none"}>
                      {/* Group header */}
                      <tr className="border-b border-border/30 bg-muted/20">
                        <td colSpan={5} className="px-4 py-2">
                          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            {source ? (
                              <>
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: source.color }}
                                />
                                {source.name}
                                <span className="font-normal opacity-70">— {BUCKET_LABELS[source.bucket] ?? source.bucket}</span>
                              </>
                            ) : (
                              <>
                                <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/40" />
                                Sans source fiscale
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                      {list.map((co) => <CompanyRow key={co.id} co={co} />)}
                    </Fragment>
                  ))
                : companies.map((co) => <CompanyRow key={co.id} co={co} />)
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type CompanyRowProps = {
  co: {
    id: string
    name: string
    email: string | null
    phone: string | null
    siret: string | null
    website: string | null
    address: string | null
    city: string | null
    companyType: string | null
    _count: { contacts: number; projects: number }
  }
}

function CompanyRow({ co }: CompanyRowProps) {
  const isIncomplete = !co.email && !co.phone && !co.siret && !co.website && !co.address
  const typeCfg = co.companyType ? COMPANY_TYPE_CONFIG[co.companyType] : null
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/societes/${co.id}`}
          className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
        >
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          {co.name}
          {typeCfg && (
            <span className={`inline-flex items-center text-[10px] font-medium rounded-full px-1.5 py-0.5 border ${typeCfg.className}`}>
              {typeCfg.label}
            </span>
          )}
          {isIncomplete && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertCircle className="h-2.5 w-2.5" />
              À compléter
            </span>
          )}
        </Link>
        {co.email && (
          <p className="text-xs text-muted-foreground mt-0.5">{co.email}</p>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{co.city ?? "—"}</td>
      <td className="px-4 py-3">
        <CompanyTypeSelect companyId={co.id} value={co.companyType} />
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {co._count.contacts}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1 text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5" />
          {co._count.projects}
        </span>
      </td>
    </tr>
  )
}
