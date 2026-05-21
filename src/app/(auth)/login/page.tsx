import { signIn } from "@/lib/auth"
import { Server, FileText, Users, FolderKanban, CheckSquare, Clock, Calendar, BarChart3 } from "lucide-react"

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

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">

      {/* Halo décoratif */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">

        {/* ── Logo + titre ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-md">
            <Server className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ERP Freelance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Votre espace de travail tout-en-un
            </p>
          </div>
        </div>

        {/* ── Feature chips ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-2">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="group flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-3 py-1.5
                         text-xs font-medium text-muted-foreground cursor-default
                         transition-all duration-200
                         hover:border-border hover:bg-accent hover:text-foreground hover:shadow-sm hover:-translate-y-0.5"
            >
              <Icon className="h-3 w-3 transition-transform duration-200 group-hover:scale-110" />
              {label}
            </div>
          ))}
        </div>

        {/* ── Carte de connexion ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm space-y-4">
          <div className="space-y-0.5 text-center">
            <h2 className="text-base font-semibold">Connexion</h2>
            <p className="text-xs text-muted-foreground">
              Accès sécurisé via votre compte Google
            </p>
          </div>

          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/", redirect: true })
            }}
          >
            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium
                         transition-all duration-200
                         hover:bg-accent hover:border-border/80 hover:shadow-sm
                         active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continuer avec Google
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground/50">
            Accès privé · données jamais partagées
          </p>
        </div>

      </div>
    </div>
  )
}
