"use client"

import { useState, useTransition } from "react"
import { X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createConsultation, updateConsultation, deleteConsultation } from "@/actions/sante"
import { PRACTITIONER_LABELS } from "./HealthView"
import type { HConsultation, HEvent } from "./HealthView"
import type { PractitionerType } from "@/generated/prisma/enums"

const toISO = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : ""

const PRACTITIONER_TYPES: PractitionerType[] = [
  "GENERAL", "OSTEOPATH", "SPECIALIST", "SOS_MEDECIN", "NURSE", "PHYSIO", "DENTIST", "OTHER",
]

export function ConsultationDialog({
  item,
  events,
  onClose,
}: {
  item?: HConsultation
  events: HEvent[]
  onClose: () => void
}) {
  const [isPending, start] = useTransition()
  const [date,             setDate]             = useState(toISO(item?.date) || toISO(new Date()))
  const [practitionerName, setPractitionerName] = useState(item?.practitionerName || "")
  const [practitionerType, setPractitionerType] = useState<PractitionerType>(
    (item?.practitionerType as PractitionerType) || "OTHER"
  )
  const [title,       setTitle]       = useState(item?.title || "")
  const [notes,       setNotes]       = useState(item?.notes || "")
  const [cost,        setCost]        = useState(item?.cost?.toString() || "")
  const [hasDocument, setHasDocument] = useState(item?.hasDocument || false)
  const [documentRef, setDocumentRef] = useState(item?.documentRef || "")
  const [healthEventId, setHealthEventId] = useState(item?.healthEventId || "")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!practitionerName.trim() || !title.trim()) return
    const costNum = cost ? parseFloat(cost) : null
    start(async () => {
      if (item) {
        await updateConsultation(item.id, {
          date, practitionerName, practitionerType, title, notes,
          cost: costNum, hasDocument, documentRef,
          healthEventId: healthEventId || null,
        })
        toast.success("Consultation mise à jour")
      } else {
        await createConsultation({
          date, practitionerName, practitionerType, title, notes,
          cost: costNum, hasDocument, documentRef,
          healthEventId: healthEventId || null,
        })
        toast.success("Consultation enregistrée")
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!item || !confirm("Supprimer cette consultation ?")) return
    start(async () => {
      await deleteConsultation(item.id)
      toast.success("Consultation supprimée")
      onClose()
    })
  }

  // Événements non résolus en premier, puis résolus
  const sortedEvents = [...events].sort((a, b) => {
    if (!a.resolvedAt && b.resolvedAt) return -1
    if (a.resolvedAt && !b.resolvedAt) return 1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 sticky top-0 bg-background">
          <h2 className="text-sm font-semibold">{item ? "Modifier" : "Ajouter"} une consultation</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Praticien *</label>
              <input
                value={practitionerName} onChange={e => setPractitionerName(e.target.value)} required
                placeholder="Ex : Mickael Nguyen"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={practitionerType} onChange={e => setPractitionerType(e.target.value as PractitionerType)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PRACTITIONER_TYPES.map(t => (
                  <option key={t} value={t}>{PRACTITIONER_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Motif / résumé *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Ex : Consultation lombaires, Bilan sanguin…"
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes / conclusions</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Diagnostic, prescriptions, recommandations…"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Coût (€)</label>
              <input
                type="number" step="0.01" min="0"
                value={cost} onChange={e => setCost(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={hasDocument} onChange={e => setHasDocument(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">♻️ Document Drive</span>
              </label>
            </div>
          </div>

          {hasDocument && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Référence / URL document</label>
              <input
                value={documentRef} onChange={e => setDocumentRef(e.target.value)}
                placeholder="https://drive.google.com/…"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {sortedEvents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Lié à une blessure / maladie</label>
              <select
                value={healthEventId} onChange={e => setHealthEventId(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Aucun lien —</option>
                {sortedEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.resolvedAt ? "✓ " : "🩸 "}
                    {ev.title}{ev.bodyPart ? ` (${ev.bodyPart})` : ""}
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
                type="submit" disabled={isPending || !practitionerName.trim() || !title.trim()}
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
