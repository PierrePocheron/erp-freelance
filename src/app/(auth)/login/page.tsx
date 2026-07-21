import { Server, FileText, Users, FolderKanban, CheckSquare, Clock, Calendar, BarChart3 } from "lucide-react"
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

          <GoogleSignInButton />

          <p className="text-center text-xs text-muted-foreground/50">
            Accès privé · données jamais partagées
          </p>
        </div>

      </div>
    </div>
  )
}
