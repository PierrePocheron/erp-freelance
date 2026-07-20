"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Phone, Mail, Users, MessageSquare, Plus, MessageSquareText } from "lucide-react"
import { toast } from "sonner"
import { addInteraction } from "@/actions/crm"
import { createProspectNote, updateProspectStatus } from "@/actions/prospection"
import { ContactTimeline } from "./ContactTimeline"
import { DatePartsField } from "@/components/ui/date-parts-field"
import { STATUS_CONFIG, ALL_STATUSES } from "@/components/modules/prospection/status-config"
import type { ProspectStatus, ProspectEventKind } from "@/generated/prisma/enums"

const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

type TLInteraction = { id: string; date: Date | string; channel: string; summary: string; response: string | null }
type TLEvent = { id: string; kind: ProspectEventKind; fromStatus: ProspectStatus | null; toStatus: ProspectStatus | null; note: string | null; date: Date | string }
type TLNote = { id: string; title: string; content: string | null; createdAt: Date | string }
type TLTask = { id: string; title: string; status: string; dueDate: Date | string | null; completedAt: Date | string | null; createdAt: Date | string; project?: { id: string; name: string } | null }

// Boutons d'interaction rapide → une Interaction datée maintenant
const QUICK_INTERACTIONS: { channel: string; label: string; icon: React.ElementType; summary: string }[] = [
  { channel: "CALL",     label: "Appel",    icon: Phone,             summary: "Appel" },
  { channel: "EMAIL",    label: "Email",    icon: Mail,              summary: "Email" },
  { channel: "MEETING",  label: "Réunion",  icon: Users,             summary: "Réunion" },
  { channel: "SMS",      label: "SMS",      icon: MessageSquareText, summary: "SMS" },
]

/**
 * Bloc d'activité de la fiche contact : barre d'actions rapides (log
 * d'interaction, note, changement de statut pour les prospects) au-dessus de
 * la frise chronologique. Les actions passent par des server actions puis
 * router.refresh() — la page contact étant stable, pas d'état optimiste.
 */
export function ContactActivity({
  clientId,
  isProspect,
  currentStatus,
  interactions,
  events,
  notes,
  tasks,
}: {
  clientId: string
  isProspect: boolean
  currentStatus: ProspectStatus
  interactions: TLInteraction[]
  events: TLEvent[]
  notes: TLNote[]
  tasks: TLTask[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  // Formulaire d'interaction : ouvert par un bouton (canal pré-sélectionné),
  // permet d'ajouter un résumé et de choisir la date (défaut = maintenant).
  const [interOpen, setInterOpen] = useState(false)
  const [interChannel, setInterChannel] = useState("CALL")
  const [interLabel, setInterLabel] = useState("Appel")
  const [interSummary, setInterSummary] = useState("")
  const [interDate, setInterDate] = useState(() => toDateInput(new Date()))

  function run(fn: () => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(successMsg)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      }
    })
  }

  function openInteraction(channel: string, label: string) {
    setInterChannel(channel)
    setInterLabel(label)
    setInterSummary("")
    setInterDate(toDateInput(new Date()))
    setNoteOpen(false)
    setInterOpen(true)
  }

  function saveInteraction() {
    // Le résumé par défaut = le libellé du canal si l'utilisateur n'a rien saisi
    const summary = interSummary.trim() || interLabel
    run(async () => {
      await addInteraction(clientId, { date: new Date(`${interDate}T12:00:00`).toISOString(), channel: interChannel, summary })
      setInterOpen(false)
    }, `${interLabel} enregistré`)
  }

  function changeStatus(status: ProspectStatus) {
    if (status === currentStatus) return
    run(() => updateProspectStatus(clientId, status), `Statut : ${STATUS_CONFIG[status].label}`)
  }

  function saveNote() {
    if (!noteTitle.trim()) return
    run(async () => {
      await createProspectNote(clientId, { title: noteTitle, content: noteContent })
      setNoteTitle("")
      setNoteContent("")
      setNoteOpen(false)
    }, "Note ajoutée")
  }

  return (
    <div className="space-y-4">
      {/* ── Barre d'actions rapides ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_INTERACTIONS.map(({ channel, label, icon: Icon }) => (
            <button
              key={channel}
              onClick={() => openInteraction(channel, label)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
            </button>
          ))}
          <button
            onClick={() => setNoteOpen((v) => !v)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-input text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Note
          </button>
        </div>

        {/* Statut du pipeline — prospects uniquement (change = événement tracé) */}
        {isProspect && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-0.5 inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Statut
            </span>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={isPending}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity disabled:opacity-50 ${STATUS_CONFIG[s].cls} ${s === currentStatus ? "ring-1 ring-foreground/40" : "opacity-70 hover:opacity-100"}`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}

        {/* Formulaire d'interaction : résumé + date (défaut = maintenant) */}
        {interOpen && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{interLabel}</span>
              <DatePartsField value={interDate} onChange={setInterDate} />
            </div>
            <textarea
              value={interSummary}
              onChange={(e) => setInterSummary(e.target.value)}
              placeholder="Que s'est-il dit / passé ? (optionnel)"
              rows={2}
              autoFocus
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setInterOpen(false)} className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
              <button onClick={saveInteraction} disabled={isPending} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* Formulaire de note inline */}
        {noteOpen && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Titre — ex. Point téléphonique"
              autoFocus
              className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Contenu…"
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteOpen(false)} className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
              <button onClick={saveNote} disabled={isPending || !noteTitle.trim()} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                Ajouter
              </button>
            </div>
          </div>
        )}
      </div>

      <ContactTimeline interactions={interactions} events={events} notes={notes} tasks={tasks} />
    </div>
  )
}
