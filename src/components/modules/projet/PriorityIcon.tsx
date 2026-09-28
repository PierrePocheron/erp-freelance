import { Flame, Snowflake } from "lucide-react"
import { PRIORITY_CONFIG, type ProjectPriority } from "./ProjectInlineEdit"
import { cn } from "@/lib/utils"

/**
 * Icône de priorité d'un projet : flamme (rouge = urgente, ambre = haute), flocon (basse),
 * rien en priorité normale — lisible d'un coup d'œil dans la liste des projets.
 */
export function PriorityIcon({ priority, className }: { priority: ProjectPriority; className?: string }) {
  const label = `Priorité ${PRIORITY_CONFIG[priority].label.toLowerCase()}`
  if (priority === "URGENT") return <Flame className={cn("h-4 w-4 text-red-500 fill-red-500/30", className)} aria-label={label} role="img" />
  if (priority === "HIGH")   return <Flame className={cn("h-4 w-4 text-amber-500", className)} aria-label={label} role="img" />
  if (priority === "LOW")    return <Snowflake className={cn("h-4 w-4 text-sky-500", className)} aria-label={label} role="img" />
  return null
}

/** Badge compact icône + libellé (masqué en priorité normale, sauf `showMedium`). */
export function PriorityBadge({ priority, showMedium = false, className }: { priority: ProjectPriority; showMedium?: boolean; className?: string }) {
  if (priority === "MEDIUM" && !showMedium) return null
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", cfg.cls, className)}>
      <PriorityIcon priority={priority} className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  )
}
