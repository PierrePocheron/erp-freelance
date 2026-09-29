import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { AppHeader } from "@/components/layout/AppHeader"
import { BreadcrumbProvider } from "@/components/layout/BreadcrumbContext"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"
import { InstallPwaPrompt } from "@/components/layout/InstallPwaPrompt"
import { TimerBanner } from "@/components/layout/TimerBanner"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { OnboardingGate } from "@/components/modules/onboarding/OnboardingGate"
import { NewModulesGate } from "@/components/modules/onboarding/NewModulesGate"
import { UiTour } from "@/components/modules/onboarding/UiTour"
import { ModuleScope } from "@/components/layout/ModuleScope"
import { NotificationBell } from "@/components/modules/notifications/NotificationBell"
import { AmountsPrivacyToggle } from "@/components/ui/amounts-privacy-toggle"
import { ensureSelfClient } from "@/actions/user"
import { getRunningTimer } from "@/actions/timetracking"
import { ensureUrssafReminderTask } from "@/actions/urssaf"
import { ensureInvestmentReviewTasks } from "@/actions/investissements"
import { prisma } from "@/lib/prisma"
import { readFlash } from "@/lib/flash"
import { FlashToast } from "@/components/layout/FlashToast"

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
      .findUnique({ where: { userId }, select: { urssafFrequency: true, investmentReviewReminder: true, investmentReviewDay: true } })
      .then((profile) => Promise.all([
        ensureUrssafReminderTask(userId, profile?.urssafFrequency ?? "QUARTERLY"),
        ensureInvestmentReviewTasks(userId, profile?.investmentReviewReminder ?? false, profile?.investmentReviewDay ?? 1),
      ])),
  ])
  const flash = await readFlash()

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      {/* Scope par compte des clés modules/onboarding — doit être rendu avant le reste */}
      <ModuleScope userId={userId} />
      {/* Message d'une action serveur (erreur métier en français / confirmation) — lib/flash.ts */}
      <FlashToast flash={flash} />
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden print:overflow-visible">
        <TimerBanner initialTimer={runningTimer} userId={userId} />
        {/* Provider du fil d'Ariane : enveloppe header ET contenu pour que les
            pages de détail (children) publient le nom de leur entité et que le
            header (AppBreadcrumbs) le lise. */}
        <BreadcrumbProvider>
          {/* Header fixe (desktop) : fil d'Ariane + « Masquer les montants » + cloche —
              il ne défile jamais, comme la sidebar. La déconnexion est dans Réglages. */}
          <AppHeader>
            <span data-tour="notifications" className="inline-flex">
              <NotificationBell notifications={notifications} />
            </span>
          </AppHeader>
          {/* id consommé par MobileBottomNav : masquage au scroll des boutons
              flottants (c'est ce conteneur qui scrolle, pas window) */}
          {/* Mobile : le haut du contenu démarre SOUS la pastille flottante (œil + cloche,
              ~34 px, en `absolute` au-dessus de tout). Sans ce retrait, elle recouvrait la
              première ligne de chaque écran — boutons « Nouveau… » de droite, barre de
              recherche de l'accueil, onglets de Facturation. Un seul retrait ici plutôt
              qu'un `pr-20` à reproduire dans chaque en-tête de page. */}
          <main id="app-main" className="flex-1 overflow-y-auto p-3 pt-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem)] sm:p-6 sm:pt-6 pb-24 sm:pb-6 print:overflow-visible print:p-0 print:pb-0">{children}</main>
        </BreadcrumbProvider>
        {/* Cloche de notifications flottante — mobile uniquement (le header
            desktop porte la sienne) */}
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-50 sm:hidden">
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-background/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <AmountsPrivacyToggle />
            <NotificationBell notifications={notifications} />
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
