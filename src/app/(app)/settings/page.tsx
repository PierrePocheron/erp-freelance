import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsForm } from "@/components/modules/settings/SettingsForm"
import { EmittersManager, type Emitter } from "@/components/modules/settings/EmittersManager"
import { FiscalSourcesManager, type FiscalSourceItem, type EmitterSummary } from "@/components/modules/settings/FiscalSourcesManager"
import { TaxSettingsPanel } from "@/components/modules/settings/TaxSettingsPanel"
import { SettingsShell, type SectionId } from "@/components/modules/settings/SettingsShell"
import { DangerZone } from "@/components/modules/settings/DangerZone"
import { ExportSection } from "@/components/modules/settings/ExportSection"
import { GoogleCalendarSection } from "@/components/modules/settings/GoogleCalendarSection"
import { ModulesPanel } from "@/components/modules/settings/ModulesPanel"
import { ProspectionSettingsPanel } from "@/components/modules/settings/ProspectionSettingsPanel"
import { hasCalendarScope } from "@/lib/google-calendar"
import { LogOut } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [profile, user, emitters, fiscalSources, conditionsTemplates, exportStats, googleCalendarScope, emailTemplates] = await Promise.all([
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null) ?? null,
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.emitterProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, companyName: true, legalForm: true, siret: true,
        vatNumber: true, address: true, postalCode: true, city: true, country: true,
        phone: true, email: true, website: true, bankName: true, iban: true, bic: true,
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
      prisma.client.count({ where: { userId, type: { not: "PROSPECT" } } }),
      prisma.client.count({ where: { userId, type: "PROSPECT" } }),
      prisma.project.count({ where: { userId } }),
      prisma.task.count({ where: { OR: [{ project: { userId } }, { userId }] } }),
      prisma.quote.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.interaction.count({ where: { client: { userId } } }),
      prisma.timeEntry.count({ where: { userId } }),
      prisma.revenue.count({ where: { userId } }),
    ]).then(([contacts, prospects, projects, tasks, quotes, invoices, interactions, timeEntries, revenues]) => ({
      contacts, prospects, projects, tasks, quotes, invoices, interactions, timeEntries, revenues,
    })),
    hasCalendarScope(userId),
    prisma.emailTemplate.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true },
    }),
  ])

  const taxSettings = {
    legalStatus:          profile?.legalStatus ?? "AUTO_ENTREPRENEUR",
    urssafFrequency:      profile?.urssafFrequency ?? ("QUARTERLY" as const),
    versementLiberatoire: profile?.versementLiberatoire ?? true,
    rateBNCCotisations:         profile?.rateBNCCotisations ?? 25.6,
    rateBNCVL:                  profile?.rateBNCVL ?? 2.2,
    rateBNCCFP:                 profile?.rateBNCCFP ?? 0.2,
    rateBICServicesCotisations: profile?.rateBICServicesCotisations ?? 21.2,
    rateBICServicesVL:          profile?.rateBICServicesVL ?? 1.7,
    rateBICServicesCFP:         profile?.rateBICServicesCFP ?? 0.1,
    rateBICSalesCotisations:    profile?.rateBICSalesCotisations ?? 12.3,
    rateBICSalesVL:             profile?.rateBICSalesVL ?? 1.0,
    rateBICSalesCFP:            profile?.rateBICSalesCFP ?? 0.1,
  }

  // Sections rendues côté serveur, distribuées dans le shell client (style Réglages Apple)
  const nodes: Record<SectionId, React.ReactNode> = {
    profil: (
      <SettingsForm
        userId={userId}
        profile={profile}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        conditionsTemplates={conditionsTemplates}
      />
    ),
    emetteurs: <EmittersManager emitters={emitters as Emitter[]} />,
    fiscalite: (
      <>
        <TaxSettingsPanel initial={taxSettings} />
        <FiscalSourcesManager
          sources={fiscalSources as FiscalSourceItem[]}
          emitters={emitters as EmitterSummary[]}
        />
      </>
    ),
    modules: <ModulesPanel />,
    prospection: (
      <ProspectionSettingsPanel
        initial={{ followUpDelayDays: profile?.followUpDelayDays ?? 7, followUpTemplateId: profile?.followUpTemplateId ?? null }}
        templates={emailTemplates}
      />
    ),
    integrations: <GoogleCalendarSection hasScope={googleCalendarScope} syncThresholdMin={profile?.calendarSyncThresholdMin ?? 30} />,
    donnees: (
      <>
        <ExportSection stats={exportStats} />
        <DangerZone userId={userId} />
      </>
    ),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Profil, facturation, fiscalité et préférences de l&apos;application
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

      <SettingsShell nodes={nodes} />
    </div>
  )
}
