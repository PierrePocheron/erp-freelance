"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Hourglass, Check, Receipt, Wallet, HeartPulse } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules } from "@/hooks/use-modules"
import { updateInvoiceStatus } from "@/actions/facturation"
import { markRevenueReceived } from "@/actions/revenue"
import { markReimbursementReceived } from "@/actions/sante"
import { toast } from "sonner"

export type PendingInvoice = { id: string; number: string; clientName: string; amount: number; dueDate: string | null; isLate: boolean }
export type PendingRevenue = { id: string; label: string; amount: number; expectedAt: string | null }
export type PendingReimbursement = { id: string; label: string; amount: number; source: string; expectedDate: string | null }

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null

type Kind = "invoice" | "revenue" | "health"

const KIND_CONFIG: Record<Kind, { label: string; badgeCls: string; icon: React.ReactNode }> = {
  invoice: { label: "Facture", badgeCls: "bg-blue-500/15 text-blue-600 border-blue-500/25",  icon: <Receipt className="h-3 w-3" /> },
  revenue: { label: "Revenu",  badgeCls: "bg-teal-500/15 text-teal-600 border-teal-500/25",  icon: <Wallet className="h-3 w-3" /> },
  health:  { label: "Santé",   badgeCls: "bg-rose-500/15 text-rose-600 border-rose-500/25",  icon: <HeartPulse className="h-3 w-3" /> },
}

type Item = {
  kind: Kind
  id: string
  title: string
  subtitle?: string
  amount: number
  date: string | null // ISO — échéance ou date attendue
  isLate?: boolean
  href: string
}

/**
 * Récapitulatif unifié des montants en attente de réception : factures
 * impayées, revenus en attente, remboursements santé — mélangés dans une
 * seule liste triée par échéance, chaque ligne portant un badge de nature
 * et une coche pour marquer la réception directement depuis le dashboard.
 */
export function PendingIncomeCard({
  invoices,
  revenues,
  reimbursements,
}: {
  invoices: PendingInvoice[]
  revenues: PendingRevenue[]
  reimbursements: PendingReimbursement[]
}) {
  const router = useRouter()
  const { isActive } = useModules()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const items: Item[] = [
    ...(isActive("facturation") ? invoices.map((i): Item => ({
      kind: "invoice", id: i.id, title: i.clientName, subtitle: i.number,
      amount: i.amount, date: i.dueDate, isLate: i.isLate,
      href: `/facturation/factures/${i.id}`,
    })) : []),
    ...(isActive("revenus") ? revenues.map((r): Item => ({
      kind: "revenue", id: r.id, title: r.label,
      amount: r.amount, date: r.expectedAt, href: "/revenus",
    })) : []),
    ...(isActive("sante") ? reimbursements.map((r): Item => ({
      kind: "health", id: r.id, title: r.label, subtitle: r.source === "SECU" ? "Sécu" : "Mutuelle",
      amount: r.amount, date: r.expectedDate, href: "/sante",
    })) : []),
  ].sort((a, b) => {
    // Échéances les plus proches d'abord, sans date en dernier
    if (a.date === null && b.date === null) return 0
    if (a.date === null) return 1
    if (b.date === null) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Rien à afficher → on n'encombre pas le dashboard.
  if (items.length === 0) return null

  const grandTotal = items.reduce((s, i) => s + i.amount, 0)

  function markReceived(item: Item) {
    setPendingId(item.id)
    startTransition(async () => {
      try {
        if (item.kind === "invoice") await updateInvoiceStatus(item.id, "", "PAID")
        else if (item.kind === "revenue") await markRevenueReceived(item.id, new Date(), "VIREMENT")
        else await markReimbursementReceived(item.id)
        toast.success(`${KIND_CONFIG[item.kind].label} « ${item.title} » marqué${item.kind === "invoice" ? "e" : ""} reçu${item.kind === "invoice" ? "e" : ""} — ${eur(item.amount)}`)
        router.refresh()
      } catch {
        toast.error("Impossible de marquer la réception")
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">En attente de réception</h2>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <p className="text-lg font-bold tabular-nums text-amber-600">{eur(grandTotal)}</p>
      </div>

      <div className="p-2 space-y-0.5">
        {items.map((item) => {
          const cfg = KIND_CONFIG[item.kind]
          const isMarking = pendingId === item.id
          return (
            <div
              key={`${item.kind}-${item.id}`}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
            >
              {/* Coche de réception directe */}
              <button
                type="button"
                onClick={() => markReceived(item)}
                disabled={isMarking}
                title="Marquer comme reçu"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isMarking
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border text-transparent hover:border-emerald-500 hover:bg-emerald-500/15 hover:text-emerald-600"
                )}
              >
                <Check className="h-3 w-3" />
              </button>

              {/* Badge de nature */}
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0",
                cfg.badgeCls
              )}>
                {cfg.icon}
                {cfg.label}
              </span>

              <Link href={item.href} className="flex flex-1 items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-semibold tabular-nums", item.isLate && "text-red-500")}>{eur(item.amount)}</p>
                  {item.date && (
                    <p className={cn("text-xs", item.isLate ? "text-red-500" : "text-muted-foreground")}>
                      {item.isLate ? "en retard · " : "prévu "}{fmtDate(item.date)}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
