import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsForm } from "@/components/modules/settings/SettingsForm"
import { DangerZone } from "@/components/modules/settings/DangerZone"
import { ExportSection } from "@/components/modules/settings/ExportSection"
import { LogOut } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [profile, user, conditionsTemplates, exportStats] = await Promise.all([
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null) ?? null,
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
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
    ]).then(([clients, projects, tasks, quotes, invoices, interactions, timeEntries]) => ({
      clients, projects, tasks, quotes, invoices, interactions, timeEntries,
    })),
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

      <ExportSection stats={exportStats} />

      <DangerZone userId={userId} />
    </div>
  )
}
