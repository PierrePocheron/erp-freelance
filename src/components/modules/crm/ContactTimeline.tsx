import Link from "next/link"
import { Phone, PhoneMissed, Mail, ThumbsUp, ThumbsDown, CalendarCheck, StickyNote, MessageSquare, ArrowRight, CheckSquare, Square } from "lucide-react"
import { STATUS_CONFIG } from "@/components/modules/prospection/status-config"
import type { ProspectStatus, ProspectEventKind } from "@/generated/prisma/enums"

type TimelineInteraction = { id: string; date: Date | string; channel: string; summary: string; response: string | null }
type TimelineEvent = {
  id: string
  kind: ProspectEventKind
  fromStatus: ProspectStatus | null
  toStatus: ProspectStatus | null
  note: string | null
  date: Date | string
}
type TimelineNote = { id: string; title: string; content: string | null; createdAt: Date | string }
type TimelineTask = {
  id: string
  title: string
  status: string
  dueDate: Date | string | null
  completedAt: Date | string | null
  createdAt: Date | string
  project?: { id: string; name: string } | null
}

const EVENT_CONFIG: Record<ProspectEventKind, { label: string; dot: string; icon: React.ElementType }> = {
  CALL_ANSWERED:  { label: "Appel — a répondu",      dot: "bg-emerald-400", icon: Phone },
  CALL_NO_ANSWER: { label: "Appel — pas de réponse", dot: "bg-red-400",     icon: PhoneMissed },
  EMAIL_SENT:     { label: "Email envoyé",           dot: "bg-blue-400",    icon: Mail },
  REPLY_POSITIVE: { label: "Réponse positive",       dot: "bg-emerald-500", icon: ThumbsUp },
  REPLY_NEGATIVE: { label: "Réponse négative",       dot: "bg-red-400",     icon: ThumbsDown },
  MEETING_BOOKED: { label: "Rendez-vous fixé",       dot: "bg-violet-400",  icon: CalendarCheck },
  STATUS_CHANGE:  { label: "Statut modifié",         dot: "bg-slate-400",   icon: ArrowRight },
}

const CHANNEL_ICON: Record<string, React.ElementType> = {
  EMAIL: Mail, CALL: Phone, LINKEDIN: MessageSquare, MEETING: CalendarCheck, SMS: MessageSquare, OTHER: MessageSquare,
}
const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email", CALL: "Appel", LINKEDIN: "LinkedIn", MEETING: "Réunion", SMS: "SMS", OTHER: "Contact",
}

const fmt = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) +
  " · " + new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

type Item =
  | { type: "event"; date: Date; ev: TimelineEvent }
  | { type: "note"; date: Date; note: TimelineNote }
  | { type: "interaction"; date: Date; it: TimelineInteraction }
  | { type: "task"; date: Date; task: TimelineTask }

/** Date de référence d'une tâche sur la frise : réalisation si terminée,
 *  sinon échéance (planifié, éventuellement futur), sinon création. */
function taskDate(t: TimelineTask): Date {
  return new Date(t.completedAt ?? t.dueDate ?? t.createdAt)
}

/**
 * Frise chronologique unifiée d'un contact — reprend le système du mode
 * prospection : mêle les événements de prospection (appels, emails, réponses,
 * changements de statut), les notes titrées, les interactions CRM et les
 * tâches, triés du plus récent au plus ancien. Purement présentationnel.
 */
