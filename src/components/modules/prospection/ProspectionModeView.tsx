"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Phone, PhoneMissed,
  Mail, ThumbsUp, ThumbsDown, CalendarCheck, Trophy, XCircle, Plus,
  Pencil, Trash2, Globe, MapPin, User, Gauge, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { STATUS_CONFIG, WEBSITE_TYPE_CONFIG } from "./status-config"
import {
  logProspectAction, updateProspectStatus,
  createProspectNote, updateProspectNote, deleteProspectNote,
} from "@/actions/prospection"
import type { ProspectStatus, ProspectEventKind, WebsiteType } from "@/generated/prisma/enums"

type ModeNote = { id: string; title: string; content: string | null; createdAt: Date | string }
type ModeEvent = {
  id: string
  kind: ProspectEventKind
  fromStatus: ProspectStatus | null
  toStatus: ProspectStatus | null
  note: string | null
  date: Date | string
}

export type ModeProspect = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  city: string | null
  region: string | null
  prospectStatus: string
  websiteUrl: string | null
  websiteType: string | null
  businessDescription: string | null
  cms: string | null
  seoScore: number | null
  performanceScore: number | null
  seoIssues: string | null
  publicationManager: string | null
  domainCreatedAt: Date | string | null
  prospectNotes: ModeNote[]
  prospectEvents: ModeEvent[]
}

const EVENT_CONFIG: Record<ProspectEventKind, { label: string; dot: string }> = {
  CALL_ANSWERED:  { label: "Appel — a répondu",      dot: "bg-emerald-400" },
  CALL_NO_ANSWER: { label: "Appel — pas de réponse", dot: "bg-red-400" },
  EMAIL_SENT:     { label: "Email envoyé",           dot: "bg-blue-400" },
  REPLY_POSITIVE: { label: "Réponse positive",       dot: "bg-emerald-500" },
  REPLY_NEGATIVE: { label: "Réponse négative",       dot: "bg-red-400" },
  MEETING_BOOKED: { label: "Rendez-vous fixé",       dot: "bg-violet-400" },
  STATUS_CHANGE:  { label: "Statut modifié",         dot: "bg-slate-400" },
}

const QUICK_ACTIONS: { kind: Exclude<ProspectEventKind, "STATUS_CHANGE">; label: string; icon: React.ElementType }[] = [
  { kind: "CALL_ANSWERED",  label: "Appel — a répondu",  icon: Phone },
  { kind: "CALL_NO_ANSWER", label: "Pas de réponse",     icon: PhoneMissed },
  { kind: "EMAIL_SENT",     label: "Email envoyé",       icon: Mail },
  { kind: "REPLY_POSITIVE", label: "Réponse positive",   icon: ThumbsUp },
  { kind: "REPLY_NEGATIVE", label: "Réponse négative",   icon: ThumbsDown },
  { kind: "MEETING_BOOKED", label: "RDV fixé",           icon: CalendarCheck },
]

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) +
  " · " + new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

const domainAge = (d: Date | string | null) => {
  if (!d) return null
  const years = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000)
  return years >= 1 ? `${Math.floor(years)} an${years >= 2 ? "s" : ""}` : "moins d'un an"
}

/**
 * Mode prospection : session de démarchage. Toute l'activité (frise, statut,
 * notes) est tenue en état LOCAL et mise à jour depuis les retours des server
 * actions — aucun re-rendu serveur pendant la session, la frise réagit
 * immédiatement. On ne passe JAMAIS au prospect suivant automatiquement :
 * navigation manuelle (boutons ou ← →).
 */
