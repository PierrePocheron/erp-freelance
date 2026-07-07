"use client"

import { useState } from "react"
import Link from "next/link"
import { Hourglass, ChevronDown, Receipt, Wallet, HeartPulse } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules } from "@/hooks/use-modules"

export type PendingInvoice = { id: string; number: string; clientName: string; amount: number; dueDate: string | null; isLate: boolean }
export type PendingRevenue = { id: string; label: string; amount: number; expectedAt: string | null }
export type PendingReimbursement = { id: string; label: string; amount: number; source: string; expectedDate: string | null }

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null

/**
 * Récapitulatif unifié des montants en attente de réception, différenciés par
 * nature : factures impayées, revenus en attente, remboursements santé attendus.
 * Chaque section est masquée si son module est désactivé.
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
  const { isActive } = useModules()
  const [expanded, setExpanded] = useState<"invoices" | "revenues" | "health" | null>(null)

  const showInvoices = isActive("facturation") && invoices.length > 0
  const showRevenues = isActive("revenus") && revenues.length > 0
  const showHealth   = isActive("sante") && reimbursements.length > 0

  const invoiceTotal = invoices.reduce((s, i) => s + i.amount, 0)
  const revenueTotal = revenues.reduce((s, r) => s + r.amount, 0)
  const healthTotal  = reimbursements.reduce((s, r) => s + r.amount, 0)

  const grandTotal =
    (showInvoices ? invoiceTotal : 0) +
    (showRevenues ? revenueTotal : 0) +
    (showHealth   ? healthTotal  : 0)

  // Rien à afficher → on n'encombre pas le dashboard.
  if (!showInvoices && !showRevenues && !showHealth) return null

  function toggle(k: "invoices" | "revenues" | "health") {
    setExpanded((cur) => (cur === k ? null : k))
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">En attente de réception</h2>
        </div>
        <p className="text-lg font-bold tabular-nums text-amber-600">{eur(grandTotal)}</p>
      </div>

      <div className="divide-y divide-border/50">
        {/* Factures */}
        {showInvoices && (
          <Section
            icon={<Receipt className="h-3.5 w-3.5 text-blue-500" />}
            label="Factures impayées"
            count={invoices.length}
            total={invoiceTotal}
            open={expanded === "invoices"}
            onToggle={() => toggle("invoices")}
          >
            {invoices.map((inv) => (
              <Row
                key={inv.id}
                href={`/facturation/factures/${inv.id}`}
                primary={inv.clientName}
                secondary={inv.number}
                amount={inv.amount}
                date={fmtDate(inv.dueDate)}
                danger={inv.isLate}
                dateSuffix={inv.isLate ? "en retard" : undefined}
              />
            ))}
          </Section>
        )}

        {/* Revenus */}
        {showRevenues && (
          <Section
            icon={<Wallet className="h-3.5 w-3.5 text-teal-500" />}
            label="Revenus en attente"
            count={revenues.length}
            total={revenueTotal}
            open={expanded === "revenues"}
            onToggle={() => toggle("revenues")}
          >
            {revenues.map((r) => (
              <Row
                key={r.id}
                href="/revenus"
                primary={r.label}
                amount={r.amount}
                date={fmtDate(r.expectedAt)}
                datePrefix="prévu"
              />
            ))}
          </Section>
        )}

        {/* Santé */}
        {showHealth && (
          <Section
            icon={<HeartPulse className="h-3.5 w-3.5 text-rose-500" />}
            label="Remboursements santé"
            count={reimbursements.length}
            total={healthTotal}
            open={expanded === "health"}
            onToggle={() => toggle("health")}
          >
            {reimbursements.map((r) => (
              <Row
                key={r.id}
                href="/sante"
                primary={r.label}
                secondary={r.source === "SECU" ? "Sécu" : "Mutuelle"}
                amount={r.amount}
                date={fmtDate(r.expectedDate)}
                datePrefix="prévu"
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({
  icon, label, count, total, open, onToggle, children,
}: {
  icon: React.ReactNode; label: string; count: number; total: number
  open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div>
      <button onClick={onToggle} className="flex items-center gap-2 w-full px-5 py-2.5 hover:bg-muted/40 transition-colors">
        {icon}
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">{eur(total)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-2 pb-2 space-y-0.5">{children}</div>}
    </div>
  )
}

function Row({
  href, primary, secondary, amount, date, danger, datePrefix, dateSuffix,
}: {
  href: string; primary: string; secondary?: string; amount: number
  date: string | null; danger?: boolean; datePrefix?: string; dateSuffix?: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-semibold tabular-nums", danger && "text-red-500")}>{eur(amount)}</p>
        {date && (
          <p className={cn("text-xs", danger ? "text-red-500" : "text-muted-foreground")}>
            {datePrefix ? `${datePrefix} ` : ""}{date}{dateSuffix ? ` · ${dateSuffix}` : ""}
          </p>
        )}
      </div>
    </Link>
  )
}
