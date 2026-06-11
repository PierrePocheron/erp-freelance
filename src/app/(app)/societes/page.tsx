import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Building2, AlertCircle, Users, FolderOpen } from "lucide-react"
import { CreateCompanyDialog } from "@/components/modules/societes/CreateCompanyDialog"

export default async function SocietesPage() {
  const session = await auth()
  const userId = session!.user.id

  const companies = await prisma.company.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, phone: true, siret: true,
      website: true, address: true, city: true,
      _count: { select: { contacts: true, projects: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sociétés</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} société{companies.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateCompanyDialog userId={userId} />
      </div>

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
                <th className="px-4 py-3 text-left font-medium">Contacts</th>
                <th className="px-4 py-3 text-left font-medium">Projets</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((co) => {
                const isIncomplete = !co.email && !co.phone && !co.siret && !co.website && !co.address
                return (
                <tr key={co.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/societes/${co.id}`}
                      className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {co.name}
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
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
