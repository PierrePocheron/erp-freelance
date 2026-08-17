"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { addEntry } from "@/actions/investissements"
import { Button } from "@/components/ui/button"

/** Date/heure locale actuelle au format d'un input datetime-local (YYYY-MM-DDTHH:mm). */
function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Ajout rapide d'un relevé : capital total + apport optionnel + date (maintenant par
 * défaut). Entrée valide (formulaire), Échap ferme. Monté seulement à l'ouverture
 * (interaction client) → pas de mismatch d'hydratation sur la date par défaut.
 */
export function InvestmentQuickAdd({ platformId, onClose }: { platformId: string; onClose: () => void }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [date, setDate] = useState("")
  const capitalRef = useRef<HTMLInputElement>(null)
  const apportRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(nowLocal())
    capitalRef.current?.focus()
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const capital = parseFloat((capitalRef.current?.value ?? "").replace(",", "."))
    if (!Number.isFinite(capital)) { toast.error("Capital requis"); return }
    const apportRaw = (apportRef.current?.value ?? "").replace(",", ".").trim()
    const contribution = apportRaw ? parseFloat(apportRaw) : 0
    start(async () => {
      try {
        await addEntry(platformId, {
          capital,
          contribution: Number.isFinite(contribution) ? contribution : 0,
          date: date || undefined,
        })
        toast.success("Relevé ajouté")
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
      className="space-y-1.5 rounded-md border border-border/60 bg-card p-2"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Capital total (€)</span>
          <input ref={capitalRef} type="text" inputMode="decimal" required placeholder="1250" className={inputCls} aria-label="Capital total" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">dont apport (€)</span>
          <input ref={apportRef} type="text" inputMode="decimal" placeholder="0" className={inputCls} aria-label="Apport (dépôt ou retrait)" />
        </label>
      </div>
      <label className="block space-y-0.5">
        <span className="text-[10px] text-muted-foreground">Date</span>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Date du relevé" />
      </label>
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" size="xs" variant="ghost" onClick={onClose} disabled={isPending}>Annuler</Button>
        <Button type="submit" size="xs" disabled={isPending}>{isPending ? "…" : "Ajouter"}</Button>
      </div>
    </form>
  )
}
