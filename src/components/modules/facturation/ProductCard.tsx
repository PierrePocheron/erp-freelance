"use client"

import { useState, useTransition } from "react"
import { Pencil, Trash2, Check, X, ChevronDown } from "lucide-react"
import { updateProduct, deleteProduct } from "@/actions/facturation"

const unitLabels: Record<string, string> = {
  HOUR: "Heure",
  DAY: "Jour",
  MONTH: "Mois",
  YEAR: "An",
  UNIT: "Unité",
  FLAT: "Forfait",
}

const unitOptions = [
  { value: "UNIT", label: "Unité" },
  { value: "HOUR", label: "Heure" },
  { value: "DAY", label: "Jour" },
  { value: "MONTH", label: "Mois" },
  { value: "YEAR", label: "An" },
  { value: "FLAT", label: "Forfait" },
]

type Product = {
  id: string
  name: string
  description: string | null
  unitPrice: number
  unit: string
  isActive: boolean
}

export function ProductCard({ product, userId }: { product: Product; userId: string }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    unitPrice: String(product.unitPrice),
    unit: product.unit,
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    startTransition(async () => {
      await updateProduct(product.id, userId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        unitPrice: parseFloat(form.unitPrice) || 0,
        unit: form.unit,
      })
      setEditing(false)
    })
  }

  function handleCancel() {
    setForm({
      name: product.name,
      description: product.description ?? "",
      unitPrice: String(product.unitPrice),
      unit: product.unit,
    })
    setEditing(false)
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteProduct(product.id, userId)
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      await updateProduct(product.id, userId, { isActive: !product.isActive })
    })
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 shadow-sm">
        <div className="space-y-2">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nom du produit *"
            autoFocus
            className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring font-medium"
          />
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prix HT (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => set("unitPrice", e.target.value)}
              className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Unité</label>
            <div className="relative">
              <select
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {unitOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !form.name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-xl border border-border/50 bg-card p-4 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{product.name}</p>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{product.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-bold">{product.unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
            <p className="text-xs text-muted-foreground">/ {unitLabels[product.unit] ?? product.unit}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted/50 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`text-xs rounded-full px-2 py-0.5 border transition-colors ${
            product.isActive
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/25"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
          }`}
        >
          {product.isActive ? "Actif" : "Inactif"}
        </button>
      </div>
    </div>
  )
}
