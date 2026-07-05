"use client"

import { useState, useTransition } from "react"
import { Landmark, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveTaxSettings, type TaxSettingsData } from "@/actions/settings"

const LEGAL_STATUSES = [
  { value: "AUTO_ENTREPRENEUR", label: "Auto-entrepreneur (micro)" },
  { value: "EI",                label: "Entreprise individuelle" },
  { value: "EURL",              label: "EURL" },
  { value: "SASU",              label: "SASU" },
  { value: "OTHER",             label: "Autre" },
]

type RateRow = {
  key:   "BNC" | "BICServices" | "BICSales"
  label: string
  hint:  string
}

const RATE_ROWS: RateRow[] = [
  { key: "BNC",         label: "BNC — activités libérales",  hint: "prestations intellectuelles (dev, conseil…)" },
  { key: "BICServices", label: "BIC — prestations de services", hint: "prestations commerciales ou artisanales" },
  { key: "BICSales",    label: "BIC — ventes de marchandises",  hint: "achat-revente" },
]

export function TaxSettingsPanel({ initial }: { initial: TaxSettingsData }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [form, setForm]   = useState<TaxSettingsData>(initial)

  function setRate(field: keyof TaxSettingsData, raw: string) {
    const n = parseFloat(raw.replace(",", "."))
    setForm(f => ({ ...f, [field]: Number.isFinite(n) ? n : 0 }))
  }

  function handleSave() {
    startTransition(async () => {
      await saveTaxSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Imposition &amp; URSSAF</h2>
      </div>

      {/* Statut + fréquence + VL */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Statut juridique</label>
          <select
            value={form.legalStatus}
            onChange={e => setForm(f => ({ ...f, legalStatus: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
          >
            {LEGAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Fréquence de déclaration</label>
          <select
            value={form.urssafFrequency}
            onChange={e => setForm(f => ({ ...f, urssafFrequency: e.target.value as "MONTHLY" | "QUARTERLY" }))}
            className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
          >
            <option value="QUARTERLY">Trimestrielle</option>
            <option value="MONTHLY">Mensuelle</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Versement libératoire</label>
          <button
            onClick={() => setForm(f => ({ ...f, versementLiberatoire: !f.versementLiberatoire }))}
            className={`mt-1 flex items-center gap-2 w-full rounded-lg border px-2.5 py-2 text-sm transition-colors ${
              form.versementLiberatoire
                ? "border-primary/50 bg-primary/10 text-primary font-medium"
                : "border-input bg-background text-muted-foreground"
            }`}
          >
            <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
              form.versementLiberatoire ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}>
              {form.versementLiberatoire && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
            </span>
            {form.versementLiberatoire ? "Opté (impôt prélevé avec les cotisations)" : "Non opté"}
          </button>
        </div>
      </div>

      {/* Taux par catégorie */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Taux appliqués au CA déclaré (%). Modifiez-les si l&apos;URSSAF les révise ou si vous bénéficiez de l&apos;ACRE.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-wide">
                <th className="text-left font-medium pb-1.5">Catégorie</th>
                <th className="text-right font-medium pb-1.5 w-24">Cotisations</th>
                <th className="text-right font-medium pb-1.5 w-24">Vers. lib.</th>
                <th className="text-right font-medium pb-1.5 w-24">CFP</th>
              </tr>
            </thead>
            <tbody>
              {RATE_ROWS.map(row => (
                <tr key={row.key} className="border-t border-border">
                  <td className="py-2 pr-2">
                    <p className="text-xs font-medium">{row.label}</p>
                    <p className="text-[10px] text-muted-foreground">{row.hint}</p>
                  </td>
                  {(["Cotisations", "VL", "CFP"] as const).map(part => {
                    const field = `rate${row.key}${part}` as keyof TaxSettingsData
                    return (
                      <td key={part} className="py-2 pl-2">
                        <Input
                          value={String(form[field])}
                          onChange={e => setRate(field, e.target.value)}
                          className="h-8 text-xs text-right tabular-nums"
                          inputMode="decimal"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Enregistré ✓</span>}
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
