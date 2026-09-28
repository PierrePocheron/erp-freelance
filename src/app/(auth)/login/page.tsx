import { Server, FileText, Users, FolderKanban, CheckSquare, Clock, Calendar, BarChart3, Wallet, PiggyBank } from "lucide-react"
import { GoogleSignInButton } from "./GoogleSignInButton"

const features = [
  { icon: Users,        label: "CRM" },
  { icon: FolderKanban, label: "Projets" },
  { icon: CheckSquare,  label: "Tâches" },
  { icon: FileText,     label: "Facturation" },
  { icon: Clock,        label: "Time tracking" },
  { icon: Calendar,     label: "Calendrier" },
  { icon: BarChart3,    label: "Dashboard" },
  { icon: Server,       label: "Post-dev" },
]

/**
 * Pastilles décoratives qui flottent de part et d'autre de la carte, sur grand
 * écran seulement (sous `lg`, la carte occupe toute la largeur utile).
 * Positions en % pour rester à distance de la colonne centrale quelle que soit
 * la largeur ; inclinaison et rythme variés pour éviter l'effet « grille ».
 */
const floatingIcons = [
  { icon: Users,        label: "CRM",          pos: "left-[6%]  top-[16%]", size: "h-16 w-16", icon_: "h-7 w-7", accent: true,  tilt: "-8deg",  duration: "7s",   delay: "0s"   },
  { icon: FileText,     label: "Facturation",  pos: "left-[15%] top-[44%]", size: "h-12 w-12", icon_: "h-5 w-5", accent: false, tilt: "6deg",   duration: "8.5s", delay: "0.6s" },
  { icon: Wallet,       label: "Dépenses",     pos: "left-[9%]  top-[71%]", size: "h-14 w-14", icon_: "h-6 w-6", accent: false, tilt: "-5deg",  duration: "6.5s", delay: "1.2s" },
  { icon: Calendar,     label: "Calendrier",   pos: "left-[24%] top-[80%]", size: "h-11 w-11", icon_: "h-5 w-5", accent: false, tilt: "9deg",   duration: "9s",   delay: "0.3s" },
  { icon: Clock,        label: "Temps",        pos: "right-[7%] top-[14%]", size: "h-12 w-12", icon_: "h-5 w-5", accent: false, tilt: "7deg",   duration: "7.5s", delay: "0.9s" },
  { icon: BarChart3,    label: "Dashboard",    pos: "right-[15%] top-[38%]", size: "h-11 w-11", icon_: "h-5 w-5", accent: false, tilt: "-6deg", duration: "6.8s", delay: "0.2s" },
  { icon: FolderKanban, label: "Projets",      pos: "right-[6%] top-[62%]", size: "h-16 w-16", icon_: "h-7 w-7", accent: true,  tilt: "8deg",   duration: "8s",   delay: "1.5s" },
  { icon: PiggyBank,    label: "Investissements", pos: "right-[23%] top-[82%]", size: "h-12 w-12", icon_: "h-5 w-5", accent: false, tilt: "-9deg", duration: "7.2s", delay: "0.5s" },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // NextAuth redirige ici avec ?error=AccessDenied quand le callback `signIn`
  // refuse l'email (liste blanche AUTH_ALLOWED_EMAILS) — sans message, la
  // tentative semblait juste « ne rien faire ».
  const { error } = await searchParams
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background flex items-center justify-center px-4 py-10">

      {/* Halos décoratifs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[90px]" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-primary/5 blur-[80px]" />
      </div>

      {/* Pastilles flottantes (décor) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {floatingIcons.map(({ icon: Icon, label, pos, size, icon_, accent, tilt, duration, delay }) => (
          <div
            key={label}
            className={`login-float absolute ${pos} ${size} flex items-center justify-center rounded-2xl shadow-lg ring-1 ${
              accent
                ? "bg-primary text-primary-foreground ring-primary/20 shadow-primary/20"
                : "bg-card text-primary ring-border/60"
            }`}
            style={{
              ["--tilt" as string]: tilt,
              ["--float-duration" as string]: duration,
              ["--float-delay" as string]: delay,
            }}
          >
            <Icon className={icon_} />
          </div>
        ))}
      </div>

      <div className="relative w-full max-w-sm space-y-7">

        {/* ── Logo + titre ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <Server className="h-7 w-7 text-primary-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ERP Freelance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Votre espace de travail tout-en-un
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-700 dark:text-amber-400"
          >
            {error === "AccessDenied"
              ? "Accès refusé : cette application est privée, réservée à son propriétaire."
              : "La connexion a échoué. Réessayez dans un instant."}
          </div>
        )}

        {/* ── Modules (sous lg, là où les pastilles flottantes n'ont pas la place) ── */}
        <div className="flex flex-wrap justify-center gap-2 lg:hidden">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </div>
          ))}
        </div>

        {/* ── Carte de connexion ────────────────────────────────────────────── */}
        <div className="relative rounded-2xl border border-border/60 bg-card/80 p-7 shadow-xl shadow-black/5 backdrop-blur-sm">
          {/* Filet dégradé en tête de carte */}
          <div
            aria-hidden
            className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          />
          <div className="space-y-1 text-center">
            <h2 className="text-base font-semibold">Connexion</h2>
            <p className="text-xs text-muted-foreground">
              Accès sécurisé via votre compte Google
            </p>
          </div>

          <div className="mt-5">
            <GoogleSignInButton />
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accès privé · réservé au propriétaire du compte
          </p>
        </div>

      </div>
    </main>
  )
}
