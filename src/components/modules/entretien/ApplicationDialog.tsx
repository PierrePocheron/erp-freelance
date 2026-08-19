"use client"

import { useId, useState, useTransition } from "react"
import { X, Trash2, FileCheck2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { createJobApplication, updateJobApplication, deleteJobApplication } from "@/actions/entretien"
import { STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, EVENT_TYPE_CONFIG, MEETING_FORMATS, toDateInputValue, type JobAppStatus } from "./status-config"
import type { JobApp, JobContact, CompanyOption } from "./EntretienView"
import type { JobEventType } from "@/generated/prisma/enums"

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
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fid = useId()

  // Premier contact (création uniquement)
  const [initEventEnabled, setInitEventEnabled] = useState(false)
  const [initEventType, setInitEventType] = useState<JobEventType>("CALL")
  const [initEventDate, setInitEventDate] = useState(() => new Date().toISOString().split("T")[0])
  const [initEventTitle, setInitEventTitle] = useState("")
  const [initEventNotes, setInitEventNotes] = useState("")

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
  const [appliedAt,   setAppliedAt]   = useState(toDateInputValue(item?.appliedAt))
  const [nextActionAt,    setNextActionAt]    = useState(toDateInputValue(item?.nextActionAt))
  const [nextActionLabel, setNextActionLabel] = useState(item?.nextActionLabel || "")
  const [nextActionFormat, setNextActionFormat] = useState(item?.nextActionFormat || "")
  const [dossierValidated, setDossierValidated] = useState(item?.competencyDossierValidated ?? false)
  const [dossierUrl,       setDossierUrl]       = useState(item?.competencyDossierUrl || "")
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
      nextActionFormat: nextActionFormat || null,
      competencyDossierValidated: dossierValidated,
      competencyDossierUrl: dossierUrl,
      notes,
    }
    start(async () => {
      try {
        if (item) {
          await updateJobApplication(item.id, payload)
          toast.success("Candidature mise à jour")
        } else {
          await createJobApplication({
            ...payload,
            initialEvent: initEventEnabled && initEventTitle.trim()
              ? { type: initEventType, date: initEventDate, title: initEventTitle, notes: initEventNotes || null }
              : null,
          })
          toast.success("Candidature créée")
        }
        onClose()
      } catch {
        toast.error("Échec de l'enregistrement de la candidature")
      }
    })
  }

  function handleDelete() {
    if (!item) return
    start(async () => {
      try {
        await deleteJobApplication(item.id)
        toast.success("Candidature supprimée")
        onClose()
      } catch {
        toast.error("Échec de la suppression de la candidature")
      }
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 sticky top-0 bg-background z-10">
          <DialogTitle className="text-sm font-semibold">{item ? "Modifier" : "Nouvelle"} candidature</DialogTitle>
          <button onClick={onClose} aria-label="Fermer" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Société + poste */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fid}-company`} className="text-xs font-medium text-muted-foreground">Entreprise cible *</label>
              <input
                id={`${fid}-company`}
                value={companyName} onChange={e => onCompanyNameChange(e.target.value)} required
                list="company-suggestions"
                placeholder="Ex : Doctolib"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <datalist id="company-suggestions">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              {companyName.trim() && !companyId && (
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  ✨ Nouvelle société — elle sera ajoutée à vos sociétés
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${fid}-position`} className="text-xs font-medium text-muted-foreground">Poste / mission *</label>
              <input
                id={`${fid}-position`}
                value={position} onChange={e => setPosition(e.target.value)} required
                placeholder="Ex : Dév full-stack"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Lieu + mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fid}-location`} className="text-xs font-medium text-muted-foreground">Lieu</label>
              <input
                id={`${fid}-location`}
                value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Ex : Lyon"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor={`${fid}-workmode`} className="text-xs font-medium text-muted-foreground">Mode</label>
              <input
                id={`${fid}-workmode`}
                value={workMode} onChange={e => setWorkMode(e.target.value)}
                placeholder="Remote / Hybride / Présentiel"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label htmlFor={`${fid}-status`} className="text-xs font-medium text-muted-foreground">Statut</label>
            <select
              id={`${fid}-status`}
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
              <label htmlFor={`${fid}-contact`} className="text-xs font-medium text-muted-foreground">Recruteur (contact)</label>
              <select
                id={`${fid}-contact`}
                value={contactId} onChange={e => setContactId(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Aucun —</option>
                {(() => {
                  const recruiters = contacts.filter(c => c.type === "RECRUITER")
                  const others     = contacts.filter(c => c.type !== "RECRUITER")
                  return (
                    <>
                      {recruiters.length > 0 && (
                        <optgroup label="Recruteurs">
                          {recruiters.map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label="Autres contacts">
                          {others.map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )
                })()}
              </select>
            </div>
            <div>
              <label htmlFor={`${fid}-source`} className="text-xs font-medium text-muted-foreground">Source</label>
              <input
                id={`${fid}-source`}
                value={source} onChange={e => setSource(e.target.value)}
                placeholder="LinkedIn, cooptation…"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Salaire */}
          <div>
            <label htmlFor={`${fid}-salary-min`} className="text-xs font-medium text-muted-foreground">Rémunération (annuel brut €)</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input
                id={`${fid}-salary-min`}
                type="number" step="1000" min="0" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                placeholder="Min"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                aria-label="Rémunération maximale (annuel brut €)"
                type="number" step="1000" min="0" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                placeholder="Max"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                aria-label="Complément de rémunération"
                value={salaryNote} onChange={e => setSalaryNote(e.target.value)}
                placeholder="+ variable…"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Lien offre */}
          <div>
            <label htmlFor={`${fid}-url`} className="text-xs font-medium text-muted-foreground">Lien de l&apos;offre</label>
            <input
              id={`${fid}-url`}
              type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fid}-applied`} className="text-xs font-medium text-muted-foreground">Date de candidature</label>
              <input
                id={`${fid}-applied`}
                type="date" value={appliedAt} onChange={e => setAppliedAt(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor={`${fid}-next-at`} className="text-xs font-medium text-muted-foreground">Prochain point (date)</label>
              <input
                id={`${fid}-next-at`}
                type="date" value={nextActionAt} onChange={e => setNextActionAt(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {nextActionAt && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${fid}-next-label`} className="text-xs font-medium text-muted-foreground">Libellé du prochain point</label>
                <input
                  id={`${fid}-next-label`}
                  value={nextActionLabel} onChange={e => setNextActionLabel(e.target.value)}
                  placeholder="Ex : Entretien technique"
                  className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor={`${fid}-next-format`} className="text-xs font-medium text-muted-foreground">Format</label>
                <select
                  id={`${fid}-next-format`}
                  value={nextActionFormat} onChange={e => setNextActionFormat(e.target.value)}
                  className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— À préciser —</option>
                  {MEETING_FORMATS.map(f => <option key={f.value} value={f.value}>{f.icon} {f.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Dossier de compétences — parfois demandé après le premier entretien */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={dossierValidated}
                onChange={e => setDossierValidated(e.target.checked)}
                className="rounded border-input accent-primary"
              />
              <FileCheck2 className="h-3.5 w-3.5 text-muted-foreground" />
              Dossier de compétences validé
            </label>
            <div>
              <label htmlFor={`${fid}-dossier-url`} className="text-xs font-medium text-muted-foreground">Lien du dossier</label>
              <input
                id={`${fid}-dossier-url`}
                type="url" value={dossierUrl} onChange={e => setDossierUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor={`${fid}-notes`} className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              id={`${fid}-notes`}
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Contexte, impressions, points d'attention…"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Premier point de contact — création uniquement */}
          {!item && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={initEventEnabled}
                  onChange={e => setInitEventEnabled(e.target.checked)}
                  className="rounded border-input accent-primary"
                />
                Ajouter un premier point de contact
              </label>
              {initEventEnabled && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {(["APPLICATION", "CALL", "MESSAGE", "EMAIL", "VIDEO", "OTHER"] as JobEventType[]).map((t) => (
                      <button
                        key={t} type="button"
                        onClick={() => setInitEventType(t)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          initEventType === t
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {EVENT_TYPE_CONFIG[t]?.icon} {EVENT_TYPE_CONFIG[t]?.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      aria-label="Date du premier point de contact"
                      type="date" value={initEventDate}
                      onChange={e => setInitEventDate(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      aria-label="Résumé du premier point de contact"
                      value={initEventTitle} onChange={e => setInitEventTitle(e.target.value)}
                      placeholder="Résumé du contact…"
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <input
                    aria-label="Notes du premier point de contact"
                    value={initEventNotes} onChange={e => setInitEventNotes(e.target.value)}
                    placeholder="Notes (optionnel)"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {item && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confirmer ?</span>
                  <button type="button" onClick={handleDelete}
                    className="text-xs font-medium text-destructive hover:opacity-80 transition-opacity"
                  >
                    Oui, supprimer
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              )
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
      </DialogContent>
    </Dialog>
  )
}
