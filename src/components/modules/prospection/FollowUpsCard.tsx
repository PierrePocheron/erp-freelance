"use client"

import { useState } from "react"
import Link from "next/link"
import { BellRing, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type FollowUp = {
  id: string
  name: string
  company: string | null
  interestLevel: number | null
  lastEmail: { date: Date | string; emailTemplateName: string | null } | null
}

function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

/**
 * Rappel « relances à faire » : prospects contactés il y a ≥ N jours, sans
 * réponse, dont le dernier email remonte à plus de N jours. Liste dérivée (aucun
 * champ à maintenir) — pour ne pas oublier de relancer. Clic → fiche du prospect.
 */
export function FollowUpsCard({ items }: { items: FollowUp[] }) {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BellRing className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold">
          {items.length} relance{items.length > 1 ? "s" : ""} à faire
        </span>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          · contactés il y a 7 jours ou plus, sans réponse
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="divide-y divide-border/40 border-t border-amber-500/20 max-h-72 overflow-y-auto">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/contacts/${p.id}`}
              className="flex items-center gap-2 px-4 py-2 hover:bg-amber-500/10 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.company || p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.lastEmail
                    ? `Dernier email il y a ${daysSince(p.lastEmail.date)} j${p.lastEmail.emailTemplateName ? ` · ${p.lastEmail.emailTemplateName}` : ""}`
                    : "Contacté, en attente de retour"}
                </p>
              </div>
              {p.interestLevel != null && (
                <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  intérêt {p.interestLevel}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
