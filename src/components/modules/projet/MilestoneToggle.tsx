"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { updateMilestoneStatus } from "@/actions/projet"

/**
 * Bouton d'avancement d'un jalon (À venir → En cours → Terminé → À venir),
 * avec spinner pendant la mutation — remplace les <form action> inline muets.
 */
export function MilestoneToggle({
  milestoneId,
  projectId,
  status,
}: {
  milestoneId: string
  projectId: string
  status: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = status === "UPCOMING" ? "IN_PROGRESS" : status === "IN_PROGRESS" ? "DONE" : "UPCOMING"
    startTransition(async () => {
      await updateMilestoneStatus(milestoneId, projectId, next)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={status === "DONE" ? "Rouvrir" : status === "IN_PROGRESS" ? "Marquer terminé" : "Démarrer"}
      className="shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-70"
    >
      {isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        : status === "DONE"
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          : <Circle className="h-3.5 w-3.5" />}
    </button>
  )
}
