"use client"

import { useState, useTransition, useEffect } from "react"
import { X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createHealthEvent, updateHealthEvent, deleteHealthEvent } from "@/actions/sante"
import type { HEvent } from "./HealthView"
import type { HealthEventType } from "@/generated/prisma/enums"

const toISO = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : ""

export function HealthEventDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item?: HEvent
  onClose: () => void
}) {
  const [isPending, start] = useTransition()
  const [date,        setDate]        = useState(toISO(item?.date) || toISO(new Date()))
  const [type,        setType]        = useState<HealthEventType>(item?.type as HealthEventType || "INJURY")
  const [title,       setTitle]       = useState(item?.title || "")
  const [description, setDescription] = useState(item?.description || "")
  const [bodyPart,    setBodyPart]    = useState(item?.bodyPart || "")
  const [resolvedAt,  setResolvedAt]  = useState(toISO(item?.resolvedAt))

  useEffect(() => {
    if (open) {
      setDate(toISO(item?.date) || toISO(new Date()))
      setType((item?.type as HealthEventType) || "INJURY")
      setTitle(item?.title || "")
      setDescription(item?.description || "")
      setBodyPart(item?.bodyPart || "")
      setResolvedAt(toISO(item?.resolvedAt))
    }
  }, [open, item])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    start(async () => {
      if (item) {
        await updateHealthEvent(item.id, { date, type, title, description, bodyPart, resolvedAt: resolvedAt || null })
        toast.success("Événement mis à jour")
      } else {
        await createHealthEvent({ date, type, title, description, bodyPart })
        toast.success("Événement enregistré")
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!item || !confirm("Supprimer cet événement ?")) return
    start(async () => {
      await deleteHealthEvent(item.id)
      toast.success("Événement supprimé")
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="text-sm font-semibold">{item ? "Modifier" : "Ajouter"} une blessure / maladie</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={type} onChange={e => setType(e.target.value as HealthEventType)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="INJURY">🩸 Blessure</option>
                <option value="ILLNESS">🩸 Maladie</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Titre *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Ex : Douleur lombaires, Grippe, Ligament croisé…"
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Localisation (partie du corps)</label>
            <input
              value={bodyPart} onChange={e => setBodyPart(e.target.value)}
              placeholder="Ex : dos, genou gauche, coude droit…"
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description / contexte</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Circonstances, symptômes, contexte…"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {item && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date de résolution (si guéri)</label>
              <input
                type="date" value={resolvedAt} onChange={e => setResolvedAt(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
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
                type="submit" disabled={isPending || !title.trim()}
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
