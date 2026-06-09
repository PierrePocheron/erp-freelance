import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, Building2, Mail, Phone, Globe, MapPin,
  Users, FolderOpen, Trash2, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteCompany } from "@/actions/crm"
import { NewContactForCompanyButton } from "@/components/modules/societes/NewContactForCompanyButton"

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const company = await prisma.company.findFirst({
    where: { id, userId },
    include: {
      contacts: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, phone: true, type: true },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true },
      },
      _count: { select: { contacts: true, projects: true } },
    },
  })

  if (!company) notFound()

  const statusLabel: Record<string, string> = {
    ACTIVE: "En cours",
    COMPLETED: "Terminé",
    ON_HOLD: "En pause",
    CANCELLED: "Annulé",
    DRAFT: "Brouillon",
  }

  const statusColor: Record<string, string> = {
    ACTIVE: "text-emerald-600 bg-emerald-500/10",
    COMPLETED: "text-blue-600 bg-blue-500/10",
    ON_HOLD: "text-amber-600 bg-amber-500/10",
    CANCELLED: "text-red-600 bg-red-500/10",
    DRAFT: "text-muted-foreground bg-muted",
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/societes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Sociétés
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
              {company.city && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {company.city}
                  {company.country && company.country !== "France" ? `, ${company.country}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">

          {/* Fiche société */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="font-semibold text-sm">Informations</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {company.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${company.email}`} className="hover:text-primary transition-colors truncate">
                    {company.email}
                  </a>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${company.phone}`} className="hover:text-primary transition-colors">
                    {company.phone}
                  </a>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 truncate"
                  >
                    {company.website}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {(company.address || company.postalCode || company.city) && (
                <div className="flex items-start gap-2 text-sm sm:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-muted-foreground">
                    {company.address && <p>{company.address}</p>}
                    <p>
                      {[company.postalCode, company.city].filter(Boolean).join(" ")}
                      {company.country && company.country !== "France" ? `, ${company.country}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Identifiants légaux */}
            {(company.siret || company.vatNumber) && (
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                {company.siret && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">SIRET</span>
                    <span className="font-mono text-xs">{company.siret}</span>
                  </div>
                )}
                {company.vatNumber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">N° TVA</span>
                    <span className="font-mono text-xs">{company.vatNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {company.notes && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}

            {/* Empty state */}
            {!company.email && !company.phone && !company.website && !company.address
              && !company.siret && !company.vatNumber && !company.notes && (
              <p className="text-sm text-muted-foreground italic">Aucune information renseignée</p>
            )}
          </div>

          {/* Contacts */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">
                  Contacts
                  <span className="text-muted-foreground font-normal ml-1.5">({company._count.contacts})</span>
                </h2>
              </div>
              <NewContactForCompanyButton
                userId={userId}
                company={{ id: company.id, name: company.name }}
              />
            </div>

            {company.contacts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun contact associé</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ajoutez des contacts depuis la liste Clients
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {company.contacts.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/client/${c.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {c.name}
                        </Link>
                        {c.email && (
                          <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-right">
                        {c.phone ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Projets */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">
                  Projets
                  <span className="text-muted-foreground font-normal ml-1.5">({company._count.projects})</span>
                </h2>
              </div>
              <Link
                href={`/projets?companyId=${company.id}`}
                className="text-xs text-primary hover:underline"
              >
                Voir tous
              </Link>
            </div>

            {company.projects.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun projet associé</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {company.projects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <Link
                      href={`/projets/${p.id}`}
                      className="text-sm font-medium hover:text-primary transition-colors"
                    >
                      {p.name}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status] ?? "text-muted-foreground bg-muted"}`}>
                      {statusLabel[p.status] ?? p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">Statistiques</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Contacts
                </span>
                <span className="font-medium">{company._count.contacts}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" /> Projets
                </span>
                <span className="font-medium">{company._count.projects}</span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3">
            <h2 className="font-semibold text-sm text-destructive">Zone dangereuse</h2>
            <p className="text-xs text-muted-foreground">
              La suppression détache les contacts et les projets mais ne les supprime pas.
            </p>
            <form
              action={async () => {
                "use server"
                await deleteCompany(id)
                redirect("/societes")
              }}
            >
              <Button type="submit" variant="destructive" size="sm" className="w-full gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer cette société
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
