"use client"

import { useState, useRef, useTransition } from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { updateJournalEntry, deleteJournalEntry } from "@/actions/projet"

type Entry = {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

export function JournalEntryItem({ entry, projectId }: { entry: Entry; projectId: string }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wasEdited = entry.updatedAt.getTime() - entry.createdAt.getTime() > 1000

  function startEdit() {
    setEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 0)
  }

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  function save() {
    const content = textareaRef.current?.value.trim()
    if (!content) return
    startTransition(() => updateJournalEntry(entry.id, projectId, content))
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
    setConfirmDelete(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save() }
    if (e.key === "Escape") cancel()
  }

  function remove() {
    startTransition(() => deleteJournalEntry(entry.id, projectId))
  }

  return (
    <div className="flex gap-3 group">
      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-border shrink-0" />
      <div className="flex-1 min-w-0">
        {/* Dates */}
        <p className="text-xs text-muted-foreground mb-0.5">
          {formatDate(entry.createdAt)}
          {wasEdited && (
            <span className="ml-1.5 italic">· modifié {formatDate(entry.updatedAt)}</span>
          )}
        </p>

        {/* Contenu ou textarea d'édition */}
        {editing ? (
          <div className="space-y-1.5">
            <textarea
              ref={textareaRef}
              defaultValue={entry.content}
              onInput={resize}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none overflow-hidden"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={save}
                disabled={isPending}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Check className="h-3 w-3" /> Enregistrer
              </button>
              <button
                onClick={cancel}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Annuler
              </button>
            </div>
          </div>
        ) : confirmDelete ? (
          <div className="space-y-1.5">
            <p className="text-sm whitespace-pre-line text-muted-foreground line-through">{entry.content}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={remove}
                disabled={isPending}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Confirmer la suppression
              </button>
              <button
                onClick={cancel}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-line">{entry.content}</p>
        )}
      </div>

      {/* Actions (hover) */}
      {!editing && !confirmDelete && (
        <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
          <button
            onClick={startEdit}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Modifier"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-muted transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
