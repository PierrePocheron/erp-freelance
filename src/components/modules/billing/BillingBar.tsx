"use client"

import { TrendingUp } from "lucide-react"

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

/**
 * Affiche le montant encaissé / total facturé avec une barre de progression.
 * Utilisé dans la liste des projets et la fiche contact.
 */
export function BillingBar({
  totalFacture,
  totalEncaisse,
  className,
}: {
  totalFacture: number
  totalEncaisse: number
  className?: string
}) {
  if (totalFacture <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const ratio = Math.min(1, totalEncaisse / totalFacture)
  const pct = Math.round(ratio * 100)

  return (
    <div className={`space-y-1 min-w-[120px] ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-xs">
        <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="font-medium">{fmtEur(totalEncaisse)}</span>
        <span className="text-muted-foreground">/ {fmtEur(totalFacture)}</span>
      </div>
      <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
