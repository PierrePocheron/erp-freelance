"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Phone, PhoneMissed,
  Mail, ThumbsUp, ThumbsDown, CalendarCheck, Trophy, XCircle, Plus,
  Pencil, Trash2, Globe, MapPin, User, Gauge, Check, StickyNote,
  Send, NotebookPen, AlertTriangle, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { STATUS_CONFIG, WEBSITE_TYPE_CONFIG } from "./status-config"
import { SendEmailDialog, type EmailTemplateOption, type SendTarget } from "./SendEmailDialog"
import { PrepareDraftsDialog } from "./PrepareDraftsDialog"
import { renderTemplate } from "@/lib/email-template"
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
  firstName: string | null
  lastName: string | null
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

// Température du prospect à l'issue d'un appel où il a répondu
const CALL_TEMP = {
  HOT:  { label: "Chaud", emoji: "🔥", cls: "bg-red-500/15 text-red-600 border-red-500/40" },
  WARM: { label: "Tiède", emoji: "🙂", cls: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  COLD: { label: "Froid", emoji: "❄️", cls: "bg-blue-500/15 text-blue-600 border-blue-500/40" },
} as const
type CallTemp = keyof typeof CALL_TEMP

const QUICK_ACTIONS: { kind: Exclude<ProspectEventKind, "STATUS_CHANGE">; label: string; icon: React.ElementType }[] = [
  { kind: "CALL_ANSWERED",  label: "Appel — a répondu",  icon: Phone },
  { kind: "CALL_NO_ANSWER", label: "Pas de réponse",     icon: PhoneMissed },
  { kind: "EMAIL_SENT",     label: "Email envoyé",       icon: Mail },
  { kind: "REPLY_POSITIVE", label: "Réponse positive",   icon: ThumbsUp },
  { kind: "REPLY_NEGATIVE", label: "Réponse négative",   icon: ThumbsDown },
  { kind: "MEETING_BOOKED", label: "RDV fixé",           icon: CalendarCheck },
]

// Frise unifiée : événements + notes, triés par date
type TimelineItem =
  | { type: "event"; date: Date; ev: ModeEvent }
  | { type: "note"; date: Date; note: ModeNote }

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
 * actions — la frise réagit immédiatement. Les notes vivent DANS la frise, à
 * leur date de création. Navigation entre prospects strictement manuelle.
 */
export function ProspectionModeView({
  prospects,
  templates,
  callTemplates,
  emailFromConfigured,
}: {
  prospects: ModeProspect[]
  templates: EmailTemplateOption[]
  callTemplates: { id: string; name: string; script: string }[]
  emailFromConfigured: boolean
}) {
  // Liste FIGÉE au montage : la session reste sur les X prospects choisis au
  // départ, quoi qu'il arrive côté serveur. Un rafraîchissement post-action
  // (Next re-rend la route) ne peut donc ni retirer un prospect passé « Perdu »,
  // ni en réinjecter un nouveau — le compteur « traités » reste borné par X.
  const [sessionProspects] = useState(() => prospects)

  const [index, setIndex] = useState(0)
  const [isPending, startTransition] = useTransition()

  // Carte email : modèle choisi + dialogs d'envoi/brouillon
  const [templateId, setTemplateId] = useState("")
  const [sendOpen, setSendOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)

  // Carte script d'appel : modèle d'appel choisi (affiché pour lecture pendant
  // l'appel) + formulaire « a répondu » (température du prospect + note).
  const [callTemplateId, setCallTemplateId] = useState("")
  const [callFormOpen, setCallFormOpen] = useState(false)
  const [callTemp, setCallTemp] = useState<"HOT" | "WARM" | "COLD" | null>(null)
  const [callNote, setCallNote] = useState("")

  // État local de session, initialisé depuis le serveur
  const [statusById, setStatusById] = useState<Record<string, ProspectStatus>>(
    () => Object.fromEntries(sessionProspects.map((p) => [p.id, p.prospectStatus as ProspectStatus]))
  )
  const [eventsById, setEventsById] = useState<Record<string, ModeEvent[]>>(
    () => Object.fromEntries(sessionProspects.map((p) => [p.id, p.prospectEvents]))
  )
  const [notesById, setNotesById] = useState<Record<string, ModeNote[]>>(
    () => Object.fromEntries(sessionProspects.map((p) => [p.id, p.prospectNotes]))
  )
  // Prospects « traités » pendant cette session (au moins une action loggée)
  const [handled, setHandled] = useState<Set<string>>(new Set())

  // Formulaire de note (dans la carte Actions rapides)
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [isSavingNote, startSaveNote] = useTransition()

  const prospect = sessionProspects[Math.min(index, sessionProspects.length - 1)]
  const status = STATUS_CONFIG[statusById[prospect.id]] ?? STATUS_CONFIG.TO_CONTACT

  const timeline: TimelineItem[] = useMemo(() => {
    const events = eventsById[prospect.id] ?? []
    const notes = notesById[prospect.id] ?? []
    return [
      ...events.map((ev) => ({ type: "event" as const, date: new Date(ev.date), ev })),
      ...notes.map((note) => ({ type: "note" as const, date: new Date(note.createdAt), note })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [eventsById, notesById, prospect.id])

  const closeNoteForm = useCallback(() => {
    setNoteFormOpen(false)
    setEditingNoteId(null)
    setNoteTitle("")
    setNoteContent("")
    setCallFormOpen(false)
  }, [])

  const goPrev = useCallback(() => { setIndex((i) => Math.max(0, i - 1)); closeNoteForm() }, [closeNoteForm])
  const goNext = useCallback(() => { setIndex((i) => Math.min(sessionProspects.length - 1, i + 1)); closeNoteForm() }, [sessionProspects.length, closeNoteForm])

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

  function runAction(kind: Exclude<ProspectEventKind, "STATUS_CHANGE">, note?: string) {
    const id = prospect.id
    startTransition(async () => {
      const { status: newStatus, event } = await logProspectAction(id, kind, note)
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

  // Après un envoi Resend : reflète localement ce que fait le serveur
  // (événement EMAIL_SENT + passage TO_CONTACT → CONTACTED), sans re-fetch.
  function handleEmailSent() {
    const id = prospect.id
    const from = statusById[id]
    const to: ProspectStatus = from === "TO_CONTACT" ? "CONTACTED" : from
    const local: ModeEvent = {
      id: `local-${Date.now()}`, kind: "EMAIL_SENT",
      fromStatus: from !== to ? from : null,
      toStatus: from !== to ? to : null,
      note: selectedTemplate ? `Email « ${selectedTemplate.name} »` : null,
      date: new Date(),
    }
    setEventsById((prev) => ({ ...prev, [id]: [local, ...(prev[id] ?? [])] }))
    if (from !== to) setStatusById((prev) => ({ ...prev, [id]: to }))
    markHandled(id)
  }

  // ── Appel : script sélectionné + formulaire « a répondu » ──────────────────
  const selectedCall = callTemplates.find((t) => t.id === callTemplateId) ?? null

  function openCallForm() {
    setCallFormOpen(true)
    setCallTemp(null)
    setCallNote("")
    setNoteFormOpen(false)
  }
  function closeCallForm() {
    setCallFormOpen(false)
    setCallTemp(null)
    setCallNote("")
  }
  // Enregistre l'appel « a répondu » : compose la note (script utilisé +
  // température + précision libre) et la loggue comme événement CALL_ANSWERED.
  function submitCall() {
    if (!callTemp) return
    const parts: string[] = []
    if (selectedCall) parts.push(`Script « ${selectedCall.name} »`)
    parts.push(`${CALL_TEMP[callTemp].emoji} Client ${CALL_TEMP[callTemp].label.toLowerCase()}`)
    let note = parts.join(" · ")
    if (callNote.trim()) note += ` — ${callNote.trim()}`
    runAction("CALL_ANSWERED", note)
    closeCallForm()
  }

  function openAddNote() {
    setNoteFormOpen(true)
    setEditingNoteId(null)
    setNoteTitle("")
    setNoteContent("")
    setCallFormOpen(false)
  }

  function openEditNote(note: ModeNote) {
    setNoteFormOpen(true)
    setEditingNoteId(note.id)
    setNoteTitle(note.title)
    setNoteContent(note.content ?? "")
  }

  function saveNote() {
    if (!noteTitle.trim()) return
    const id = prospect.id
    startSaveNote(async () => {
      if (editingNoteId) {
        await updateProspectNote(editingNoteId, { title: noteTitle, content: noteContent })
        setNotesById((prev) => ({
          ...prev,
          [id]: (prev[id] ?? []).map((n) =>
            n.id === editingNoteId ? { ...n, title: noteTitle.trim(), content: noteContent.trim() || null } : n
          ),
        }))
      } else {
        const created = await createProspectNote(id, { title: noteTitle, content: noteContent })
        setNotesById((prev) => ({ ...prev, [id]: [created as ModeNote, ...(prev[id] ?? [])] }))
        markHandled(id)
      }
      closeNoteForm()
      toast.success("Note enregistrée")
    })
  }

  function removeNote(noteId: string) {
    const id = prospect.id
    startSaveNote(async () => {
      await deleteProspectNote(noteId)
      setNotesById((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((n) => n.id !== noteId) }))
      if (editingNoteId === noteId) closeNoteForm()
    })
  }

  const siteType = prospect.websiteType ? WEBSITE_TYPE_CONFIG[prospect.websiteType as WebsiteType] : null
  const issues = useMemo(
    () => (prospect.seoIssues ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    [prospect.seoIssues]
  )

  // Cible d'envoi (les dialogs partagés du tableau attendent un tableau) —
  // le prospect courant, avec toutes les variables d'enrichissement.
  const sendTarget: SendTarget = useMemo(() => ({
    id: prospect.id,
    email: prospect.email,
    name: prospect.name,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    company: prospect.company,
    websiteUrl: prospect.websiteUrl,
    city: prospect.city,
    region: prospect.region,
    businessDescription: prospect.businessDescription,
    cms: prospect.cms,
    seoScore: prospect.seoScore,
    performanceScore: prospect.performanceScore,
    seoIssues: prospect.seoIssues,
    publicationManager: prospect.publicationManager,
    domainCreatedAt: prospect.domainCreatedAt,
  }), [prospect])

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null
  // Aperçu du sujet rendu + variables manquantes pour ce prospect
  const preview = useMemo(
    () => (selectedTemplate ? renderTemplate(selectedTemplate, sendTarget) : null),
    [selectedTemplate, sendTarget]
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
            Prospect <span className="font-semibold text-foreground">{index + 1} / {sessionProspects.length}</span>
            {" · "}
            <span className={handled.size > 0 ? "text-emerald-600 font-medium" : ""}>{handled.size} traité{handled.size > 1 ? "s" : ""}</span>
          </p>
          {/* La barre reflète les prospects TRAITÉS (une action loggée), pas la position */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(handled.size / sessionProspects.length) * 100}%` }}
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
            disabled={index === sessionProspects.length - 1}
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

          {/* Email personnalisé — même circuit contrôlé que le tableau
              (aperçu par modèle, envoi Resend ou file de brouillons) */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Email personnalisé</h2>
            </div>

            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun modèle de mail.{" "}
                <Link href="/prospection/modeles" className="text-primary hover:underline">Créer un modèle →</Link>
              </p>
            ) : !prospect.email ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Ce prospect n&apos;a pas d&apos;adresse email renseignée.
              </p>
            ) : (
              <>
                <div className="relative">
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full h-9 appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Choisir un modèle…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>

                {preview && (
                  <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/50">
                      <p className="text-xs">
                        <span className="font-medium">Objet :</span>{" "}
                        <span className="text-muted-foreground">{preview.subject}</span>
                      </p>
                    </div>
                    {/* Corps complet, défilable si long — on voit tout le mail */}
                    <div className="px-3 py-2 max-h-64 overflow-y-auto">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{preview.body}</p>
                    </div>
                    {preview.missing.length > 0 && (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1 px-3 py-2 border-t border-amber-500/20 bg-amber-500/5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Variables manquantes : {preview.missing.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setSendOpen(true)}
                    disabled={!templateId}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                    title={emailFromConfigured ? "Envoyer via Resend après récapitulatif" : "Adresse d'envoi non configurée — préparez un brouillon"}
                  >
                    <Send className="h-3.5 w-3.5" /> Envoyer
                  </button>
                  <button
                    onClick={() => setDraftsOpen(true)}
                    disabled={!templateId}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-input text-sm font-medium hover:bg-muted/50 disabled:opacity-40 transition-colors"
                    title="Génère un brouillon relisable dans la file — rien n'est envoyé"
                  >
                    <NotebookPen className="h-3.5 w-3.5" /> Brouillon
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Script d'appel — modèle choisi, affiché pour lecture pendant l'appel */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Script d&apos;appel</h2>
            </div>
            {callTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun script d&apos;appel.{" "}
                <Link href="/prospection/appels" className="text-primary hover:underline">Créer un script →</Link>
              </p>
            ) : (
              <>
                <div className="relative">
                  <select
                    value={callTemplateId}
                    onChange={(e) => setCallTemplateId(e.target.value)}
                    className="w-full h-9 appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Choisir un script…</option>
                    {callTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                {selectedCall && (
                  <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 max-h-72 overflow-y-auto">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedCall.script}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Colonne process : actions rapides puis frise ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Actions rapides — chaque action alimente la frise et avance le
              statut si besoin ; on RESTE sur le prospect courant */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="font-semibold text-sm">Actions rapides</h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  onClick={() => (kind === "CALL_ANSWERED" ? openCallForm() : runAction(kind))}
                  disabled={isPending || (kind === "CALL_ANSWERED" && callFormOpen)}
                  className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input text-sm hover:bg-muted/50 disabled:opacity-50 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
              <button
                onClick={openAddNote}
                disabled={isPending || noteFormOpen}
                className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50 transition-colors text-left"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Ajouter une note</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
              <button
                onClick={() => setOutcome("WON")}
                disabled={isPending}
                className="flex items-center justify-center gap-2 h-10 px-3 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
              >
                <Trophy className="h-4 w-4" /> Gagné 🎉
              </button>
              <button
                onClick={() => setOutcome("LOST")}
                disabled={isPending}
                className="flex items-center justify-center gap-2 h-10 px-3 rounded-lg bg-red-500/10 text-red-600 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-4 w-4" /> Perdu
              </button>
            </div>

            {/* Formulaire de note, directement dans la carte */}
            {noteFormOpen && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Titre — ex. Premier appel"
                  autoFocus
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Contenu — ex. pas de réponse, rappeler la semaine prochaine…"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={closeNoteForm} className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Annuler
                  </button>
                  <button
                    onClick={saveNote}
                    disabled={isSavingNote || !noteTitle.trim()}
                    className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isSavingNote ? "Enregistrement…" : editingNoteId ? "Enregistrer" : "Ajouter"}
                  </button>
                </div>
              </div>
            )}

            {/* Formulaire « Appel — a répondu » : quel script + température */}
            {callFormOpen && (
              <div className="space-y-2.5 rounded-lg border border-border p-3">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-500" /> Appel — a répondu
                </p>
                {selectedCall ? (
                  <p className="text-[11px] text-muted-foreground">Script utilisé : « {selectedCall.name} »</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/70">Aucun script sélectionné (choisissez-en un dans « Script d&apos;appel »).</p>
                )}
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Le client était :</p>
                  <div className="flex gap-1.5">
                    {(Object.keys(CALL_TEMP) as CallTemp[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCallTemp(t)}
                        className={cn(
                          "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                          callTemp === t ? cn(CALL_TEMP[t].cls, "ring-1 ring-foreground/20") : "border-input text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {CALL_TEMP[t].emoji} {CALL_TEMP[t].label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  placeholder="Précisions — ex. intéressé, rappeler jeudi ; a déjà un devis ailleurs…"
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={closeCallForm} className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
                  <button
                    onClick={submitCall}
                    disabled={isPending || !callTemp}
                    className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Enregistrer l&apos;appel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Frise chronologique — événements ET notes, par date */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">Frise chronologique</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun événement — première prise de contact à tracer.</p>
            ) : (
              <ol className="relative space-y-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                {timeline.map((item) =>
                  item.type === "event" ? (
                    <li key={`e-${item.ev.id}`} className="relative">
                      <span className={cn("absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card", EVENT_CONFIG[item.ev.kind].dot)} />
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-tight">{EVENT_CONFIG[item.ev.kind].label}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(item.ev.date)}</p>
                      </div>
                      {item.ev.fromStatus && item.ev.toStatus && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                          <span className={cn("rounded-full border px-1.5 py-px", STATUS_CONFIG[item.ev.fromStatus].cls)}>{STATUS_CONFIG[item.ev.fromStatus].label}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className={cn("rounded-full border px-1.5 py-px", STATUS_CONFIG[item.ev.toStatus].cls)}>{STATUS_CONFIG[item.ev.toStatus].label}</span>
                        </p>
                      )}
                      {item.ev.note && <p className="text-xs text-muted-foreground mt-1">{item.ev.note}</p>}
                    </li>
                  ) : (
                    <li key={`n-${item.note.id}`} className="relative group">
                      <span className="absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card bg-amber-400" />
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                          <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                          {item.note.title}
                        </p>
                        <span className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditNote(item.note)} className="text-muted-foreground hover:text-foreground transition-colors" title="Modifier la note">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => removeNote(item.note.id)} disabled={isSavingNote} className="text-muted-foreground hover:text-red-500 transition-colors" title="Supprimer la note">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                          <span className="text-xs text-muted-foreground">{fmtDate(item.note.createdAt)}</span>
                        </span>
                      </div>
                      {item.note.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.note.content}</p>}
                    </li>
                  )
                )}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs partagés avec le tableau — circuit d'envoi contrôlé */}
      <SendEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        templates={templates}
        targets={[sendTarget]}
        emailFromConfigured={emailFromConfigured}
        onSent={handleEmailSent}
        initialTemplateId={templateId}
      />
      <PrepareDraftsDialog
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        templates={templates}
        targets={[sendTarget]}
        onDone={() => setDraftsOpen(false)}
        initialTemplateId={templateId}
      />
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