export function ProspectionModeView({ prospects }: { prospects: ModeProspect[] }) {
  const [index, setIndex] = useState(0)
  const [isPending, startTransition] = useTransition()

  // État local de session, initialisé depuis le serveur
  const [statusById, setStatusById] = useState<Record<string, ProspectStatus>>(
    () => Object.fromEntries(prospects.map((p) => [p.id, p.prospectStatus as ProspectStatus]))
  )
  const [eventsById, setEventsById] = useState<Record<string, ModeEvent[]>>(
    () => Object.fromEntries(prospects.map((p) => [p.id, p.prospectEvents]))
  )
  const [notesById, setNotesById] = useState<Record<string, ModeNote[]>>(
    () => Object.fromEntries(prospects.map((p) => [p.id, p.prospectNotes]))
  )
  // Prospects « traités » pendant cette session (au moins une action loggée)
  const [handled, setHandled] = useState<Set<string>>(new Set())

  const prospect = prospects[Math.min(index, prospects.length - 1)]
  const status = STATUS_CONFIG[statusById[prospect.id]] ?? STATUS_CONFIG.TO_CONTACT
  const events = eventsById[prospect.id] ?? []
  const notes = notesById[prospect.id] ?? []

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setIndex((i) => Math.min(prospects.length - 1, i + 1)), [prospects.length])

  // Navigation clavier ← → (hors champs de saisie)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [goPrev, goNext])

  function markHandled(id: string) {
    setHandled((prev) => new Set(prev).add(id))
  }

  function runAction(kind: Exclude<ProspectEventKind, "STATUS_CHANGE">) {
    const id = prospect.id
    startTransition(async () => {
      const { status: newStatus, event } = await logProspectAction(id, kind)
      setStatusById((prev) => ({ ...prev, [id]: newStatus }))
      setEventsById((prev) => ({ ...prev, [id]: [event as ModeEvent, ...(prev[id] ?? [])] }))
      markHandled(id)
      toast.success(`${EVENT_CONFIG[kind].label} — statut : ${STATUS_CONFIG[newStatus].label}`)
    })
  }

  function setOutcome(target: ProspectStatus) {
    const id = prospect.id
    const from = statusById[id]
    startTransition(async () => {
      await updateProspectStatus(id, target)
      setStatusById((prev) => ({ ...prev, [id]: target }))
      if (from !== target) {
        // Miroir local de l'événement STATUS_CHANGE créé côté serveur
        const local: ModeEvent = {
          id: `local-${Date.now()}`, kind: "STATUS_CHANGE",
          fromStatus: from, toStatus: target, note: null, date: new Date(),
        }
        setEventsById((prev) => ({ ...prev, [id]: [local, ...(prev[id] ?? [])] }))
      }
      markHandled(id)
      toast.success(`Statut : ${STATUS_CONFIG[target].label}`)
    })
  }

  const siteType = prospect.websiteType ? WEBSITE_TYPE_CONFIG[prospect.websiteType as WebsiteType] : null
  const issues = useMemo(
    () => (prospect.seoIssues ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    [prospect.seoIssues]
  )

  return (
    <div className="space-y-5">
      {/* ── Barre de session : retour, progression (traités), navigation ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/prospection"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Prospection
        </Link>
        <div className="flex-1 min-w-40 max-w-md space-y-1">
          <p className="text-xs text-muted-foreground text-center">
            Prospect <span className="font-semibold text-foreground">{index + 1} / {prospects.length}</span>
            {" · "}
            <span className={handled.size > 0 ? "text-emerald-600 font-medium" : ""}>{handled.size} traité{handled.size > 1 ? "s" : ""}</span>
          </p>
          {/* La barre reflète les prospects TRAITÉS (une action loggée), pas la position */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(handled.size / prospects.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
            title="Prospect précédent (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            disabled={index === prospects.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
            title="Prospect suivant (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* ── Colonne fiche ── */}
        <div className="xl:col-span-3 space-y-5">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold tracking-tight leading-tight flex items-center gap-2">
                  {prospect.name}
                  {handled.has(prospect.id) && <Check className="h-5 w-5 text-emerald-500" aria-label="Traité pendant cette session" />}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  {prospect.company && <span>{prospect.company}</span>}
                  {(prospect.city || prospect.region) && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{prospect.city ?? prospect.region}</span>
                  )}
                </p>
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", status.cls)}>
                {status.label}
              </span>
            </div>

            {prospect.businessDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">{prospect.businessDescription}</p>
            )}

            {/* Coordonnées cliquables */}
            <div className="flex flex-wrap gap-2 text-sm">
              {prospect.phone && (
                <a href={`tel:${prospect.phone}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input hover:bg-muted/50 transition-colors">
                  <Phone className="h-3.5 w-3.5" /> {prospect.phone}
                </a>
              )}
              {prospect.email && (
                <a href={`mailto:${prospect.email}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input hover:bg-muted/50 transition-colors max-w-64">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{prospect.email}</span>
                </a>
              )}
              {prospect.publicationManager && (
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/50 text-muted-foreground" title="Responsable de publication (mentions légales)">
                  <User className="h-3.5 w-3.5" /> {prospect.publicationManager}
                </span>
              )}
            </div>

            {/* Signaux site / SEO */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
              {siteType && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", siteType.cls)}>{siteType.label}</span>}
              {prospect.cms && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-500/15 text-amber-700" title="CMS détecté — le signal de prospection">
                  {prospect.cms}
                </span>
              )}
              {prospect.domainCreatedAt && (
                <span className="text-xs text-muted-foreground">domaine : {domainAge(prospect.domainCreatedAt)}</span>
              )}
              {prospect.seoScore != null && <ScoreBar label="SEO" value={prospect.seoScore} />}
              {prospect.performanceScore != null && <ScoreBar label="Perf" value={prospect.performanceScore} />}
            </div>

            {issues.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Problèmes détectés — matière des mails</p>
                <ul className="text-sm text-muted-foreground space-y-0.5 list-disc pl-4">
                  {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Site web — carte lien */}
          {prospect.websiteUrl && (
            <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{prospect.websiteUrl}</span>
              </div>
              <a
                href={prospect.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
              >
                Ouvrir le site <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Frise chronologique */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">Frise chronologique</h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun événement — première prise de contact à tracer.</p>
            ) : (
              <ol className="relative space-y-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                {events.map((ev) => {
                  const cfg = EVENT_CONFIG[ev.kind]
                  return (
                    <li key={ev.id} className="relative">
                      <span className={cn("absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card", cfg.dot)} />
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-tight">{cfg.label}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(ev.date)}</p>
                      </div>
                      {ev.fromStatus && ev.toStatus && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                          <span className={cn("rounded-full border px-1.5 py-px", STATUS_CONFIG[ev.fromStatus].cls)}>{STATUS_CONFIG[ev.fromStatus].label}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className={cn("rounded-full border px-1.5 py-px", STATUS_CONFIG[ev.toStatus].cls)}>{STATUS_CONFIG[ev.toStatus].label}</span>
                        </p>
                      )}
                      {ev.note && <p className="text-xs text-muted-foreground mt-1">{ev.note}</p>}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        {/* ── Colonne process : actions rapides + notes intégrées ── */}
        <div className="xl:col-span-2 space-y-5">
          <ActionsCard
            key={prospect.id}
            isPending={isPending}
            notes={notes}
            clientId={prospect.id}
            onAction={runAction}
            onOutcome={setOutcome}
            onNotesChange={(next) => setNotesById((prev) => ({ ...prev, [prospect.id]: next }))}
            onHandled={() => markHandled(prospect.id)}
          />
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-400"
  return (
    <span className="inline-flex items-center gap-1.5" title={`Score ${label} : ${value}/100`}>
      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </span>
      <span className="text-xs font-medium tabular-nums">{value}</span>
    </span>
  )
}

function ActionsCard({
  clientId, notes, isPending, onAction, onOutcome, onNotesChange, onHandled,
}: {
  clientId: string
  notes: ModeNote[]
  isPending: boolean
  onAction: (kind: Exclude<ProspectEventKind, "STATUS_CHANGE">) => void
  onOutcome: (status: ProspectStatus) => void
  onNotesChange: (notes: ModeNote[]) => void
  onHandled: () => void
}) {
  const [isSaving, startSave] = useTransition()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  function openAdd() {
    setFormOpen(true)
    setEditingId(null)
    setTitle("")
    setContent("")
  }

  function openEdit(note: ModeNote) {
    setFormOpen(true)
    setEditingId(note.id)
    setTitle(note.title)
    setContent(note.content ?? "")
  }

  function cancel() {
    setFormOpen(false)
    setEditingId(null)
  }

  function save() {
    if (!title.trim()) return
    startSave(async () => {
      if (editingId) {
        await updateProspectNote(editingId, { title, content })
        onNotesChange(notes.map((n) => (n.id === editingId ? { ...n, title: title.trim(), content: content.trim() || null } : n)))
      } else {
        const created = await createProspectNote(clientId, { title, content })
        onNotesChange([created as ModeNote, ...notes])
        onHandled()
      }
      cancel()
      toast.success("Note enregistrée")
    })
  }

  function remove(noteId: string) {
    startSave(async () => {
      await deleteProspectNote(noteId)
      onNotesChange(notes.filter((n) => n.id !== noteId))
      if (editingId === noteId) cancel()
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <h2 className="font-semibold text-sm">Actions rapides</h2>

      {/* Chaque action ajoute un événement à la frise et avance le statut si
          besoin — on RESTE sur le prospect courant (passage au suivant manuel) */}
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            onClick={() => onAction(kind)}
            disabled={isPending}
            className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input text-sm hover:bg-muted/50 disabled:opacity-50 transition-colors text-left"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </button>
        ))}
        {/* + Note fait partie des actions rapides */}
        <button
          onClick={openAdd}
          disabled={isPending || formOpen}
          className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50 transition-colors text-left"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="truncate">Ajouter une note</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
        <button
          onClick={() => onOutcome("WON")}
          disabled={isPending}
          className="flex items-center justify-center gap-2 h-10 px-3 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
        >
          <Trophy className="h-4 w-4" /> Gagné 🎉
        </button>
        <button
          onClick={() => onOutcome("LOST")}
          disabled={isPending}
          className="flex items-center justify-center gap-2 h-10 px-3 rounded-lg bg-red-500/10 text-red-600 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-4 w-4" /> Perdu
        </button>
      </div>

      {/* Formulaire de note, directement dans la carte */}
      {formOpen && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre — ex. Premier appel"
            autoFocus
            className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenu — ex. pas de réponse, rappeler la semaine prochaine…"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
              Annuler
            </button>
            <button
              onClick={save}
              disabled={isSaving || !title.trim()}
              className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSaving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </div>
      )}

      {/* Notes affichées directement dans la carte */}
      {notes.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes ({notes.length})</p>
          {notes.map((note) => (
            <div key={note.id} className="group rounded-lg border border-border/50 p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{note.title}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(note)} className="text-muted-foreground hover:text-foreground transition-colors" title="Modifier">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(note.id)} disabled={isSaving} className="text-muted-foreground hover:text-red-500 transition-colors" title="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {note.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>}
              <p className="text-[11px] text-muted-foreground/70">{fmtDate(note.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
