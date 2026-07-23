import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { AppHeader } from "@/components/layout/AppHeader"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"
import { InstallPwaPrompt } from "@/components/layout/InstallPwaPrompt"
import { TimerBanner } from "@/components/layout/TimerBanner"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { OnboardingGate } from "@/components/modules/onboarding/OnboardingGate"
import { NewModulesGate } from "@/components/modules/onboarding/NewModulesGate"
import { UiTour } from "@/components/modules/onboarding/UiTour"
import { ModuleScope } from "@/components/layout/ModuleScope"
import { NotificationBell } from "@/components/modules/notifications/NotificationBell"
import { ensureSelfClient } from "@/actions/user"
import { getRunningTimer } from "@/actions/timetracking"
import { ensureUrssafReminderTask } from "@/actions/urssaf"
import { prisma } from "@/lib/prisma"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id

  // Ce layout s'exécute à CHAQUE navigation serveur : les gardes idempotentes
  // (client SELF, rappel URSSAF) et les données du shell partent en parallèle —
  // en séquence, chaque aller-retour vers Neon s'additionnait sur toutes les
  // pages. Seul enchaînement conservé : le profil avant la garde URSSAF, qui
  // dépend de sa fréquence de déclaration.
  const [runningTimer, notifications] = await Promise.all([
    getRunningTimer(userId),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    ensureSelfClient(userId),
    prisma.userProfile
      .findUnique({ where: { userId }, select: { urssafFrequency: true } })
      .then((profile) => ensureUrssafReminderTask(userId, profile?.urssafFrequency ?? "QUARTERLY")),
  ])

  async function logout() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Scope par compte des clés modules/onboarding — doit être rendu avant le reste */}
      <ModuleScope userId={userId} />
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <TimerBanner initialTimer={runningTimer} userId={userId} />
        {/* Header fixe (desktop) : titre du module + cloche + déconnexion —
            il ne défile jamais, comme la sidebar */}
        <AppHeader logoutAction={logout}>
          <span data-tour="notifications" className="inline-flex">
            <NotificationBell userId={userId} notifications={notifications} />
          </span>
        </AppHeader>
        {/* id consommé par MobileBottomNav : masquage au scroll des boutons
            flottants (c'est ce conteneur qui scrolle, pas window) */}
        <main id="app-main" className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 sm:pb-6">{children}</main>
        {/* Cloche de notifications flottante — mobile uniquement (le header
            desktop porte la sienne) */}
        <div className="absolute top-3 right-4 z-50 sm:hidden">
          <div className="rounded-lg border border-border/50 bg-background/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <NotificationBell userId={userId} notifications={notifications} />
          </div>
        </div>
      </div>
      <CommandPalette />
      <MobileBottomNav />
      <InstallPwaPrompt />
      <OnboardingGate />
      <NewModulesGate />
      <UiTour />
    </div>
  )
}
