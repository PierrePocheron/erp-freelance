"use client"

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SortDir } from "@/hooks/use-sortable"

type Props = {
  label: string
  col: string
  sortCol: string | null
  sortDir: SortDir
  onSort: (col: string) => void
  className?: string
  align?: "left" | "right"
}

export function Th({ label, col, sortCol, sortDir, onSort, className, align = "left" }: Props) {
  const active = sortCol === col
  const Icon = active
    ? sortDir === "asc" ? ChevronUp : ChevronDown
    : ChevronsUpDown

  return (
    <th className={cn("font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "flex items-center gap-0.5 text-xs transition-colors hover:text-foreground w-full",
          align === "right" && "justify-end",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3 shrink-0", active ? "opacity-80" : "opacity-40")} />
      </button>
    </th>
  )
}
