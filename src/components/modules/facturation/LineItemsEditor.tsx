"use client"

import { useState, useTransition } from "react"
import { Trash2, Plus, Pencil, Check, X, ChevronDown } from "lucide-react"
import { addQuoteLine, updateQuoteLine, deleteQuoteLine } from "@/actions/facturation"
import { addInvoiceLine, updateInvoiceLine, deleteInvoiceLine } from "@/actions/facturation"

const TAX_RATES = [
  { value: 0, label: "0%" },
  { value: 2.1, label: "2,1%" },
  { value: 5.5, label: "5,5%" },
  { value: 8.5, label: "8,5%" },
  { value: 10, label: "10%" },
  { value: 20, label: "20%" },
]

type Line = {
  id: string
  description: string
  detail?: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
}

type Props = {
  entityId: string
  entityType: "quote" | "invoice"
  lines: Line[]
  editable?: boolean
}

type LineFormData = {
  description: string
  detail: string
  quantity: string
  unitPrice: string
  taxRate: string
}

const emptyForm: LineFormData = {
  description: "",
  detail: "",
  quantity: "1",
  unitPrice: "0",
  taxRate: "0",
}

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtTaxLabel(rate: number) {
  return rate === 0 ? "0%" : `${String(rate).replace(".", ",")}%`
}

function computeTotals(lines: Line[]) {
  const totalHT = lines.reduce((s, l) => s + l.total, 0)
  const byRate: Record<number, number> = {}
  for (const l of lines) {
    byRate[l.taxRate] = (byRate[l.taxRate] ?? 0) + l.total * (l.taxRate / 100)
  }
  const totalTVA = Object.values(byRate).reduce((s, v) => s + v, 0)
  const totalTTC = totalHT + totalTVA
  return { totalHT, byRate, totalTVA, totalTTC }
}

function LineForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial: LineFormData
  onSubmit: (data: LineFormData) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState(initial)
  const subtotal = (parseFloat(form.quantity) || 0) * (parseFloat(form.unitPrice) || 0)

  function set(k: keyof LineFormData, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="border-b border-border/50 bg-muted/20 p-3 space-y-2.5">
      <div className="space-y-1.5">
        <input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          required
          placeholder="Titre de la prestation *"
          className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={form.detail}
          onChange={(e) => set("detail", e.target.value)}
          placeholder="Description détaillée (optionnel)"
          rows={2}
          className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground shrink-0">Qté</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            required
            className="w-20 text-sm bg-background border border-input rounded-md px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground shrink-0">Prix HT</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => set("unitPrice", e.target.value)}
            required
            className="w-28 text-sm bg-background border border-input rounded-md px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">€</span>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground shrink-0">TVA</label>
          <div className="relative">
            <select
              value={form.taxRate}
              onChange={(e) => set("taxRate", e.target.value)}
              className="appearance-none h-8 pr-7 pl-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TAX_RATES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div className="ml-auto text-sm font-medium text-right">
          <span className="text-muted-foreground text-xs mr-1">Sous-total HT</span>
          {fmtEur(subtotal)}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </button>
        <button
          type="submit"
          disabled={isPending || !form.description.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Valider
        </button>
      </div>
    </form>
  )
}

export function LineItemsEditor({ entityId, entityType, lines, editable = true }: Props) {
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const addLine = entityType === "quote" ? addQuoteLine : addInvoiceLine
  const updateLine = entityType === "quote" ? updateQuoteLine : updateInvoiceLine
  const deleteLine = entityType === "quote" ? deleteQuoteLine : deleteInvoiceLine

  const { totalHT, byRate, totalTVA, totalTTC } = computeTotals(lines)
  const allZeroTax = totalTVA === 0

  function handleAdd(data: LineFormData) {
    startTransition(async () => {
      await addLine(entityId, "system", {
        description: data.description,
        detail: data.detail || undefined,
        quantity: parseFloat(data.quantity),
        unitPrice: parseFloat(data.unitPrice),
        taxRate: parseFloat(data.taxRate),
      })
      setShowAdd(false)
    })
  }

  function handleUpdate(lineId: string, data: LineFormData) {
    startTransition(async () => {
      await updateLine(lineId, {
        description: data.description,
        detail: data.detail || undefined,
        quantity: parseFloat(data.quantity),
        unitPrice: parseFloat(data.unitPrice),
        taxRate: parseFloat(data.taxRate),
      })
      setEditingId(null)
    })
  }

  return (
    <div>
      {/* En-tête */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30 border-b border-border">
        <div className="col-span-6">Prestation</div>
        <div className="col-span-1 text-right">Qté</div>
        <div className="col-span-2 text-right">Prix unitaire</div>
        <div className="col-span-1 text-center">TVA</div>
        <div className="col-span-2 text-right">Total HT</div>
      </div>

      {/* Lignes */}
      {lines.map((line) =>
        editingId === line.id ? (
          <LineForm
            key={line.id}
            initial={{
              description: line.description,
              detail: line.detail ?? "",
              quantity: String(line.quantity),
              unitPrice: String(line.unitPrice),
              taxRate: String(line.taxRate),
            }}
            onSubmit={(data) => handleUpdate(line.id, data)}
            onCancel={() => setEditingId(null)}
            isPending={isPending}
          />
        ) : (
          <div
            key={line.id}
            className="group grid grid-cols-12 gap-2 px-4 py-3 items-start border-b border-border/50 hover:bg-muted/10 transition-colors text-sm"
          >
            <div className="col-span-6">
              <p className="font-medium leading-tight">{line.description}</p>
              {line.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{line.detail}</p>
              )}
            </div>
            <div className="col-span-1 text-right text-muted-foreground">{line.quantity}</div>
            <div className="col-span-2 text-right text-muted-foreground">{fmtEur(line.unitPrice)}</div>
            <div className="col-span-1 text-center">
              <span className="text-xs rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground">
                {fmtTaxLabel(line.taxRate)}
              </span>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <span className="font-semibold">{fmtEur(line.total)}</span>
              {editable && (
                <>
                  <button
                    onClick={() => setEditingId(line.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => startTransition(() => deleteLine(line.id))}
                    disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      )}

      {/* Formulaire d'ajout */}
      {editable && (
        showAdd ? (
          <LineForm
            initial={emptyForm}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            isPending={isPending}
          />
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une prestation
          </button>
        )
      )}

      {/* Totaux */}
      <div className="flex justify-end px-4 py-4 border-t border-border bg-muted/10">
        <div className="space-y-1.5 min-w-56">
          <div className="flex items-center justify-between gap-8 text-sm">
            <span className="text-muted-foreground">Total HT</span>
            <span className="font-medium">{fmtEur(totalHT)}</span>
          </div>

          {allZeroTax ? (
            <p className="text-xs text-muted-foreground text-right">TVA non applicable — art. 293B du CGI</p>
          ) : (
            <>
              {Object.entries(byRate)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rate, amount]) => (
                  <div key={rate} className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">TVA {fmtTaxLabel(Number(rate))}</span>
                    <span className="text-muted-foreground">{fmtEur(amount)}</span>
                  </div>
                ))}
              <div className="border-t border-border pt-1.5 flex items-center justify-between gap-8 text-sm">
                <span className="font-bold">Total TTC</span>
                <span className="font-bold text-base">{fmtEur(totalTTC)}</span>
              </div>
            </>
          )}

          {allZeroTax && (
            <div className="flex items-center justify-between gap-8 text-sm border-t border-border pt-1.5">
              <span className="font-bold">Total</span>
              <span className="font-bold text-base">{fmtEur(totalHT)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