export function ContactTimeline({
  interactions,
  events,
  notes,
  tasks = [],
}: {
  interactions: TimelineInteraction[]
  events: TimelineEvent[]
  notes: TimelineNote[]
  tasks?: TimelineTask[]
}) {
  // Les événements de prospection créent DÉJÀ une interaction CRM jumelle (même
  // horodatage) : on masque l'interaction si un événement partage sa seconde,
  // pour ne pas afficher la ligne en double.
  const eventSeconds = new Set(events.map((e) => Math.floor(new Date(e.date).getTime() / 1000)))
  // eslint-disable-next-line react-hooks/purity -- comparaison à l'instant courant pour marquer les tâches « à venir »
  const now = Date.now()

  const items: Item[] = [
    ...events.map((ev) => ({ type: "event" as const, date: new Date(ev.date), ev })),
    ...notes.map((note) => ({ type: "note" as const, date: new Date(note.createdAt), note })),
    ...tasks.map((task) => ({ type: "task" as const, date: taskDate(task), task })),
    ...interactions
      .filter((it) => !eventSeconds.has(Math.floor(new Date(it.date).getTime() / 1000)))
      .map((it) => ({ type: "interaction" as const, date: new Date(it.date), it })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Aucune activité pour l&apos;instant.</p>
  }

  return (
    <ol className="relative space-y-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
      {items.map((item) => {
        if (item.type === "event") {
          const cfg = EVENT_CONFIG[item.ev.kind]
          return (
            <li key={`e-${item.ev.id}`} className="relative">
              <span className={`absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card ${cfg.dot}`} />
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                  {cfg.label}
                  {/* Ces événements viennent du pipeline de prospection */}
                  <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Prospection</span>
                </p>
                <p className="text-xs text-muted-foreground">{fmt(item.ev.date)}</p>
              </div>
              {item.ev.fromStatus && item.ev.toStatus && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className={`rounded-full border px-1.5 py-px ${STATUS_CONFIG[item.ev.fromStatus].cls}`}>{STATUS_CONFIG[item.ev.fromStatus].label}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={`rounded-full border px-1.5 py-px ${STATUS_CONFIG[item.ev.toStatus].cls}`}>{STATUS_CONFIG[item.ev.toStatus].label}</span>
                </p>
              )}
              {item.ev.note && <p className="text-xs text-muted-foreground mt-1">{item.ev.note}</p>}
            </li>
          )
        }
        if (item.type === "task") {
          const t = item.task
          const done = t.status === "DONE"
          const upcoming = !done && !!t.dueDate && new Date(t.dueDate).getTime() > now
          const TaskIcon = done ? CheckSquare : Square
          return (
            <li key={`t-${t.id}`} className="relative">
              <span className={`absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card ${done ? "bg-emerald-400" : upcoming ? "bg-blue-400" : "bg-indigo-400"}`} />
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                  <TaskIcon className={`h-3.5 w-3.5 ${done ? "text-emerald-500" : "text-indigo-400"}`} />
                  {t.title}
                  {done && <span className="rounded-full bg-emerald-500/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-emerald-600">Fait</span>}
                  {upcoming && <span className="rounded-full bg-blue-500/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-blue-600">À venir</span>}
                </p>
                <p className="text-xs text-muted-foreground">{fmt(item.date)}</p>
              </div>
              {t.project && (
                <Link href={`/projets/${t.project.id}`} className="text-xs text-muted-foreground hover:text-primary hover:underline mt-0.5 inline-block">
                  {t.project.name}
                </Link>
              )}
            </li>
          )
        }
        if (item.type === "note") {
          return (
            <li key={`n-${item.note.id}`} className="relative">
              <span className="absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card bg-amber-400" />
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                  {item.note.title}
                </p>
                <p className="text-xs text-muted-foreground">{fmt(item.note.createdAt)}</p>
              </div>
              {item.note.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.note.content}</p>}
            </li>
          )
        }
        const Icon = CHANNEL_ICON[item.it.channel] ?? MessageSquare
        return (
          <li key={`i-${item.it.id}`} className="relative">
            <span className="absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card bg-slate-400" />
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {CHANNEL_LABEL[item.it.channel] ?? item.it.channel}
              </p>
              <p className="text-xs text-muted-foreground">{fmt(item.it.date)}</p>
            </div>
            {item.it.summary && <p className="text-sm text-muted-foreground mt-1">{item.it.summary}</p>}
            {item.it.response && <p className="text-xs text-muted-foreground mt-0.5 italic">↳ {item.it.response}</p>}
          </li>
        )
      })}
    </ol>
  )
}
