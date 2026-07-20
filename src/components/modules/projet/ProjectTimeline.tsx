"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Pencil, Trash2, StickyNote, Flag, CheckSquare, Square,
  Handshake, Mail, Phone, Banknote, PackageCheck, Scale, Dot,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Timeline, TimelineItem } from "@/components/ui/timeline"
import { DatePartsField } from "@/components/ui/date-parts-field"
import { createProjectEvent, updateProjectEvent, deleteProjectEvent } from "@/actions/projet"

type EventKind = "NOTE" | "MEETING" | "EMAIL" | "CALL" | "PAYMENT" | "DELIVERY" | "LEGAL" | "OTHER"

export type PEvent = { id: string; kind: string; title: string; description: string | null; date: Date | string }
export type PMilestone = { id: string; name: string; date: Date | string; type: string; status: string; outcome: string | null }
export type PTask = { id: string; title: string; status: string; dueDate: Date | string | null; completedAt: Date | string | null; createdAt: Date | string }
export type PJournal = { id: string; content: string; createdAt: Date | string }

const KIND_CONFIG: Record<EventKind, { label: string; dot: string; icon: React.ElementType }> = {
  NOTE:     { label: "Note",       dot: "bg-amber-400",   icon: StickyNote },
  MEETING:  { label: "Rencontre",  dot: "bg-violet-400",  icon: Handshake },
  EMAIL:    { label: "Email",      dot: "bg-blue-400",    icon: Mail },
  CALL:     { label: "Appel",      dot: "bg-sky-400",     icon: Phone },
  PAYMENT:  { label: "Paiement",   dot: "bg-emerald-400", icon: Banknote },
  DELIVERY: { label: "Livraison",  dot: "bg-teal-400",    icon: PackageCheck },
  LEGAL:    { label: "Juridique",  dot: "bg-red-400",     icon: Scale },
  OTHER:    { label: "Autre",      dot: "bg-slate-400",   icon: Dot },
}
const KIND_OPTIONS: EventKind[] = ["NOTE", "MEETING", "EMAIL", "CALL", "PAYMENT", "DELIVERY", "LEGAL", "OTHER"]

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
const toDateInput = (d: Date | string) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}

type Item =
  | { type: "event"; date: Date; ev: PEvent }
  | { type: "milestone"; date: Date; m: PMilestone }
  | { type: "task"; date: Date; t: PTask }
  | { type: "journal"; date: Date; j: PJournal }

/**
 * Frise chronologique d'un projet : agrège les événements du projet (éditables),
 * les jalons, les tâches et les notes rapides, triés du plus récent au plus
 * ancien. CRUD sur les événements ; jalons/tâches/notes en lecture (gérés
 * ailleurs sur la fiche projet).
 */
export function ProjectTimeline({
  projectId, events, milestones, tasks, journal,
}: {
  projectId: string
  events: PEvent[]
  milestones: PMilestone[]
  tasks: PTask[]
  journal: PJournal[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kind, setKind] = useState<EventKind>("NOTE")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(() => toDateInput(new Date()))

  const items = useMemo<Item[]>(() => [
    ...events.map((ev) => ({ type: "event" as const, date: new Date(ev.date), ev })),
    ...milestones.map((m) => ({ type: "milestone" as const, date: new Date(m.date), m })),
    ...tasks.map((t) => ({ type: "task" as const, date: new Date(t.completedAt ?? t.dueDate ?? t.createdAt), t })),
    ...journal.map((j) => ({ type: "journal" as const, date: new Date(j.createdAt), j })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()), [events, milestones, tasks, journal])

  function openAdd() {
    setEditingId(null)
    setKind("NOTE"); setTitle(""); setDescription(""); setDate(toDateInput(new Date()))
    setFormOpen(true)
  }
  function openEdit(ev: PEvent) {
    setEditingId(ev.id)
    setKind((ev.kind as EventKind) ?? "NOTE"); setTitle(ev.title); setDescription(ev.description ?? ""); setDate(toDateInput(ev.date))
    setFormOpen(true)
  }
  function cancel() { setFormOpen(false); setEditingId(null) }

  function save() {
    if (!title.trim()) return
    const payload = { kind, title, description, date: new Date(`${date}T12:00:00`) }
    startTransition(async () => {
      try {
        if (editingId) await updateProjectEvent(editingId, payload)
        else await createProjectEvent(projectId, payload)
        toast.success("Événement enregistré")
        cancel()
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      }
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteProjectEvent(id)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Frise chronologique</h2>
        {!formOpen && (
          <button onClick={openAdd} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-input text-xs hover:bg-muted/50 transition-colors">
            <Plus className="h-3 w-3" /> Événement
          </button>
        )}
      </div>

      {/* Formulaire d'ajout / édition d'événement */}
      {formOpen && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {KIND_OPTIONS.map((k) => <option key={k} value={k}>{KIND_CONFIG[k].label}</option>)}
            </select>
            <DatePartsField value={date} onChange={setDate} />
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre — ex. Audience de mise en état" autoFocus className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détail (optionnel)…" rows={2} className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
            <button onClick={save} disabled={isPending || !title.trim()} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isPending ? "…" : editingId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucun événement — ajoutez le premier.</p>
      ) : (
        <Timeline>
          {items.map((item) => {
            if (item.type === "event") {
              const cfg = KIND_CONFIG[(item.ev.kind as EventKind)] ?? KIND_CONFIG.OTHER
              const Icon = cfg.icon
              return (
                <TimelineItem key={`e-${item.ev.id}`} dotClassName={cfg.dot}>
                  <div className="group flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.ev.title}
                      <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{cfg.label}</span>
                    </p>
                    <span className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(item.ev)} className="text-muted-foreground hover:text-foreground transition-colors" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(item.ev.id)} disabled={isPending} className="text-muted-foreground hover:text-red-500 transition-colors" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(item.ev.date)}</span>
                    </span>
                  </div>
                  {item.ev.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.ev.description}</p>}
                </TimelineItem>
              )
            }
            if (item.type === "milestone") {
              return (
                <TimelineItem key={`m-${item.m.id}`} dotClassName={item.m.status === "DONE" ? "bg-emerald-400" : "bg-indigo-400"}>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 text-indigo-400" />
                      {item.m.name}
                      <span className="rounded-full bg-indigo-500/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-indigo-600">Jalon</span>
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(item.m.date)}</span>
                  </div>
                  {item.m.outcome && <p className="text-sm text-muted-foreground mt-1">{item.m.outcome}</p>}
                </TimelineItem>
              )
            }
            if (item.type === "task") {
              const done = item.t.status === "DONE"
              const TaskIcon = done ? CheckSquare : Square
              return (
                <TimelineItem key={`t-${item.t.id}`} dotClassName={done ? "bg-emerald-400" : "bg-slate-400"}>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                      <TaskIcon className={cn("h-3.5 w-3.5", done ? "text-emerald-500" : "text-muted-foreground")} />
                      {item.t.title}
                      {done && <span className="rounded-full bg-emerald-500/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-emerald-600">Fait</span>}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(item.date)}</span>
                  </div>
                </TimelineItem>
              )
            }
            return (
              <TimelineItem key={`j-${item.j.id}`} dotClassName="bg-amber-400">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium leading-tight inline-flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5 text-amber-500" /> Note rapide
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(item.j.createdAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.j.content}</p>
              </TimelineItem>
            )
          })}
        </Timeline>
      )}
    </div>
  )
}
