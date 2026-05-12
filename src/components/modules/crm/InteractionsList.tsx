"use client"

import { useState, useTransition } from "react"
import { Mail, Phone, Users, MessageSquare, Coffee, MoreHorizontal, Trash2, Pencil, X, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateInteraction, deleteInteraction } from "@/actions/crm"

type Interaction = {
  id: string
  date: Date
  channel: string
  summary: string
  response: string | null
}

const channels = [
  { value: "EMAIL", label: "Email", icon: Mail, iconCls: "bg-blue-500/15 text-blue-600", borderCls: "border-blue-500/40" },
  { value: "CALL", label: "Appel", icon: Phone, iconCls: "bg-emerald-500/15 text-emerald-600", borderCls: "border-emerald-500/40" },
  { value: "LINKEDIN", label: "LinkedIn", icon: Users, iconCls: "bg-indigo-500/15 text-indigo-600", borderCls: "border-indigo-500/40" },
  { value: "MEETING", label: "Réunion", icon: Coffee, iconCls: "bg-amber-500/15 text-amber-600", borderCls: "border-amber-500/40" },
  { value: "SMS", label: "SMS", icon: MessageSquare, iconCls: "bg-violet-500/15 text-violet-600", borderCls: "border-violet-500/40" },
  { value: "OTHER", label: "Autre", icon: MoreHorizontal, iconCls: "bg-muted text-muted-foreground", borderCls: "border-border" },
]

const channelMap = Object.fromEntries(channels.map((c) => [c.value, c]))

export function InteractionsList({
  clientId,
  interactions,
}: {
  clientId: string
  interactions: Interaction[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editChannel, setEditChannel] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editResponse, setEditResponse] = useState("")
  const [isPending, startTransition] = useTransition()

  function startEdit(i: Interaction) {
    setEditingId(i.id)
    setEditDate(new Date(i.date).toISOString().split("T")[0])
    setEditChannel(i.channel)
    setEditSummary(i.summary)
    setEditResponse(i.response ?? "")
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(interactionId: string) {
    if (!editSummary.trim()) return
    startTransition(async () => {
      await updateInteraction(interactionId, clientId, {
        date: editDate,
        channel: editChannel,
        summary: editSummary,
        response: editResponse || null,
      })
      setEditingId(null)
      toast.success("Interaction mise à jour")
    })
  }

  function handleDelete(interactionId: string) {
    startTransition(async () => {
      await deleteInteraction(interactionId, clientId)
      toast.success("Interaction supprimée")
    })
  }

  if (interactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aucune interaction enregistrée</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {interactions.map((interaction) => {
        const ch = channelMap[interaction.channel] ?? channelMap.OTHER
        const Icon = ch.icon
        const isEditing = editingId === interaction.id

        if (isEditing) {
          return (
            <div key={interaction.id} className={`rounded-xl border bg-card p-4 space-y-3 ${ch.borderCls}`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Canal</label>
                  <select
                    value={editChannel}
                    onChange={(e) => setEditChannel(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {channels.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Résumé *</label>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Réponse / Suite</label>
                <textarea
                  value={editResponse}
                  onChange={(e) => setEditResponse(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => saveEdit(interaction.id)} disabled={isPending || !editSummary.trim()}>
                  <Check className="h-3.5 w-3.5" />
                  Enregistrer
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={isPending}>
                  <X className="h-3.5 w-3.5" />
                  Annuler
                </Button>
              </div>
            </div>
          )
        }

        return (
          <div key={interaction.id} className={`group rounded-xl border bg-card p-4 space-y-2 ${ch.borderCls}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${ch.iconCls}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium">{ch.label}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(interaction.date).toLocaleDateString("fr-FR", {
                    weekday: "short", day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => startEdit(interaction)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Modifier"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(interaction.id)}
                  disabled={isPending}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-sm pl-9">{interaction.summary}</p>
            {interaction.response && (
              <div className="ml-9 pl-2 border-l-2 border-border text-xs text-muted-foreground">
                <span className="font-medium">Suite : </span>{interaction.response}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
