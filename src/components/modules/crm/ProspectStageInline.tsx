"use client"

import { useState, useTransition } from "react"
import { updateProspectStage } from "@/actions/crm"
import { STAGE_CONFIG, type ProspectStage } from "./ProspectsView"
import { cn } from "@/lib/utils"

const PIPELINE_STAGES: ProspectStage[] = [
  "IDENTIFIED", "CONTACTED", "NO_RESPONSE", "REPLIED",
  "MEETING", "PROPOSAL_SENT", "NEGOTIATION",
]
const OUTCOME_STAGES: ProspectStage[] = ["WON", "LOST", "ON_HOLD"]

export function ProspectStageInline({
  clientId,
  value,
}: {
  clientId: string
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current = STAGE_CONFIG[value as ProspectStage] ?? STAGE_CONFIG.IDENTIFIED

  function pick(next: ProspectStage) {
    if (next === value) { setOpen(false); return }
    startTransition(async () => {
      await updateProspectStage(clientId, next)
      setOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 disabled:opacity-50",
          current.cls
        )}
      >
        {current.label} ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-44">
            <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Pipeline</p>
            {PIPELINE_STAGES.map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2",
                  s === value && "font-semibold"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STAGE_CONFIG[s].dot)} />
                {STAGE_CONFIG[s].label}
              </button>
            ))}
            <p className="px-2 py-1 mt-0.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide border-t border-border/50 pt-1.5">Résultat</p>
            {OUTCOME_STAGES.map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2",
                  s === value && "font-semibold"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STAGE_CONFIG[s].dot)} />
                {STAGE_CONFIG[s].label}
                {s === "WON" && <span className="ml-auto text-[9px] text-muted-foreground">→ Client</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
