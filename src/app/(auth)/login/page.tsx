import { signIn } from "@/lib/auth"
import {
  Server, FileText, Users, FolderKanban,
  CheckSquare, Clock, Calendar, ArrowRight,
} from "lucide-react"

const features = [
  { icon: Users, label: "CRM & Clients" },
  { icon: FolderKanban, label: "Projets & Kanban" },
  { icon: CheckSquare, label: "Tâches & Sous-tâches" },
  { icon: FileText, label: "Devis & Factures" },
  { icon: Clock, label: "Time Tracking" },
  { icon: Calendar, label: "Calendrier unifié" },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche — branding ───────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 bg-[#0f0f0f] overflow-hidden">

        {/* Grille décorative */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Halo violet */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <Server className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">ERP Freelance</span>
        </div>

        {/* Contenu central */}
        <div className="relative space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Votre espace de travail freelance
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Gérez votre activité<br />
              <span className="text-indigo-400">de A à Z</span>
            </h1>
            <p className="text-base text-neutral-400 leading-relaxed max-w-sm">
              CRM, projets, facturation, time tracking — tout centralisé dans un seul outil taillé pour les freelances.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20">
                  <Icon className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <span className="text-sm text-neutral-300 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer gauche */}
        <div className="relative text-xs text-neutral-600">
          Usage privé · v0.8.0
        </div>
      </div>

      {/* ── Panneau droit — connexion ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">

        {/* Logo mobile uniquement */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <Server className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-semibold text-lg">ERP Freelance</span>
        </div>

        <div className="w-full max-w-sm space-y-8">

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Bienvenue</h2>
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour accéder à votre espace
            </p>
          </div>

          {/* Google button */}
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/", redirect: true })
            }}
          >
            <button
              type="submit"
              className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium shadow-sm transition-all hover:bg-accent hover:border-border/80 hover:shadow-md active:scale-[0.99]"
            >
              {/* Google logo */}
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Continuer avec Google</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          {/* Note de confidentialité */}
          <p className="text-center text-xs text-muted-foreground/70 leading-relaxed">
            Accès réservé. Vos données restent privées<br />et ne sont jamais partagées.
          </p>
        </div>
      </div>

    </div>
  )
}
