"use client"

import { useState, useTransition } from "react"
import { Landmark } from "lucide-react"
import { setClientFiscalCategory } from "@/actions/urssaf"
import { FISCAL_CATEGORY_LABELS, type FiscalCategory } from "@/lib/urssaf"

// Catégorie fiscale par défaut du contact : pré-remplit la catégorie des
// factures de ce client lors de la préparation d'une déclaration URSSAF.
export function FiscalCategoryCard({ clientId, initial }: {
  clientId: string
  initial:  FiscalCategory | null
}) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<string>(initial ?? "")

  function handleChange(next: string) {
    setValue(next)
    startTransition(async () => {
      await setClientFiscalCategory(clientId, (next || null) as FiscalCategory | null)
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Catégorie fiscale</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Catégorie URSSAF par défaut des factures de ce client.
      </p>
      <select
        value={value}
        onChange={e => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm disabled:opacity-60"
      >
        <option value="">Non définie (BNC par défaut)</option>
        {(Object.keys(FISCAL_CATEGORY_LABELS) as FiscalCategory[]).map(cat => (
          <option key={cat} value={cat}>{FISCAL_CATEGORY_LABELS[cat]}</option>
        ))}
      </select>
    </div>
  )
}
