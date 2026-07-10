"use client"

import { TrendingUp, Wallet } from "lucide-react"

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

/**
 * Affiche le montant encaissé / total facturé avec une barre de progression,
 * et optionnellement la même chose pour les revenus hors facturation
 * (études, remboursements... liés au projet) — pour voir d'un coup d'œil
 * si de l'argent manque, quel que soit le canal.
 */
export function BillingBar({
  totalFacture,
  totalEncaisse,
  totalRevenu = 0,
  revenuRecu = 0,
  className,
}: {
  totalFacture: number
  totalEncaisse: number
  totalRevenu?: number
  revenuRecu?: number
  className?: string
}) {
  const hasBilling = totalFacture > 0
  const hasRevenue = totalRevenu > 0

  if (!hasBilling && !hasRevenue) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className={`space-y-1.5 min-w-[120px] ${className ?? ""}`}>
      {hasBilling && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-medium">{fmtEur(totalEncaisse)}</span>
            <span className="text-muted-foreground">/ {fmtEur(totalFacture)}</span>
          </div>
          <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(Math.min(1, totalEncaisse / totalFacture) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {hasRevenue && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <Wallet className="h-3 w-3 text-teal-500 shrink-0" />
            <span className="font-medium">{fmtEur(revenuRecu)}</span>
            <span className="text-muted-foreground">/ {fmtEur(totalRevenu)}</span>
          </div>
          <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-500 transition-all"
              style={{ width: `${Math.round(Math.min(1, revenuRecu / totalRevenu) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
