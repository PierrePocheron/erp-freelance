"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Building2, MapPin, Banknote, ExternalLink,
  Mail, Phone, Plus, Check, CalendarClock,
  Pencil, Trash2, Ban, RotateCcw, FileText, FileCheck2,
} from "lucide-react"
import { LinkedinIcon } from "@/components/ui/linkedin-icon"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  updateApplicationStatus, addApplicationEvent,
  deleteApplicationEvent, cancelApplicationEvent,
  uncancelApplicationEvent, setEventOutcome,
  updateJobApplication, deleteJobApplication,
} from "@/actions/entretien"
import {
  STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, EVENT_TYPE_CONFIG,
  fmtDate, fmtDateTime, type JobAppStatus,
} from "./status-config"
import type { JobEventType, JobApplicationStatus } from "@/generated/prisma/enums"

// ── Types ──────────────────────────────────────────────────────────────────────

type DetailEvent = {
  id: string
  applicationId: string
  date: Date | string
  type: string
  title: string
  notes: string | null
  outcome: string | null
  cancelledAt: Date | string | null
  createdAt: Date | string
}

type DetailContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  linkedinUrl: string | null
  notes: string | null
}

type DetailCompany = {
  id: string
  name: string
  city: string | null
  website: string | null
} | null

type DetailApp = {
  id: string
  companyName: string
  companyId: string | null
  position: string
  location: string | null
  workMode: string | null
  status: string
  source: string | null
  url: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryNote: string | null
  notes: string | null
  priority: number
  contactId: string | null
  appliedAt: Date | string | null
  nextActionAt: Date | string | null
  nextActionLabel: string | null
  competencyDossierValidated: boolean
  competencyDossierUrl: string | null
  closedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  contact: DetailContact | null
  company: DetailCompany
  events: DetailEvent[]
}

type ListContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  linkedinUrl: string | null
  type: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_TYPES: JobEventType[] = [
  "APPLICATION", "CALL", "VIDEO", "ONSITE", "EMAIL", "MESSAGE", "TECHNICAL_TEST", "OFFER", "OTHER",
]

function salaryLabel(app: DetailApp): string | null {
  const fmtK = (n: number) => `${(n / 1000).toFixed(0)}k`
  if (app.salaryMin && app.salaryMax) return `${fmtK(app.salaryMin)} – ${fmtK(app.salaryMax)} €`
  if (app.salaryMin) return `dès ${fmtK(app.salaryMin)} €`
  if (app.salaryMax) return `jusqu'à ${fmtK(app.salaryMax)} €`
  return app.salaryNote ?? null
}

const toDateInput = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : ""

// Styles partagés des champs en mode édition
const inputCls = "w-full h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
const labelCls = "text-xs font-medium text-muted-foreground"
const cardTitleCls = "text-xs font-semibold text-muted-foreground uppercase tracking-wide"

// ── Pipeline stepper ───────────────────────────────────────────────────────────

