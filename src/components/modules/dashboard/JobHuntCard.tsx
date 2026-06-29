"use client"

import Link from "next/link"
import { Briefcase, CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules } from "@/hooks/use-modules"
import { STATUS_CONFIG, fmtShort, type JobAppStatus } from "@/components/modules/entretien/status-config"

export type DashboardJobApp = {
  id: string
  companyName: string
  position: string
  status: string
  nextActionAt: string | null
  nextActionLabel: string | null
}


/**
 * Widget dashboard du module Entretien : candidatures actives, prochains RDV.
 * Masqué si le module est inactif ou s'il n'y a aucune candidature active.
 */
export function JobHuntCard({
  applications,
  activeCount,
}: {
  applications: DashboardJobApp[]   // candidatures actives avec prochain point, triées par date
  activeCount: number
}) {
  const { isActive } = useModules()
  if (!isActive("entretien") || activeCount === 0) return null

  const upcoming = applications
    .filter((a) => a.nextActionAt)
    .sort((a, b) => new Date(a.nextActionAt!).getTime() - new Date(b.nextActionAt!).getTime())
    .slice(0, 4)

  const now = new Date()

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          Entretiens
        </div>
        <Link href="/entretiens" className="text-xs text-primary hover:underline">Voir tout →</Link>
      </div>

      <div className="p-3 space-y-3">
        <Link href="/entretiens" className="flex items-baseline gap-2 px-1 hover:opacity-80 transition-opacity">
          <span className="text-2xl font-bold">{activeCount}</span>
          <span className="text-xs text-muted-foreground">candidature{activeCount > 1 ? "s" : ""} en cours</span>
        </Link>

        {upcoming.length > 0 && (
          <div className="space-y-1 border-t border-border/50 pt-2">
            <p className="px-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Prochains points
            </p>
            {upcoming.map((a) => {
              const overdue = a.nextActionAt && new Date(a.nextActionAt) < now
              const cfg = STATUS_CONFIG[a.status as JobAppStatus] ?? STATUS_CONFIG.WISHLIST
              return (
                <Link
                  key={a.id}
                  href={`/entretiens/${a.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.companyName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.nextActionLabel ?? a.position}</p>
                  </div>
                  <span className={cn("text-[10px] shrink-0", overdue ? "text-red-500 font-medium" : "text-amber-600")}>
                    {fmtShort(a.nextActionAt!)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
