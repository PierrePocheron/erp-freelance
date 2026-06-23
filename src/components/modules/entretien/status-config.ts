// Config partagée des statuts de candidature (importable côté serveur et client).

export const STATUS_CONFIG = {
  WISHLIST:  { label: "Repéré",       short: "Repéré",     cls: "bg-slate-500/15 text-slate-600 border-slate-500/20 dark:text-slate-400", dot: "bg-slate-400",   color: "#94a3b8" },
  APPLIED:   { label: "Candidaté",    short: "Candidaté",  cls: "bg-blue-500/15 text-blue-600 border-blue-500/20",                        dot: "bg-blue-400",    color: "#3b82f6" },
  SCREENING: { label: "Pré-qualif",   short: "Pré-qualif", cls: "bg-cyan-500/15 text-cyan-600 border-cyan-500/20",                        dot: "bg-cyan-400",    color: "#06b6d4" },
  INTERVIEW: { label: "Entretien",    short: "Entretien",  cls: "bg-purple-500/15 text-purple-600 border-purple-500/20",                  dot: "bg-purple-400",  color: "#a855f7" },
  TECHNICAL: { label: "Test technique", short: "Test",     cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20",                  dot: "bg-indigo-400",  color: "#6366f1" },
  FINAL:     { label: "Entretien final", short: "Final",   cls: "bg-violet-500/15 text-violet-600 border-violet-500/20",                  dot: "bg-violet-400",  color: "#8b5cf6" },
  OFFER:     { label: "Offre reçue",  short: "Offre",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",               dot: "bg-emerald-400", color: "#10b981" },
  ACCEPTED:  { label: "Accepté 🎉",   short: "Accepté",    cls: "bg-green-500/15 text-green-600 border-green-500/20",                     dot: "bg-green-500",   color: "#22c55e" },
  REJECTED:  { label: "Refusé",       short: "Refusé",     cls: "bg-red-500/15 text-red-600 border-red-500/20",                           dot: "bg-red-400",     color: "#ef4444" },
  WITHDRAWN: { label: "Désisté",      short: "Désisté",    cls: "bg-gray-500/15 text-gray-500 border-gray-500/20",                        dot: "bg-gray-400",    color: "#9ca3af" },
  GHOSTED:   { label: "Sans réponse", short: "Ghosté",     cls: "bg-amber-500/15 text-amber-700 border-amber-500/20",                     dot: "bg-amber-400",   color: "#f59e0b" },
} as const

export type JobAppStatus = keyof typeof STATUS_CONFIG

// Étapes actives du pipeline (ordre de progression).
export const PIPELINE_STATUSES: JobAppStatus[] = [
  "WISHLIST", "APPLIED", "SCREENING", "INTERVIEW", "TECHNICAL", "FINAL", "OFFER",
]
// Étapes de résultat (clôture).
export const OUTCOME_STATUSES: JobAppStatus[] = ["ACCEPTED", "REJECTED", "WITHDRAWN", "GHOSTED"]
export const CLOSED_STATUSES: JobAppStatus[] = ["ACCEPTED", "REJECTED", "WITHDRAWN", "GHOSTED"]

export const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  APPLICATION:    { label: "Candidature",    icon: "📨" },
  CALL:           { label: "Appel",          icon: "📞" },
  VIDEO:          { label: "Visio",          icon: "🎥" },
  ONSITE:         { label: "Sur site",       icon: "🏢" },
  EMAIL:          { label: "Email",          icon: "✉️" },
  MESSAGE:        { label: "Message",        icon: "💬" },
  TECHNICAL_TEST: { label: "Test technique", icon: "⌨️" },
  OFFER:          { label: "Offre",          icon: "🎯" },
  OTHER:          { label: "Autre",          icon: "•"  },
}
