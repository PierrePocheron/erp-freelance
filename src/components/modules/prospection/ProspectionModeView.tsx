"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Phone, PhoneMissed,
  Mail, ThumbsUp, ThumbsDown, CalendarCheck, Trophy, XCircle, Plus,
  Pencil, Trash2, Globe, MapPin, User, Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { atelierSans, atelierMono } from "@/lib/atelier-fonts"
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

// Libellés/couleurs de la frise — pastels « Atelier »
const EVENT_CONFIG: Record<ProspectEventKind, { label: string; dot: string }> = {
  CALL_ANSWERED:  { label: "Appel — a répondu",      dot: "bg-[#8FBF9B]" },
  CALL_NO_ANSWER: { label: "Appel — pas de réponse", dot: "bg-[#D898AC]" },
  EMAIL_SENT:     { label: "Email envoyé",           dot: "bg-[#C9A5D2]" },
  REPLY_POSITIVE: { label: "Réponse positive",       dot: "bg-[#8FBF9B]" },
  REPLY_NEGATIVE: { label: "Réponse négative",       dot: "bg-[#D898AC]" },
  MEETING_BOOKED: { label: "Rendez-vous fixé",       dot: "bg-[#E9C64F]" },
  STATUS_CHANGE:  { label: "Statut modifié",         dot: "bg-[#A995A9]" },
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

export function ProspectionModeView({ prospects }: { prospects: ModeProspect[] }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const prospect = prospects[Math.min(index, prospects.length - 1)]

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

  function runAction(kind: Exclude<ProspectEventKind, "STATUS_CHANGE">) {
    startTransition(async () => {
      const { status } = await logProspectAction(prospect.id, kind)
      toast.success(`${EVENT_CONFIG[kind].label} — statut : ${STATUS_CONFIG[status].label}`)
      router.refresh()
    })
  }

  function setOutcome(status: ProspectStatus) {
    startTransition(async () => {
      await updateProspectStatus(prospect.id, status)
      toast.success(`Statut : ${STATUS_CONFIG[status].label}`)
      router.refresh()
    })
  }

  const status = STATUS_CONFIG[prospect.prospectStatus as ProspectStatus] ?? STATUS_CONFIG.TO_CONTACT
  const siteType = prospect.websiteType ? WEBSITE_TYPE_CONFIG[prospect.websiteType as WebsiteType] : null
  const issues = useMemo(
    () => (prospect.seoIssues ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    [prospect.seoIssues]
  )
  const screenshotUrl = prospect.websiteUrl
    ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(prospect.websiteUrl)}?w=900`
    : null

  return (
    <div className={`atelier ${atelierSans.variable} ${atelierMono.variable} -m-3 sm:-m-6 min-h-full bg-[var(--at-bg)] p-4 pb-24 sm:p-6 space-y-5 text-[color:var(--at-ink)]`}>
      {/* ── Barre de session : retour, progression, navigation ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/prospection"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-[color:var(--at-rule-strong)] text-sm text-[color:var(--at-ink-2)] hover:border-[color:var(--at-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Prospection
        </Link>
        <div className="flex-1 min-w-40 max-w-md space-y-1.5">
          <p className="at-label text-[10px] text-[color:var(--at-ink-3)] text-center">
            ✿ Session · prospect {index + 1} / {prospects.length}
          </p>
          <div className="h-1 rounded-full bg-[var(--at-rule-strong)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--at-plum)] transition-all"
              style={{ width: `${((index + 1) / prospects.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--at-rule-strong)] hover:border-[color:var(--at-ink)] disabled:opacity-30 transition-colors"
            title="Prospect précédent (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            disabled={index === prospects.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--at-rule-strong)] hover:border-[color:var(--at-ink)] disabled:opacity-30 transition-colors"
            title="Prospect suivant (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* ── Colonne fiche : identité, business, site ── */}
        <div className="xl:col-span-3 space-y-5">
          <div className="rounded-2xl border border-[color:var(--at-rule-strong)] bg-[var(--at-paper)] p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="at-display text-3xl leading-tight">{prospect.name}</h1>
                <p className="at-label text-[10px] text-[color:var(--at-ink-3)] mt-1.5 flex items-center gap-1.5">
                  {prospect.company && <span>{prospect.company}</span>}
                  {(prospect.city || prospect.region) && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{prospect.city ?? prospect.region}</span>
                  )}
                </p>
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", status.cls)}>
                {status.label}
              </span>
            </div>

            {prospect.businessDescription && (
              <p className="text-sm text-[color:var(--at-ink-2)] leading-relaxed">{prospect.businessDescription}</p>
            )}

            {/* Coordonnées cliquables */}
            <div className="flex flex-wrap gap-2 text-sm">
              {prospect.phone && (
                <a href={`tel:${prospect.phone}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--at-rule-strong)] hover:border-[color:var(--at-ink)] transition-colors">
                  <Phone className="h-3.5 w-3.5" /> {prospect.phone}
                </a>
              )}
              {prospect.email && (
                <a href={`mailto:${prospect.email}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--at-rule-strong)] hover:border-[color:var(--at-ink)] transition-colors max-w-64 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{prospect.email}</span>
                </a>
              )}
              {prospect.publicationManager && (
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--at-rule)] text-[color:var(--at-ink-2)]" title="Responsable de publication (mentions légales)">
                  <User className="h-3.5 w-3.5" /> {prospect.publicationManager}
                </span>
              )}
            </div>

            {/* Signaux site / SEO */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[color:var(--at-rule)]">
              {siteType && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", siteType.cls)}>{siteType.label}</span>}
              {prospect.cms && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-[#E89D7C]/30 text-[#BE5634] dark:bg-[#E89D7C]/20 dark:text-[#F0B598]" title="CMS détecté — le signal de prospection">
                  {prospect.cms}
                </span>
              )}
              {prospect.domainCreatedAt && (
                <span className="at-label text-[10px] text-[color:var(--at-ink-3)]">domaine : {domainAge(prospect.domainCreatedAt)}</span>
              )}
              {prospect.seoScore != null && <ScoreBar label="SEO" value={prospect.seoScore} />}
              {prospect.performanceScore != null && <ScoreBar label="Perf" value={prospect.performanceScore} />}
            </div>

            {issues.length > 0 && (
              <div className="space-y-1">
                <p className="at-label text-[10px] text-[color:var(--at-ink-3)]">Problèmes détectés — matière des mails</p>
                <ul className="text-sm text-[color:var(--at-ink-2)] space-y-0.5">
                  {issues.map((issue, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[color:var(--at-peach-text)]">✿</span>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Aperçu visuel du site */}
          {prospect.websiteUrl && (
            <div className="rounded-2xl border border-[color:var(--at-rule-strong)] bg-[var(--at-paper)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="at-label text-[10px] text-[color:var(--at-ink-3)] flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Aperçu du site
                </p>
                <a
                  href={prospect.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--at-ink)] text-[var(--at-paper)] text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Ouvrir le site <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <a href={prospect.websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* Screenshot mShots (WordPress.com) — gratuit, sans clé ; la
                    toute première capture d'une URL peut mettre ~30 s à exister.
                    <img> volontaire : next/image n'apporte rien sur des captures
                    éphémères d'un service externe (et exigerait remotePatterns). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={prospect.id}
                  src={screenshotUrl!}
                  alt={`Aperçu de ${prospect.websiteUrl}`}
                  loading="lazy"
                  className="w-full aspect-video object-cover object-top rounded-xl border border-[color:var(--at-rule)] bg-[var(--at-bg)]"
                />
              </a>
              <p className="at-label text-[9px] text-[color:var(--at-ink-3)] truncate">{prospect.websiteUrl}</p>
            </div>
          )}
        </div>

        {/* ── Colonne process : actions, frise, notes ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Actions rapides */}
          <div className="rounded-2xl border border-[color:var(--at-rule-strong)] bg-[var(--at-paper)] p-4 space-y-3">
            <p className="at-label text-[10px] text-[color:var(--at-ink-3)]">Actions rapides</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  onClick={() => runAction(kind)}
                  disabled={isPending}
                  className="flex items-center gap-2 h-10 px-3 rounded-xl border border-[color:var(--at-rule-strong)] text-sm text-[color:var(--at-ink-2)] hover:border-[color:var(--at-ink)] hover:bg-[var(--at-bg)] disabled:opacity-50 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[color:var(--at-ink-3)]" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[color:var(--at-rule)]">
              <button
                onClick={() => setOutcome("WON")}
                disabled={isPending}
                className="flex items-center justify-center gap-2 h-10 px-3 rounded-xl bg-[#E89D7C]/35 text-[#BE5634] dark:bg-[#E89D7C]/20 dark:text-[#F0B598] text-sm font-medium hover:opacity-85 disabled:opacity-50 transition-opacity"
              >
                <Trophy className="h-4 w-4" /> Gagné 🎉
              </button>
              <button
                onClick={() => setOutcome("LOST")}
                disabled={isPending}
                className="flex items-center justify-center gap-2 h-10 px-3 rounded-xl bg-[#E8B5C3]/30 text-[#9A5B70] dark:bg-[#E8B5C3]/[0.12] dark:text-[#D8A5B5] text-sm font-medium hover:opacity-85 disabled:opacity-50 transition-opacity"
              >
                <XCircle className="h-4 w-4" /> Perdu
              </button>
            </div>
          </div>

          {/* Frise chronologique */}
          <div className="rounded-2xl border border-[color:var(--at-rule-strong)] bg-[var(--at-paper)] p-4 space-y-3">
            <p className="at-label text-[10px] text-[color:var(--at-ink-3)]">Frise chronologique</p>
            {prospect.prospectEvents.length === 0 ? (
              <p className="text-sm text-[color:var(--at-ink-3)] italic">Aucun événement — première prise de contact à tracer.</p>
            ) : (
              <ol className="relative space-y-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-[var(--at-rule-strong)]">
                {prospect.prospectEvents.map((ev) => {
                  const cfg = EVENT_CONFIG[ev.kind]
                  return (
                    <li key={ev.id} className="relative">
                      <span className={cn("absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-[color:var(--at-paper)]", cfg.dot)} />
                      <p className="text-sm font-medium leading-tight">{cfg.label}</p>
                      <p className="at-label text-[9px] text-[color:var(--at-ink-3)] mt-0.5">{fmtDate(ev.date)}</p>
                      {ev.fromStatus && ev.toStatus && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                          <span className={cn("rounded-full border px-1.5 py-px", STATUS_CONFIG[ev.fromStatus].cls)}>{STATUS_CONFIG[ev.fromStatus].label}</span>
                          <span className="text-[color:var(--at-ink-3)]">→</span>
                          <span className={cn("rounded-full border px-1.5 py-px", STATUS_CONFIG[ev.toStatus].cls)}>{STATUS_CONFIG[ev.toStatus].label}</span>
                        </p>
                      )}
                      {ev.note && <p className="text-xs text-[color:var(--at-ink-2)] mt-1">{ev.note}</p>}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {/* Notes */}
          <NotesCard key={prospect.id} clientId={prospect.id} notes={prospect.prospectNotes} />
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-[#8FBF9B]" : value >= 40 ? "bg-[#E9C64F]" : "bg-[#E89D7C]"
  return (
    <span className="inline-flex items-center gap-1.5" title={`Score ${label} : ${value}/100`}>
      <Gauge className="h-3 w-3 text-[color:var(--at-ink-3)]" />
      <span className="at-label text-[10px] text-[color:var(--at-ink-3)]">{label}</span>
      <span className="h-1.5 w-14 rounded-full bg-[var(--at-rule-strong)] overflow-hidden">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </span>
      <span className="text-xs font-medium tabular-nums">{value}</span>
    </span>
  )
}

function NotesCard({ clientId, notes }: { clientId: string; notes: ModeNote[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  function startAdd() {
    setAdding(true)
    setEditingId(null)
    setTitle("")
    setContent("")
  }

  function startEdit(note: ModeNote) {
    setEditingId(note.id)
    setAdding(false)
    setTitle(note.title)
    setContent(note.content ?? "")
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
  }

  function save() {
    if (!title.trim()) return
    startTransition(async () => {
      if (editingId) await updateProspectNote(editingId, { title, content })
      else await createProspectNote(clientId, { title, content })
      cancel()
      router.refresh()
    })
  }

  function remove(noteId: string) {
    startTransition(async () => {
      await deleteProspectNote(noteId)
      if (editingId === noteId) cancel()
      router.refresh()
    })
  }

  const form = (
    <div className="space-y-2 rounded-xl border border-[color:var(--at-rule-strong)] p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre — ex. Premier appel"
        className="w-full h-8 rounded-lg border border-[color:var(--at-rule)] bg-transparent px-2.5 text-sm placeholder:text-[color:var(--at-ink-3)] focus:outline-none focus:border-[color:var(--at-ink)]"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Contenu — ex. pas de réponse, rappeler la semaine prochaine…"
        rows={3}
        className="w-full rounded-lg border border-[color:var(--at-rule)] bg-transparent px-2.5 py-1.5 text-sm placeholder:text-[color:var(--at-ink-3)] focus:outline-none focus:border-[color:var(--at-ink)] resize-y"
      />
      <div className="flex justify-end gap-2">
        <button onClick={cancel} className="h-8 px-3 rounded-full text-xs text-[color:var(--at-ink-3)] hover:text-[color:var(--at-ink)] transition-colors">
          Annuler
        </button>
        <button
          onClick={save}
          disabled={isPending || !title.trim()}
          className="h-8 px-3.5 rounded-full bg-[var(--at-ink)] text-[var(--at-paper)] text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-[color:var(--at-rule-strong)] bg-[var(--at-paper)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="at-label text-[10px] text-[color:var(--at-ink-3)]">Notes</p>
        {!adding && !editingId && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-[color:var(--at-rule-strong)] text-xs hover:border-[color:var(--at-ink)] transition-colors"
          >
            <Plus className="h-3 w-3" /> Note
          </button>
        )}
      </div>

      {adding && form}

      {notes.length === 0 && !adding ? (
        <p className="text-sm text-[color:var(--at-ink-3)] italic">Aucune note pour ce prospect.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) =>
            editingId === note.id ? (
              <div key={note.id}>{form}</div>
            ) : (
              <div key={note.id} className="group rounded-xl border border-[color:var(--at-rule)] p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{note.title}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => startEdit(note)} className="text-[color:var(--at-ink-3)] hover:text-[color:var(--at-ink)] transition-colors" title="Modifier">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(note.id)} disabled={isPending} className="text-[color:var(--at-ink-3)] hover:text-[color:var(--at-peach-text)] transition-colors" title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {note.content && <p className="text-sm text-[color:var(--at-ink-2)] whitespace-pre-wrap">{note.content}</p>}
                <p className="at-label text-[9px] text-[color:var(--at-ink-3)]">{fmtDate(note.createdAt)}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