function PipelineStepper({ status }: { status: string }) {
  const idx = PIPELINE_STATUSES.indexOf(status as JobAppStatus)
  const isOutcome = OUTCOME_STATUSES.includes(status as JobAppStatus)

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PIPELINE_STATUSES.map((s, i) => {
        const cfg = STATUS_CONFIG[s]
        const done = idx >= 0 && i < idx
        const current = s === status
        return (
          <div key={s} className="flex items-center shrink-0">
            <div className={cn(
              "flex flex-col items-center gap-0.5",
            )}>
              <div className={cn(
                "h-2 w-2 rounded-full border transition-all",
                current ? cn(cfg.dot, "ring-2 ring-offset-1 ring-current/40 scale-125 border-transparent") :
                done ? cn(cfg.dot, "border-transparent opacity-70") :
                "bg-muted border-border/50"
              )} />
              <span className={cn(
                "text-[9px] font-medium whitespace-nowrap",
                current ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/40"
              )}>
                {cfg.short}
              </span>
            </div>
            {i < PIPELINE_STATUSES.length - 1 && (
              <div className={cn(
                "h-px w-6 mx-1 mb-3 transition-all",
                done || current ? "bg-border" : "bg-border/30"
              )} />
            )}
          </div>
        )
      })}
      {isOutcome && (
        <>
          <div className="h-px w-6 mx-1 mb-3 bg-border/30" />
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className={cn("h-2 w-2 rounded-full border-transparent ring-2 ring-offset-1 ring-current/40 scale-125", STATUS_CONFIG[status as JobAppStatus]?.dot)} />
            <span className="text-[9px] font-medium text-foreground">
              {STATUS_CONFIG[status as JobAppStatus]?.short}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ── EventRow ───────────────────────────────────────────────────────────────────

function EventRow({
  ev,
  onDelete,
}: {
  ev: DetailEvent
  onDelete: (id: string) => void
}) {
  const [, start] = useTransition()
  const [showOutcomeForm, setShowOutcomeForm] = useState(false)
  const [outcomeText, setOutcomeText] = useState(ev.outcome ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const isFuture = new Date(ev.date) > new Date()
  const isCancelled = !!ev.cancelledAt
  const ec = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.OTHER

  function handleMarkPassed() {
    setShowOutcomeForm(true)
  }

  function handleSaveOutcome() {
    start(async () => {
      await setEventOutcome(ev.id, outcomeText)
      setShowOutcomeForm(false)
      toast.success("Compte rendu enregistré")
    })
  }

  function handleCancel() {
    start(async () => {
      await cancelApplicationEvent(ev.id)
      setConfirmCancel(false)
      toast.success("Événement annulé")
    })
  }

  function handleUncancel() {
    start(async () => {
      await uncancelApplicationEvent(ev.id)
      toast.success("Annulation levée")
    })
  }

  return (
    <div className={cn(
      "relative pl-8",
    )}>
      {/* Timeline dot */}
      <div className={cn(
        "absolute left-2.5 top-3 h-2.5 w-2.5 rounded-full border-2 border-background ring-1 transition-all",
        isCancelled ? "bg-muted-foreground/30 ring-muted-foreground/20" :
        isFuture ? "bg-amber-400 ring-amber-400/40" :
        ev.outcome ? "bg-emerald-500 ring-emerald-400/40" :
        "bg-primary ring-primary/30"
      )} />

      <div className={cn(
        "rounded-xl border p-3 space-y-2 transition-opacity",
        isCancelled && "opacity-50",
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-base leading-none shrink-0">{ec.icon}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {isFuture ? fmtDateTime(ev.date) : fmtDate(ev.date)}
            </span>
            <span className={cn(
              "text-[10px] font-medium rounded-full border px-1.5 py-0.5 shrink-0",
              isFuture ? "bg-amber-500/10 text-amber-700 border-amber-500/20" :
              isCancelled ? "bg-muted text-muted-foreground border-border" :
              "bg-muted/60 text-muted-foreground border-border/40"
            )}>
              {isCancelled ? "Annulé" : isFuture ? "À venir" : "Passé"}
            </span>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-1 shrink-0">
            {!isCancelled && isFuture && !showOutcomeForm && (
              <>
                <button
                  onClick={handleMarkPassed}
                  title="Marquer comme passé"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                >
                  <Check className="h-3 w-3" /> Passé
                </button>
                {confirmCancel ? (
                  <div className="flex items-center gap-1">
                    <button onClick={handleCancel}
                      className="text-[10px] font-medium text-destructive hover:opacity-80 px-1">
                      Confirmer
                    </button>
                    <button onClick={() => setConfirmCancel(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1">
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    title="Annuler cet événement"
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
            {!isCancelled && !isFuture && !ev.outcome && !showOutcomeForm && (
              <button
                onClick={() => setShowOutcomeForm(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-border/50"
              >
                <FileText className="h-3 w-3" /> CR
              </button>
            )}
            {isCancelled && (
              <button
                onClick={handleUncancel}
                title="Rétablir"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onDelete(ev.id)}
                  className="text-[10px] font-medium text-destructive hover:opacity-80 px-1">
                  Suppr.
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-muted-foreground px-1">
                  Non
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Supprimer"
                className="rounded-md p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <p className={cn("text-sm font-medium leading-snug", isCancelled && "line-through text-muted-foreground")}>{ev.title}</p>
        {ev.notes && <p className="text-xs text-muted-foreground leading-relaxed">{ev.notes}</p>}

        {/* Compte rendu */}
        {ev.outcome && !showOutcomeForm && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2">
            <FileText className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-700 mb-0.5">Compte rendu</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{ev.outcome}</p>
              <button
                onClick={() => { setOutcomeText(ev.outcome ?? ""); setShowOutcomeForm(true) }}
                className="mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Modifier
              </button>
            </div>
          </div>
        )}

        {/* Outcome form */}
        {showOutcomeForm && (
          <div className="space-y-2 rounded-lg bg-muted/30 border border-border/50 p-2.5">
            <p className="text-xs font-medium text-muted-foreground">Compte rendu</p>
            <textarea
              autoFocus
              value={outcomeText}
              onChange={(e) => setOutcomeText(e.target.value)}
              rows={3}
              placeholder="Notes post-entretien, ressenti, points clés…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowOutcomeForm(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveOutcome}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ApplicationDetailView({
  app,
  contacts,
  companies,
}: {
  app: DetailApp
  contacts: ListContact[]
  companies: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [, start] = useTransition()

  const [statusOpen, setStatusOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Champs éditables inline (mode « Modifier ») — re-seedés à l'entrée en édition.
  const [fCompany, setFCompany] = useState(app.companyName)
  const [fCompanyId, setFCompanyId] = useState(app.companyId ?? "")
  const [fPosition, setFPosition] = useState(app.position)
  const [fLocation, setFLocation] = useState(app.location ?? "")
  const [fWorkMode, setFWorkMode] = useState(app.workMode ?? "")
  const [fSource, setFSource] = useState(app.source ?? "")
  const [fUrl, setFUrl] = useState(app.url ?? "")
  const [fSalaryMin, setFSalaryMin] = useState(app.salaryMin?.toString() ?? "")
  const [fSalaryMax, setFSalaryMax] = useState(app.salaryMax?.toString() ?? "")
  const [fSalaryNote, setFSalaryNote] = useState(app.salaryNote ?? "")
  const [fContactId, setFContactId] = useState(app.contactId ?? "")
  const [fApplied, setFApplied] = useState(toDateInput(app.appliedAt))
  const [fNextAt, setFNextAt] = useState(toDateInput(app.nextActionAt))
  const [fNextLabel, setFNextLabel] = useState(app.nextActionLabel ?? "")
  const [fDossierValidated, setFDossierValidated] = useState(app.competencyDossierValidated)
  const [fDossierUrl, setFDossierUrl] = useState(app.competencyDossierUrl ?? "")
  const [fNotes, setFNotes] = useState(app.notes ?? "")

  // Add event form
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [evType, setEvType] = useState<JobEventType>("CALL")
  const [evDate, setEvDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [evTitle, setEvTitle] = useState("")
  const [evNotes, setEvNotes] = useState("")

  const cfg = STATUS_CONFIG[app.status as JobAppStatus] ?? STATUS_CONFIG.WISHLIST
  const salary = salaryLabel(app)
  const nextOverdue = app.nextActionAt && new Date(app.nextActionAt) < new Date()

  function beginEdit() {
    setFCompany(app.companyName); setFCompanyId(app.companyId ?? "")
    setFPosition(app.position); setFLocation(app.location ?? ""); setFWorkMode(app.workMode ?? "")
    setFSource(app.source ?? ""); setFUrl(app.url ?? "")
    setFSalaryMin(app.salaryMin?.toString() ?? ""); setFSalaryMax(app.salaryMax?.toString() ?? ""); setFSalaryNote(app.salaryNote ?? "")
    setFContactId(app.contactId ?? "")
    setFApplied(toDateInput(app.appliedAt)); setFNextAt(toDateInput(app.nextActionAt)); setFNextLabel(app.nextActionLabel ?? "")
    setFDossierValidated(app.competencyDossierValidated); setFDossierUrl(app.competencyDossierUrl ?? "")
    setFNotes(app.notes ?? "")
    setConfirmDelete(false)
    setEditing(true)
  }

  // Lie automatiquement companyId si le nom saisi correspond à une société existante.
  function onCompanyNameChange(value: string) {
    setFCompany(value)
    const match = companies.find((c) => c.name.toLowerCase() === value.trim().toLowerCase())
    setFCompanyId(match?.id ?? "")
  }

  function saveEdits() {
    if (!fCompany.trim() || !fPosition.trim()) { toast.error("Entreprise et poste sont requis"); return }
    start(async () => {
      await updateJobApplication(app.id, {
        companyName: fCompany, companyId: fCompanyId || null, position: fPosition,
        location: fLocation, workMode: fWorkMode,
        status: app.status as JobApplicationStatus,
        source: fSource, url: fUrl,
        salaryMin: fSalaryMin ? parseFloat(fSalaryMin) : null,
        salaryMax: fSalaryMax ? parseFloat(fSalaryMax) : null,
        salaryNote: fSalaryNote,
        contactId: fContactId || null,
        appliedAt: fApplied || null,
        nextActionAt: fNextAt || null,
        nextActionLabel: fNextLabel,
        competencyDossierValidated: fDossierValidated,
        competencyDossierUrl: fDossierUrl,
        notes: fNotes,
      })
      setEditing(false)
      toast.success("Candidature mise à jour")
    })
  }

  function handleDelete() {
    start(async () => {
      await deleteJobApplication(app.id)
      toast.success("Candidature supprimée")
      router.push("/entretiens")
    })
  }

  function pickStatus(s: JobAppStatus) {
    setStatusOpen(false)
    start(async () => {
      await updateApplicationStatus(app.id, s)
      toast.success(`Statut : ${STATUS_CONFIG[s].label}`)
    })
  }

  function submitEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!evTitle.trim()) return
    start(async () => {
      await addApplicationEvent(app.id, {
        date: evDate,
        type: evType,
        title: evTitle,
        notes: evNotes || undefined,
      })
      setEvTitle(""); setEvNotes(""); setShowAddEvent(false)
      toast.success("Point de contact ajouté")
    })
  }

  function handleDeleteEvent(id: string) {
    start(async () => {
      await deleteApplicationEvent(id)
      toast.success("Événement supprimé")
    })
  }

  const sortedEvents = [...app.events].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )


  return (
    <div className="space-y-6 pb-16">
      {/* Retour + barre d'édition */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/entretiens"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux candidatures
        </Link>
        {editing ? (
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-muted-foreground">Supprimer&nbsp;?</span>
                <button type="button" onClick={handleDelete} className="text-xs font-medium text-destructive hover:opacity-80">Oui</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground">Non</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} title="Supprimer la candidature"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)}
              className="h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
              Annuler
            </button>
            <button type="button" onClick={saveEdits}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Check className="h-4 w-4" /> Enregistrer
            </button>
          </div>
        ) : (
          <button type="button" onClick={beginEdit}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
        )}
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Entreprise cible *</label>
              <input value={fCompany} onChange={(e) => onCompanyNameChange(e.target.value)} list="detail-company-suggestions" className={cn(inputCls, "mt-1")} />
              <datalist id="detail-company-suggestions">{companies.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div>
              <label className={labelCls}>Poste / mission *</label>
              <input value={fPosition} onChange={(e) => setFPosition(e.target.value)} className={cn(inputCls, "mt-1")} />
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {app.company ? (
                <Link href={`/societes/${app.company.id}`} className="hover:text-primary transition-colors">
                  {app.companyName}
                </Link>
              ) : app.companyName}
              {app.company?.city && <span className="text-border">·</span>}
              {app.company?.city && <span>{app.company.city}</span>}
            </p>
            <h1 className="text-xl font-bold leading-tight">{app.position}</h1>
          </div>
        )}

        {/* Statut */}
        <div className="relative inline-block">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity", cfg.cls)}
          >
            {cfg.label} ▾
          </button>
          {statusOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-44">
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Pipeline</p>
                {PIPELINE_STATUSES.map((s) => (
                  <button key={s} onClick={() => pickStatus(s)}
                    className={cn("w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5", s === app.status && "font-semibold")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
                <p className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide border-t border-border/50 pt-1.5">Résultat</p>
                {OUTCOME_STATUSES.map((s) => (
                  <button key={s} onClick={() => pickStatus(s)}
                    className={cn("w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5", s === app.status && "font-semibold")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Stepper pipeline */}
        <PipelineStepper status={app.status} />

        {/* Détails */}
        {editing ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Lieu</label>
                <input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Ex : Lyon" className={cn(inputCls, "mt-1")} />
              </div>
              <div>
                <label className={labelCls}>Mode</label>
                <input value={fWorkMode} onChange={(e) => setFWorkMode(e.target.value)} placeholder="Remote / Hybride / Présentiel" className={cn(inputCls, "mt-1")} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Rémunération (annuel brut €)</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <input type="number" step="1000" min="0" value={fSalaryMin} onChange={(e) => setFSalaryMin(e.target.value)} placeholder="Min" className={inputCls} />
                <input type="number" step="1000" min="0" value={fSalaryMax} onChange={(e) => setFSalaryMax(e.target.value)} placeholder="Max" className={inputCls} />
                <input value={fSalaryNote} onChange={(e) => setFSalaryNote(e.target.value)} placeholder="+ variable…" className={inputCls} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Source</label>
                <input value={fSource} onChange={(e) => setFSource(e.target.value)} placeholder="LinkedIn, cooptation…" className={cn(inputCls, "mt-1")} />
              </div>
              <div>
                <label className={labelCls}>Recruteur (contact)</label>
                <select value={fContactId} onChange={(e) => setFContactId(e.target.value)} className={cn(inputCls, "mt-1")}>
                  <option value="">— Aucun —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Lien de l&apos;offre</label>
                <input type="url" value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" className={cn(inputCls, "mt-1")} />
              </div>
              <div>
                <label className={labelCls}>Date de candidature</label>
                <input type="date" value={fApplied} onChange={(e) => setFApplied(e.target.value)} className={cn(inputCls, "mt-1")} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            {(app.location || app.workMode) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[app.location, app.workMode].filter(Boolean).join(" · ")}
              </div>
            )}
            {salary && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Banknote className="h-3.5 w-3.5 shrink-0" /> {salary}
              </div>
            )}
            {app.source && <p className="text-xs text-muted-foreground">Source : {app.source}</p>}
            {app.url && (
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit">
                <ExternalLink className="h-3 w-3" /> Voir l&apos;offre
              </a>
            )}
            {app.appliedAt && <p className="text-xs text-muted-foreground">Candidaté le {fmtDate(app.appliedAt)}</p>}
            {!app.location && !app.workMode && !salary && !app.source && !app.url && !app.appliedAt && (
              <p className="text-xs text-muted-foreground/50 italic">Aucun détail renseigné.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Bento : détails complémentaires (éditables sur place) ── */}
      <div className="gap-6 lg:columns-2 2xl:columns-3 *:mb-6 *:break-inside-avoid">
        {/* Prochain point */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
          <h2 className={cardTitleCls}>Prochain point</h2>
          {editing ? (
            <div className="space-y-2">
              <input type="date" value={fNextAt} onChange={(e) => setFNextAt(e.target.value)} className={inputCls} />
              <input value={fNextLabel} onChange={(e) => setFNextLabel(e.target.value)} placeholder="Ex : Entretien technique avec le CTO" className={inputCls} />
            </div>
          ) : app.nextActionAt ? (
            <div className={cn("rounded-lg border p-2.5 flex items-center gap-2", nextOverdue ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5")}>
              <CalendarClock className={cn("h-4 w-4 shrink-0", nextOverdue ? "text-red-500" : "text-amber-600")} />
              <div>
                <p className="text-sm font-medium">{app.nextActionLabel ?? "Prochain point"}</p>
                <p className={cn("text-xs", nextOverdue ? "text-red-500" : "text-amber-600")}>
                  {fmtDateTime(app.nextActionAt)}{nextOverdue ? " · en retard" : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">Aucun rendez-vous planifié.</p>
          )}
        </div>

        {/* Dossier de compétences — toujours affiché */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className={cn("h-4 w-4 shrink-0", (editing ? fDossierValidated : app.competencyDossierValidated) ? "text-emerald-600" : "text-muted-foreground")} />
            <h2 className={cardTitleCls}>Dossier de compétences</h2>
            {!editing && (
              <span className={cn(
                "ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                app.competencyDossierValidated
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-500"
              )}>
                {app.competencyDossierValidated ? "Validé" : "À remplir"}
              </span>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={fDossierValidated} onChange={(e) => setFDossierValidated(e.target.checked)} className="rounded border-input accent-primary" />
                Dossier validé
              </label>
              <input type="url" value={fDossierUrl} onChange={(e) => setFDossierUrl(e.target.value)} placeholder="Lien du dossier — https://…" className={inputCls} />
            </div>
          ) : app.competencyDossierUrl ? (
            <a href={app.competencyDossierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit">
              <ExternalLink className="h-3 w-3" /> Consulter le dossier
            </a>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">Aucun lien renseigné.</p>
          )}
        </div>

      {/* Contact recruteur */}
      {app.contact && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recruteur</h2>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <Link
                href={`/contacts/${app.contact.id}`}
                className="font-semibold text-sm hover:text-primary transition-colors"
              >
                {app.contact.name}
              </Link>
              {app.contact.company && (
                <p className="text-xs text-muted-foreground">{app.contact.company}</p>
              )}
            </div>
            {app.contact.linkedinUrl && (
              <a
                href={app.contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md p-1.5 text-sky-600 hover:bg-sky-500/10 transition-colors"
                title="Voir sur LinkedIn"
              >
                <LinkedinIcon className="h-4 w-4" />
              </a>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {app.contact.email && (
              <a href={`mailto:${app.contact.email}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {app.contact.email}
              </a>
            )}
            {app.contact.phone && (
              <a href={`tel:${app.contact.phone}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {app.contact.phone}
              </a>
            )}
          </div>
          {app.contact.notes && (
            <p className="text-xs text-muted-foreground/70 italic leading-relaxed border-t border-border/30 pt-2">
              {app.contact.notes}
            </p>
          )}
        </div>
      )}

        {/* Notes */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
          <h2 className={cardTitleCls}>Notes</h2>
          {editing ? (
            <textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={4}
              placeholder="Contexte, impressions, points d'attention…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          ) : app.notes ? (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{app.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">Pas de notes.</p>
          )}
        </div>
      </div>{/* fin Bento */}

      {/* Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Historique{sortedEvents.length > 0 ? ` (${sortedEvents.length})` : ""}
          </h2>
          <button
            onClick={() => setShowAddEvent((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Ajouter un point
          </button>
        </div>

        {/* Add event form */}
        {showAddEvent && (
          <form onSubmit={submitEvent} className="rounded-xl border border-border/50 bg-card p-3 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">Nouveau point de contact</p>
            <div className="flex flex-wrap gap-1">
              {EVENT_TYPES.map((t) => {
                const ec = EVENT_TYPE_CONFIG[t]
                return (
                  <button
                    key={t} type="button" onClick={() => setEvType(t)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                      evType === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {ec.icon} {ec.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="datetime-local" value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={evTitle} onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Résumé…" autoFocus required
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <textarea
              value={evNotes} onChange={(e) => setEvNotes(e.target.value)}
              placeholder="Notes (optionnel)"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddEvent(false)}
                className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={!evTitle.trim()}
                className="h-7 px-3 rounded-md bg-primary text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors">
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {/* Ligne verticale + events */}
        {sortedEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2">
            Aucun point de contact enregistré.
          </p>
        ) : (
          <div className="relative space-y-3">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/50" />
            {sortedEvents.map((ev) => (
              <EventRow key={ev.id} ev={ev} onDelete={handleDeleteEvent} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
