"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { addEntry, addDeposit } from "@/actions/investissements"
import { Button } from "@/components/ui/button"

/** Date/heure locale actuelle au format d'un input datetime-local (YYYY-MM-DDTHH:mm). */
function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Ajout rapide — deux modes distincts :
 * - "releve" : capital total à une date (valorisation).
 * - "depot"  : dépôt/retrait d'argent de la poche, dissocié du relevé (flux à sa
 *   propre date, sans capital). Un retrait = montant négatif.
 * Entrée valide, Échap ferme. Monté à l'ouverture (pas de mismatch d'hydratation).
 */
export function InvestmentQuickAdd({ platformId, mode, onClose }: { platformId: string; mode: "releve" | "depot"; onClose: () => void }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [date, setDate] = useState("")
  const valueRef = useRef<HTMLInputElement>(null)
  const isDepot = mode === "depot"

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(nowLocal())
    valueRef.current?.focus()
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const raw = (valueRef.current?.value ?? "").replace(",", ".").trim()
    const num = parseFloat(raw)
    if (!Number.isFinite(num)) { toast.error(isDepot ? "Montant requis" : "Capital requis"); return }
    if (isDepot && num === 0) { toast.error("Montant non nul requis"); return }
    start(async () => {
      try {
        if (isDepot) await addDeposit(platformId, { amount: num, date: date || undefined })
        else await addEntry(platformId, { capital: num, date: date || undefined })
        toast.success(isDepot ? "Dépôt enregistré" : "Relevé ajouté")
        onClose()
        router.refresh()
      } catch {
        toast.error("Ajout impossible")
      }
    })
  }

  const inputCls = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
      className={`space-y-1.5 rounded-md border p-2 ${isDepot ? "border-blue-500/40 bg-blue-500/5" : "border-border/60 bg-card"}`}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">{isDepot ? "Montant du dépôt (€)" : "Capital total (€)"}</span>
          <input ref={valueRef} type="text" inputMode="decimal" required placeholder={isDepot ? "200" : "1250"} className={inputCls} aria-label={isDepot ? "Montant du dépôt" : "Capital total"} />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Date</span>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Date" />
        </label>
      </div>
      {isDepot && <p className="text-[10px] text-muted-foreground">Un retrait = montant négatif (ex.&nbsp;−50).</p>}
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" size="xs" variant="ghost" onClick={onClose} disabled={isPending}>Annuler</Button>
        <Button type="submit" size="xs" disabled={isPending}>{isPending ? "…" : isDepot ? "Déposer" : "Ajouter"}</Button>
      </div>
    </form>
  )
}
