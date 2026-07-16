"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, PlayCircle } from "lucide-react"
import { completeTaskGlobal } from "@/actions/projet"

export type InProgressTask = {
  id: string
  title: string
  href: string
  sub: string | null
  /** Depuis quand la tâche est démarrée (ex. « depuis 2 h », « depuis hier ») */
  since: string | null
}

/**
 * Tâches démarrées (IN_PROGRESS) — le pendant dashboard du clic « je commence »
 * fait côté projet : on voit d'un coup d'œil ce qui est en cours, et la coche
 * verte confirme la fin sans quitter le dashboard.
 */
export function InProgressTasksCard({ tasks }: { tasks: InProgressTask[] }) {
  const router = useRouter()
  const [done, setDone] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const remaining = tasks.filter((t) => !done.has(t.id))
  if (remaining.length === 0) return null

  function complete(task: InProgressTask) {
    setPendingId(task.id)
    startTransition(async () => {
      try {
        await completeTaskGlobal(task.id)
        setDone((prev) => new Set(prev).add(task.id))
        toast.success(`« ${task.title} » terminée ✓`)
        router.refresh()
      } catch {
        toast.error("Impossible de terminer la tâche")
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold">En cours</h2>
          <span className="text-xs text-muted-foreground">({remaining.length})</span>
        </div>
        <Link href="/taches" className="text-xs text-primary hover:underline">Voir tout →</Link>
      </div>
      <div className="p-2 space-y-0.5">
        {remaining.map((t) => (
          <div key={t.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors">
            {/* Coche : confirmer que la tâche est terminée */}
            <button
              type="button"
              onClick={() => complete(t)}
              disabled={pendingId === t.id}
              title="Marquer terminée"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent transition-colors hover:border-emerald-500 hover:bg-emerald-500/15 hover:text-emerald-600 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
            </button>
            {/* Point bleu pulsant = démarrée */}
            <span className="relative flex h-2 w-2 shrink-0" title="Démarrée">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <Link href={t.href} className="flex flex-1 items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{t.title}</p>
                {t.sub && <p className="text-xs text-muted-foreground truncate">{t.sub}</p>}
              </div>
              {t.since && <span className="text-xs text-muted-foreground shrink-0">{t.since}</span>}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
