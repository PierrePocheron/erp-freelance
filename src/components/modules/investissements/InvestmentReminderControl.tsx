"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { setInvestmentReviewReminder } from "@/actions/investissements"
import { toast } from "sonner"

/**
 * Toggle « Rappel mensuel de relevé » (+ jour d'échéance). Persiste sur UserProfile
 * via setInvestmentReviewReminder, qui génère aussi la tâche du mois à l'activation.
 */
export function InvestmentReminderControl({ initialEnabled, initialDay }: { initialEnabled: boolean; initialDay: number }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [day, setDay] = useState(initialDay)
  const [isPending, startTransition] = useTransition()

  function save(nextEnabled: boolean, nextDay: number) {
    setEnabled(nextEnabled)
    setDay(nextDay)
    startTransition(async () => {
      await setInvestmentReviewReminder(nextEnabled, nextDay)
      toast.success(nextEnabled ? "Rappel mensuel activé" : "Rappel mensuel désactivé")
      router.refresh()
    })
  }

  return (
    <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Bell className="h-3.5 w-3.5" aria-hidden /> Rappel mensuel de relevé
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? "Désactiver le rappel mensuel de relevé" : "Activer le rappel mensuel de relevé"}
          disabled={isPending}
          onClick={() => save(!enabled, day)}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-60",
            enabled ? "border-primary bg-primary" : "border-muted-foreground/40 bg-muted",
          )}
        >
          <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all", enabled ? "left-4" : "left-0.5")} />
        </button>
      </div>

      {enabled && (
        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Échéance : le
          <select
            value={day}
            disabled={isPending}
            onChange={(e) => save(true, Number(e.target.value))}
            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-center text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          du mois
        </label>
      )}

      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/70">
        Crée chaque mois une tâche «&nbsp;Relevés d&apos;investissement&nbsp;» dans le calendrier, avec une sous-tâche par plateforme — cochée automatiquement quand tu enregistres son relevé.
      </p>
    </div>
  )
}
