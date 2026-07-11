"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  Mail, Phone, ExternalLink, Building2, Pencil, Plus,
  MapPin, Banknote, CalendarClock, Trash2, ArrowRight, Ban, FileText,
} from "lucide-react"
import { LinkedinIcon } from "@/components/ui/linkedin-icon"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateApplicationStatus, addApplicationEvent, deleteApplicationEvent } from "@/actions/entretien"
import {
  STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, EVENT_TYPE_CONFIG,
  type JobAppStatus,
} from "./status-config"
import type { JobApp } from "./EntretienView"
import type { JobEventType } from "@/generated/prisma/enums"

const fmt = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })

function salaryLabel(app: JobApp): string | null {
  const fmtK = (n: number) => `${(n / 1000).toFixed(0)}k`
  if (app.salaryMin && app.salaryMax) return `${fmtK(app.salaryMin)} – ${fmtK(app.salaryMax)} €`
  if (app.salaryMin) return `dès ${fmtK(app.salaryMin)} €`
  if (app.salaryMax) return `jusqu'à ${fmtK(app.salaryMax)} €`
  return app.salaryNote ?? null
}

const EVENT_TYPES: JobEventType[] = [
  "APPLICATION", "CALL", "VIDEO", "ONSITE", "EMAIL", "MESSAGE", "TECHNICAL_TEST", "OFFER", "OTHER",
]

export function ApplicationPanel({ app, onEdit }: { app: JobApp; onEdit: () => void }) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [, startStatus] = useTransition()
  const [, startEvent] = useTransition()

  // Formulaire add event
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [evType, setEvType]   = useState<JobEventType>("CALL")
  const [evTitle, setEvTitle] = useState("")
  const [evDate, setEvDate]   = useState(() => new Date().toISOString().split("T")[0])
  const [evNotes, setEvNotes] = useState("")

  const cfg = STATUS_CONFIG[app.status as JobAppStatus] ?? STATUS_CONFIG.WISHLIST
  const salary = salaryLabel(app)
  const nextOverdue = app.nextActionAt && new Date(app.nextActionAt) < new Date()

  function pickStatus(s: JobAppStatus) {
    setStatusOpen(false)
    startStatus(async () => {
      await updateApplicationStatus(app.id, s)
      toast.success(`Statut : ${STATUS_CONFIG[s].label}`)
    })
  }

  function submitEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!evTitle.trim()) return
    startEvent(async () => {
      await addApplicationEvent(app.id, { date: evDate, type: evType, title: evTitle, notes: evNotes })
      setEvTitle(""); setEvNotes(""); setShowAddEvent(false)
      toast.success("Point de contact enregistré")
    })
  }

  function removeEvent(id: string) {
    startEvent(async () => {
      await deleteApplicationEvent(id)
      toast.success("Événement supprimé")
    })
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-5 pr-10 border-b border-border/50 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {app.companyName}
            </p>
            <h2 className="text-xl font-bold leading-tight">{app.position}</h2>
          </div>
          <button onClick={onEdit} title="Modifier" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* Statut (dropdown) */}
        <div className="relative inline-block">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity", cfg.cls)}
          >
            {cfg.label}
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

        {/* Meta */}
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
          {app.source && (
            <p className="text-xs text-muted-foreground">Source : {app.source}</p>
          )}
          {app.url && (
            <a href={app.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit">
              <ExternalLink className="h-3 w-3" /> Voir l&apos;offre
            </a>
          )}
        </div>

        {/* Recruteur */}
        {app.contact && (
          <div className="rounded-lg border border-border/50 p-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Recruteur</p>
            <div className="flex items-center justify-between gap-2">
              <Link href={`/contacts/${app.contact.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                {app.contact.name}
              </Link>
              {(app.contact as { linkedinUrl?: string | null }).linkedinUrl && (
                <a
                  href={(app.contact as { linkedinUrl?: string | null }).linkedinUrl!}
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-md p-1 text-sky-600 hover:bg-sky-500/10 transition-colors"
                  title="LinkedIn"
                >
                  <LinkedinIcon className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              {app.contact.email && (
                <a href={`mailto:${app.contact.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Mail className="h-3 w-3" /> {app.contact.email}
                </a>
              )}
              {app.contact.phone && (
                <a href={`tel:${app.contact.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Phone className="h-3 w-3" /> {app.contact.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Prochain point */}
        {app.nextActionAt && (
          <div className={cn(
            "rounded-lg border p-2.5 flex items-center gap-2",
            nextOverdue ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"
          )}>
            <CalendarClock className={cn("h-4 w-4 shrink-0", nextOverdue ? "text-red-500" : "text-amber-600")} />
            <div>
              <p className="text-sm font-medium">{app.nextActionLabel ?? "Prochain point"}</p>
              <p className={cn("text-xs", nextOverdue ? "text-red-500" : "text-amber-600")}>
                {fmt(app.nextActionAt)}{nextOverdue ? " · en retard" : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {app.notes && (
        <div className="p-4 border-b border-border/50">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{app.notes}</p>
        </div>
      )}

      {/* Timeline événements */}
      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Historique {app.events.length > 0 && <span className="text-muted-foreground/60">({app.events.length})</span>}
          </h3>
          <button
            onClick={() => setShowAddEvent((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Ajouter un point
          </button>
        </div>

        {/* Add event form */}
        {showAddEvent && (
          <form onSubmit={submitEvent} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
            <div className="flex flex-wrap gap-1">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t} type="button" onClick={() => setEvType(t)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    evType === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {EVENT_TYPE_CONFIG[t].icon} {EVENT_TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={evTitle} onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Résumé…" autoFocus
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <input
              value={evNotes} onChange={(e) => setEvNotes(e.target.value)}
              placeholder="Notes (optionnel)"
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddEvent(false)} className="text-xs text-muted-foreground hover:text-foreground">Annuler</button>
              <button type="submit" disabled={!evTitle.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors">
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {app.events.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">Aucun point de contact enregistré.</p>
        ) : (
          <div className="space-y-1.5">
            {app.events.map((ev) => {
              const ec = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.OTHER
              const isCancelled = !!(ev as { cancelledAt?: Date | string | null }).cancelledAt
              const outcome = (ev as { outcome?: string | null }).outcome
              return (
                <div key={ev.id} className={cn("flex items-start gap-2 rounded-lg border border-border/50 p-2 group", isCancelled && "opacity-50")}>
                  <span className="text-base shrink-0">{ec.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">{fmt(ev.date)}</p>
                      <span className="text-[10px] text-muted-foreground/60">{ec.label}</span>
                      {isCancelled && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Ban className="h-2.5 w-2.5" /> Annulé
                        </span>
                      )}
                    </div>
                    <p className={cn("text-sm", isCancelled && "line-through text-muted-foreground")}>{ev.title}</p>
                    {ev.notes && <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>}
                    {outcome && (
                      <p className="text-xs text-muted-foreground/70 italic mt-0.5 flex items-start gap-1">
                        <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                        {outcome.length > 120 ? outcome.slice(0, 120) + "…" : outcome}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeEvent(ev.id)}
                    className="text-muted-foreground/40 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50 space-y-2">
        <Link
          href={`/entretiens/${app.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Voir le process complet <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={onEdit}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/50 px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> Modifier la candidature
        </button>
      </div>
    </div>
  )
}
