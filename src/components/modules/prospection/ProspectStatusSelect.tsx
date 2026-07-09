"use client"

import { useState, useTransition } from "react"
import { updateProspectStatus } from "@/actions/prospection"
import { STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES } from "./status-config"
import type { ProspectStatus } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"

/** Badge statut cliquable → dropdown de changement rapide (édition inline). */
export function ProspectStatusSelect({
  clientId,
  value,
}: {
  clientId: string
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current = STATUS_CONFIG[value as ProspectStatus] ?? STATUS_CONFIG.TO_CONTACT

  function pick(next: ProspectStatus) {
    if (next === value) { setOpen(false); return }
    startTransition(async () => {
      await updateProspectStatus(clientId, next)
      setOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        disabled={isPending}
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 disabled:opacity-50 whitespace-nowrap",
          current.cls
        )}
      >
        {current.label} ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-44" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Pipeline</p>
            {PIPELINE_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2",
                  s === value && "font-semibold"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                {STATUS_CONFIG[s].label}
              </button>
            ))}
            <p className="px-2 py-1 mt-0.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide border-t border-border/50 pt-1.5">Résultat</p>
            {OUTCOME_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2",
                  s === value && "font-semibold"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                {STATUS_CONFIG[s].label}
                {s === "WON" && <span className="ml-auto text-[9px] text-muted-foreground">→ Client</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
