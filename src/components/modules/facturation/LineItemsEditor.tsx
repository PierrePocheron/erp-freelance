"use client"

import { useState, useTransition } from "react"
import { Trash2, Plus, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addQuoteLine, updateQuoteLine, deleteQuoteLine } from "@/actions/facturation"
import { addInvoiceLine, updateInvoiceLine, deleteInvoiceLine } from "@/actions/facturation"

type Line = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

type Props = {
  entityId: string
  entityType: "quote" | "invoice"
  lines: Line[]
  editable?: boolean
}

export function LineItemsEditor({ entityId, entityType, lines, editable = true }: Props) {
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const addLine = entityType === "quote" ? addQuoteLine : addInvoiceLine
  const updateLine = entityType === "quote" ? updateQuoteLine : updateInvoiceLine
  const deleteLine = entityType === "quote" ? deleteQuoteLine : deleteInvoiceLine

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await addLine(entityId, "system", {
        description: fd.get("description") as string,
        quantity: Number(fd.get("quantity")),
        unitPrice: Number(fd.get("unitPrice")),
      })
      setShowAdd(false)
        ; (e.target as HTMLFormElement).reset()
    })
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>, lineId: string) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateLine(lineId, {
        description: fd.get("description") as string,
        quantity: Number(fd.get("quantity")),
        unitPrice: Number(fd.get("unitPrice")),
      })
      setEditingId(null)
    })
  }

  const total = lines.reduce((s, l) => s + l.total, 0)

  return (
    <div className="space-y-0">
      {/* En-tête */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
        <div className="col-span-6">Description</div>
        <div className="col-span-2 text-right">Qté</div>
        <div className="col-span-2 text-right">Prix unit.</div>
        <div className="col-span-2 text-right">Total HT</div>
      </div>

      {/* Lignes */}
      {lines.map((line) =>
        editingId === line.id ? (
          <form key={line.id} onSubmit={(e) => handleUpdate(e, line.id)} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-border/50 bg-muted/30">
            <div className="col-span-6">
              <input name="description" defaultValue={line.description} required className="w-full text-sm bg-background border border-input rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <input name="quantity" type="number" min="0.01" step="0.01" defaultValue={line.quantity} required className="w-full text-sm bg-background border border-input rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <input name="unitPrice" type="number" min="0" step="0.01" defaultValue={line.unitPrice} required className="w-full text-sm bg-background border border-input rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1">
              <button type="submit" disabled={isPending} className="text-emerald-500 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          </form>
        ) : (
          <div key={line.id} className="group grid grid-cols-12 gap-2 px-3 py-2.5 items-center border-b border-border/50 hover:bg-muted/20 transition-colors text-sm">
            <div className="col-span-6">{line.description}</div>
            <div className="col-span-2 text-right text-muted-foreground">{line.quantity}</div>
            <div className="col-span-2 text-right text-muted-foreground">{line.unitPrice.toLocaleString("fr-FR")} €</div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <span className="font-medium">{line.total.toLocaleString("fr-FR")} €</span>
              {editable && (
                <>
                  <button onClick={() => setEditingId(line.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => startTransition(() => deleteLine(line.id))}
                    disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      )}

      {/* Ajouter une ligne */}
      {editable && (
        showAdd ? (
          <form onSubmit={handleAdd} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-border/50 bg-muted/20">
            <div className="col-span-6">
              <input name="description" required placeholder="Description de la prestation" className="w-full text-sm bg-background border border-input rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required className="w-full text-sm bg-background border border-input rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" required placeholder="0.00" className="w-full text-sm bg-background border border-input rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1">
              <button type="submit" disabled={isPending} className="text-emerald-500 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une ligne
          </button>
        )
      )}

      {/* Total */}
      <div className="flex justify-end px-3 py-3 border-t border-border">
        <div className="space-y-1 text-right">
          <div className="flex items-center gap-8 text-sm">
            <span className="text-muted-foreground">Total HT</span>
            <span className="font-bold text-base">{total.toLocaleString("fr-FR")} €</span>
          </div>
          <p className="text-xs text-muted-foreground">TVA non applicable — art. 293B du CGI</p>
        </div>
      </div>
    </div>
  )
}
