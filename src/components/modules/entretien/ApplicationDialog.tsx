"use client"

import { useState, useTransition } from "react"
import { X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createJobApplication, updateJobApplication, deleteJobApplication } from "@/actions/entretien"
import { STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, type JobAppStatus } from "./status-config"
import type { JobApp, JobContact, CompanyOption } from "./EntretienView"

const toISO = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : ""

export function ApplicationDialog({
  item,
  contacts,
  companies,
  onClose,
}: {
  item?: JobApp
  contacts: JobContact[]
  companies: CompanyOption[]
  onClose: () => void
}) {
  const [isPending, start] = useTransition()

  const [companyName, setCompanyName] = useState(item?.companyName || "")
  const [companyId,   setCompanyId]   = useState(item?.companyId || "")
  const [position,    setPosition]    = useState(item?.position || "")

  // Lie automatiquement à une Company existante si le nom saisi correspond.
  function onCompanyNameChange(value: string) {
    setCompanyName(value)
    const match = companies.find((c) => c.name.toLowerCase() === value.trim().toLowerCase())
    setCompanyId(match?.id ?? "")
  }
  const [location,    setLocation]    = useState(item?.location || "")
  const [workMode,    setWorkMode]    = useState(item?.workMode || "")
  const [status,      setStatus]      = useState<JobAppStatus>((item?.status as JobAppStatus) || "WISHLIST")
  const [source,      setSource]      = useState(item?.source || "")
  const [url,         setUrl]         = useState(item?.url || "")
  const [salaryMin,   setSalaryMin]   = useState(item?.salaryMin?.toString() || "")
  const [salaryMax,   setSalaryMax]   = useState(item?.salaryMax?.toString() || "")
  const [salaryNote,  setSalaryNote]  = useState(item?.salaryNote || "")
  const [contactId,   setContactId]   = useState(item?.contactId || "")
  const [appliedAt,   setAppliedAt]   = useState(toISO(item?.appliedAt))
  const [nextActionAt,    setNextActionAt]    = useState(toISO(item?.nextActionAt))
  const [nextActionLabel, setNextActionLabel] = useState(item?.nextActionLabel || "")
  const [notes,       setNotes]       = useState(item?.notes || "")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !position.trim()) return
    const payload = {
      companyName, companyId: companyId || null, position, location, workMode,
      status, source, url,
      salaryMin: salaryMin ? parseFloat(salaryMin) : null,
      salaryMax: salaryMax ? parseFloat(salaryMax) : null,
      salaryNote,
      contactId: contactId || null,
      appliedAt: appliedAt || null,
      nextActionAt: nextActionAt || null,
      nextActionLabel,
      notes,
    }
    start(async () => {
      if (item) {
        await updateJobApplication(item.id, payload)
        toast.success("Candidature mise à jour")
      } else {
        await createJobApplication(payload)
        toast.success("Candidature créée")
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!item || !confirm("Supprimer cette candidature et son historique ?")) return
    start(async () => {
      await deleteJobApplication(item.id)
      toast.success("Candidature supprimée")
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 sticky top-0 bg-background z-10">
          <h2 className="text-sm font-semibold">{item ? "Modifier" : "Nouvelle"} candidature</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Société + poste */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Société *</label>
              <input
                value={companyName} onChange={e => onCompanyNameChange(e.target.value)} required
                list="company-suggestions"
                placeholder="Ex : Doctolib"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <datalist id="company-suggestions">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Poste *</label>
              <input
                value={position} onChange={e => setPosition(e.target.value)} required
                placeholder="Ex : Dév full-stack"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Lieu + mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Lieu</label>
              <input
                value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Ex : Lyon"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mode</label>
              <input
                value={workMode} onChange={e => setWorkMode(e.target.value)}
                placeholder="Remote / Hybride / Présentiel"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <select
              value={status} onChange={e => setStatus(e.target.value as JobAppStatus)}
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <optgroup label="Pipeline">
                {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </optgroup>
              <optgroup label="Résultat">
                {OUTCOME_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </optgroup>
            </select>
          </div>

          {/* Recruteur + source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Recruteur (contact)</label>
              <select
                value={contactId} onChange={e => setContactId(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Aucun —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <input
                value={source} onChange={e => setSource(e.target.value)}
                placeholder="LinkedIn, cooptation…"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Salaire */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Rémunération (annuel brut €)</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input
                type="number" step="1000" min="0" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                placeholder="Min"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="number" step="1000" min="0" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                placeholder="Max"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={salaryNote} onChange={e => setSalaryNote(e.target.value)}
                placeholder="+ variable…"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Lien offre */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Lien de l&apos;offre</label>
            <input
              type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date de candidature</label>
              <input
                type="date" value={appliedAt} onChange={e => setAppliedAt(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prochain point (date)</label>
              <input
                type="date" value={nextActionAt} onChange={e => setNextActionAt(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {nextActionAt && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Libellé du prochain point</label>
              <input
                value={nextActionLabel} onChange={e => setNextActionLabel(e.target.value)}
                placeholder="Ex : Entretien technique avec le CTO"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Contexte, impressions, points d'attention…"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            {item && (
              <button type="button" onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={isPending || !companyName.trim() || !position.trim()}
                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors">
                {isPending ? "…" : item ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
