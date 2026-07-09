"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarCheck, ChevronDown, Check, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeTaskGlobal, cancelTask, updateMilestoneStatus } from "@/actions/projet"
import { setCalendarEventOutcome, cancelCalendarEvent } from "@/actions/calendar"

export type ConfirmTaskItem = { id: string; title: string; dueDate: string; projectId: string | null }
export type ConfirmMilestoneItem = { id: string; name: string; date: string; projectId: string }
export type ConfirmEventItem = { id: string; title: string; startDate: string; categoryColor: string | null }

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

/**
 * Items du passé récent (tâches en retard, jalons passés, événements calendrier)
 * qui n'ont pas encore été confirmés ("bien passé") ni marqués annulés.
 * Une raison optionnelle peut être laissée en annulant.
 */
export function ConfirmEventsCard({
  tasks,
  milestones,
  events,
}: {
  tasks: ConfirmTaskItem[]
  milestones: ConfirmMilestoneItem[]
  events: ConfirmEventItem[]
}) {
  const [expanded, setExpanded] = useState<"tasks" | "milestones" | "events" | null>(
    tasks.length > 0 ? "tasks" : milestones.length > 0 ? "milestones" : "events"
  )
  const total = tasks.length + milestones.length + events.length
  if (total === 0) return null

  function toggle(k: "tasks" | "milestones" | "events") {
    setExpanded((cur) => (cur === k ? null : k))
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-fuchsia-500" />
          <h2 className="text-sm font-semibold">À confirmer</h2>
        </div>
        <p className="text-xs text-muted-foreground">{total} en attente</p>
      </div>

      <div className="divide-y divide-border/50">
        {tasks.length > 0 && (
          <ConfirmSection label="Tâches" count={tasks.length} open={expanded === "tasks"} onToggle={() => toggle("tasks")}>
            {tasks.map((t) => <TaskRow key={t.id} item={t} />)}
          </ConfirmSection>
        )}
        {milestones.length > 0 && (
          <ConfirmSection label="Jalons" count={milestones.length} open={expanded === "milestones"} onToggle={() => toggle("milestones")}>
            {milestones.map((m) => <MilestoneRow key={m.id} item={m} />)}
          </ConfirmSection>
        )}
        {events.length > 0 && (
          <ConfirmSection label="Événements" count={events.length} open={expanded === "events"} onToggle={() => toggle("events")}>
            {events.map((e) => <EventRow key={e.id} item={e} />)}
          </ConfirmSection>
        )}
      </div>
    </div>
  )
}

function ConfirmSection({
  label, count, open, onToggle, children,
}: {
  label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div>
      <button onClick={onToggle} className="flex items-center gap-2 w-full px-5 py-2.5 hover:bg-muted/40 transition-colors">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-2 pb-2 space-y-1">{children}</div>}
    </div>
  )
}

/** Bouton "annuler" qui déplie un champ raison avant soumission. */
function CancelWithReason({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Annuler"
        className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
      >
        <Ban className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Raison (optionnel)"
        className="h-6 w-32 rounded border border-input bg-background px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button onClick={() => onConfirm(reason)} className="text-[10px] font-medium text-destructive hover:opacity-80 px-1">
        Confirmer
      </button>
      <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground px-1">
        Non
      </button>
    </div>
  )
}

function TaskRow({ item }: { item: ConfirmTaskItem }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const href = item.projectId ? `/projets/${item.projectId}/dev` : "/taches"

  function confirm() {
    startTransition(async () => {
      await completeTaskGlobal(item.id)
      toast.success("Tâche marquée terminée")
      router.refresh()
    })
  }
  function cancel(reason: string) {
    startTransition(async () => {
      await cancelTask(item.id, item.projectId ?? undefined, reason)
      toast.success("Tâche annulée")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
      <Link href={href} className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(item.dueDate)}</p>
      </Link>
      <button onClick={confirm} disabled={isPending} title="Marquer terminée" className="rounded-md p-1 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors shrink-0 disabled:opacity-50">
        <Check className="h-3.5 w-3.5" />
      </button>
      <CancelWithReason onConfirm={cancel} />
    </div>
  )
}

function MilestoneRow({ item }: { item: ConfirmMilestoneItem }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      await updateMilestoneStatus(item.id, item.projectId, "DONE")
      toast.success("Jalon marqué terminé")
      router.refresh()
    })
  }
  function cancel(reason: string) {
    startTransition(async () => {
      await updateMilestoneStatus(item.id, item.projectId, "CANCELLED", reason)
      toast.success("Jalon annulé")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
      <Link href={`/projets/${item.projectId}/dev`} className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(item.date)}</p>
      </Link>
      <button onClick={confirm} disabled={isPending} title="Marquer terminé" className="rounded-md p-1 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors shrink-0 disabled:opacity-50">
        <Check className="h-3.5 w-3.5" />
      </button>
      <CancelWithReason onConfirm={cancel} />
    </div>
  )
}

function EventRow({ item }: { item: ConfirmEventItem }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      await setCalendarEventOutcome(item.id, "Bien passé")
      toast.success("Événement confirmé")
      router.refresh()
    })
  }
  function cancel(reason: string) {
    startTransition(async () => {
      await cancelCalendarEvent(item.id, reason)
      toast.success("Événement annulé")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor ?? "#94a3b8" }} />
      <Link href="/calendrier" className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(item.startDate)}</p>
      </Link>
      <button onClick={confirm} disabled={isPending} title="Bien passé" className="rounded-md p-1 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors shrink-0 disabled:opacity-50">
        <Check className="h-3.5 w-3.5" />
      </button>
      <CancelWithReason onConfirm={cancel} />
    </div>
  )
}
