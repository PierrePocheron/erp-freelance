"use client"

import { useState, useTransition } from "react"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addRenewal } from "@/actions/postdev"

const renewalTypes = [
  { value: "DOMAIN", label: "Domaine" },
  { value: "HOSTING", label: "Hébergement" },
  { value: "OTHER", label: "Autre" },
]

const periods = [
  { value: 1, label: "1 mois" },
  { value: 3, label: "3 mois" },
  { value: 6, label: "6 mois" },
  { value: 12, label: "1 an" },
  { value: 24, label: "2 ans" },
  { value: 36, label: "3 ans" },
  { value: 60, label: "5 ans" },
]

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Échéance = date d'achat + N mois (calcul en date locale, sans dérive timezone).
function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setMonth(dt.getMonth() + months)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
}

export function RenewalForm({ postDevId, projectId }: { postDevId: string; projectId: string }) {
  const [isPending, startTransition] = useTransition()
  const initialPurchase = todayStr()
  const [type, setType] = useState("DOMAIN")
  const [name, setName] = useState("")
  const [purchasedAt, setPurchasedAt] = useState(initialPurchase)
  const [periodMonths, setPeriodMonths] = useState(12)
  const [expiresAt, setExpiresAt] = useState(addMonths(initialPurchase, 12))

  function onPurchaseChange(value: string) {
    setPurchasedAt(value)
    if (value) setExpiresAt(addMonths(value, periodMonths))
  }
  function onPeriodChange(value: number) {
    setPeriodMonths(value)
    if (purchasedAt) setExpiresAt(addMonths(purchasedAt, value))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !expiresAt) return
    startTransition(async () => {
      await addRenewal(postDevId, projectId, {
        type,
        name: name.trim(),
        purchasedAt: purchasedAt || null,
        periodMonths,
        expiresAt,
      })
      setName("")
    })
  }

  const selectClass = "flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
        {renewalTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="monsite.com" className="h-8" />

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Date d’achat</label>
        <Input type="date" value={purchasedAt} onChange={(e) => onPurchaseChange(e.target.value)} className="h-8" />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Durée</label>
        <select value={periodMonths} onChange={(e) => onPeriodChange(Number(e.target.value))} className={selectClass}>
          {periods.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Échéance (auto, modifiable)</label>
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required className="h-8" />
      </div>

      <Button type="submit" size="sm" variant="outline" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Ajouter
      </Button>
    </form>
  )
}
