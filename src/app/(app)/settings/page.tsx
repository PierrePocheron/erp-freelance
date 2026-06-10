import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsForm } from "@/components/modules/settings/SettingsForm"
import { EmittersManager, type Emitter } from "@/components/modules/settings/EmittersManager"
import { FiscalSourcesManager, type FiscalSourceItem, type EmitterSummary } from "@/components/modules/settings/FiscalSourcesManager"
import { DangerZone } from "@/components/modules/settings/DangerZone"
import { ExportSection } from "@/components/modules/settings/ExportSection"
import { GoogleCalendarSection } from "@/components/modules/settings/GoogleCalendarSection"
import { hasCalendarScope } from "@/lib/google-calendar"
import { LogOut } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [profile, user, emitters, fiscalSources, conditionsTemplates, exportStats, googleCalendarScope] = await Promise.all([
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null) ?? null,
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.emitterProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, companyName: true, legalForm: true, siret: true,
        vatNumber: true, address: true, postalCode: true, city: true, country: true,
        phone: true, email: true, website: true, iban: true, bic: true,
        defaultConditions: true, legalMentions: true, pdfAccentColor: true,
        logoUrl: true, isDefault: true, fiscalSourceId: true,
      },
    }),
    prisma.fiscalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        emitterProfiles: { select: { id: true, name: true, companyName: true } },
        _count: { select: { revenues: true } },
      },
    }),
    prisma.conditionsTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    Promise.all([
      prisma.client.count({ where: { userId } }),
      prisma.project.count({ where: { userId } }),
      prisma.task.count({ where: { OR: [{ project: { userId } }, { userId }] } }),
      prisma.quote.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.interaction.count({ where: { client: { userId } } }),
      prisma.timeEntry.count({ where: { userId } }),
      prisma.revenue.count({ where: { userId } }),
    ]).then(([clients, projects, tasks, quotes, invoices, interactions, timeEntries, revenues]) => ({
      clients, projects, tasks, quotes, invoices, interactions, timeEntries, revenues,
    })),
    hasCalendarScope(userId),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Informations professionnelles utilisées dans vos devis et factures
          </p>
        </div>
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{user?.email ?? "Se déconnecter"}</span>
            <span className="sm:hidden">Déconnexion</span>
          </button>
        </form>
      </div>

      <SettingsForm
        userId={userId}
        profile={profile}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        conditionsTemplates={conditionsTemplates}
      />

      <EmittersManager emitters={emitters as Emitter[]} />

      <FiscalSourcesManager
        sources={fiscalSources as FiscalSourceItem[]}
        emitters={emitters as EmitterSummary[]}
      />

      <GoogleCalendarSection hasScope={googleCalendarScope} />

      <ExportSection stats={exportStats} />

      <DangerZone userId={userId} />
    </div>
  )
}
