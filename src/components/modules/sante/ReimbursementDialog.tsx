"use client"

import { useState, useTransition } from "react"
import { X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createReimbursement, updateReimbursement, deleteReimbursement } from "@/actions/sante"
import type { HReimbursement, HConsultation } from "./HealthView"
import type { ReimbursementSource, ReimbursementStatus } from "@/generated/prisma/enums"

const toISO = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : ""

const fmtShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })

export function ReimbursementDialog({
  item,
  consultations,
  defaultConsultationId,
  onClose,
}: {
  item?: HReimbursement
  consultations: HConsultation[]
  defaultConsultationId?: string
  onClose: () => void
}) {
  const [isPending, start] = useTransition()
  const [amount,         setAmount]         = useState(item?.amount?.toString() || "")
  const [source,         setSource]         = useState<ReimbursementSource>((item?.source as ReimbursementSource) || "SECU")
  const [status,         setStatus]         = useState<ReimbursementStatus>((item?.status as ReimbursementStatus) || "PENDING")
  const [expectedDate,   setExpectedDate]   = useState(toISO(item?.expectedDate))
  const [receivedAt,     setReceivedAt]     = useState(toISO(item?.receivedAt) || toISO(new Date()))
  const [notes,          setNotes]          = useState(item?.notes || "")
  const [consultationId, setConsultationId] = useState(item?.consultationId || defaultConsultationId || "")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) return
    const payload = {
      amount: amountNum, source, status,
      expectedDate: expectedDate || null,
      receivedAt: status === "RECEIVED" ? (receivedAt || toISO(new Date())) : null,
      notes,
      consultationId: consultationId || null,
    }
    start(async () => {
      if (item) {
        await updateReimbursement(item.id, payload)
        toast.success("Remboursement mis à jour")
      } else {
        await createReimbursement(payload)
        toast.success(status === "PENDING" ? "Remboursement attendu enregistré" : "Remboursement enregistré")
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!item || !confirm("Supprimer ce remboursement ?")) return
    start(async () => {
      await deleteReimbursement(item.id)
      toast.success("Remboursement supprimé")
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 sticky top-0 bg-background">
          <h2 className="text-sm font-semibold">{item ? "Modifier" : "Ajouter"} un remboursement</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Statut PENDING / RECEIVED */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <div className="mt-1 flex gap-2">
              {([
                { v: "PENDING",  label: "En attente" },
                { v: "RECEIVED", label: "Reçu" },
              ] as { v: ReimbursementStatus; label: string }[]).map(s => (
                <button
                  key={s.v} type="button"
                  onClick={() => setStatus(s.v)}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    status === s.v
                      ? s.v === "RECEIVED"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-input text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Montant (€) *</label>
              <input
                type="number" step="0.01" min="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} required
                placeholder="0.00"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <div className="mt-1 flex gap-1.5">
                {(["SECU", "MUTUELLE"] as ReimbursementSource[]).map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => setSource(s)}
                    className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${
                      source === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {s === "SECU" ? "Sécu" : "Mutuelle"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dates contextuelles selon le statut */}
          {status === "PENDING" ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date prévue (optionnel)</label>
              <input
                type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date de réception</label>
              <input
                type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Commentaire…"
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {consultations.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Lié à une consultation</label>
              <select
                value={consultationId} onChange={e => setConsultationId(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Aucun lien —</option>
                {consultations.map(c => (
                  <option key={c.id} value={c.id}>
                    {fmtShort(c.date)} · {c.practitionerName}{c.cost ? ` (${c.cost} €)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {item && (
              <button
                type="button" onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit" disabled={isPending || !amount || parseFloat(amount) <= 0}
                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                {isPending ? "…" : item ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
