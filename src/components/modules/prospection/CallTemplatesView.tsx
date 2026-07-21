"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Phone, X, Check, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createCallTemplate, updateCallTemplate, deleteCallTemplate, reorderCallTemplates } from "@/actions/prospection"
import { TEMPLATE_VARIABLES } from "@/lib/email-template"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type CallTemplate = {
  id: string
  name: string
  script: string
  updatedAt: Date | string
}

export function CallTemplatesView({ templates }: { templates: CallTemplate[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [name, setName] = useState("")
  const [script, setScript] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Ordre local pour le drag & drop — resynchronisé quand la liste serveur change.
  const [items, setItems] = useState(templates)
  const [dragId, setDragId] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(templates)
  }, [templates])

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (dragId === null || dragId === overId) return
    setItems((prev) => {
      const from = prev.findIndex((t) => t.id === dragId)
      const to = prev.findIndex((t) => t.id === overId)
      if (from === -1 || to === -1 || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function handleDrop() {
    if (dragId === null) return
    setDragId(null)
    const orderedIds = items.map((t) => t.id)
    startTransition(async () => {
      await reorderCallTemplates(orderedIds)
    })
  }

  function startCreate() {
    setEditingId("new")
    setName("")
    setScript("")
  }

  function startEdit(t: CallTemplate) {
    setEditingId(t.id)
    setName(t.name)
    setScript(t.script)
  }

  function save() {
    if (!name.trim() || !script.trim()) return
    startTransition(async () => {
      if (editingId === "new") {
        await createCallTemplate({ name, script })
        toast.success("Script créé")
      } else if (editingId) {
        await updateCallTemplate(editingId, { name, script })
        toast.success("Script mis à jour")
      }
      setEditingId(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    setConfirmDeleteId(null)
    startTransition(async () => {
      await deleteCallTemplate(id)
      toast.success("Script supprimé")
      router.refresh()
    })
  }

  const editorOpen = editingId !== null

  return (
    <div className="space-y-4">
      {/* Aide format + variables */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Notez votre déroulé d&apos;appel : ouverture, <strong>phrases clés</strong>, réponses potentielles du prospect et relances.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <code key={v.key} className="rounded bg-muted px-1.5 py-0.5 text-[11px]" title={v.label}>
              {`{{${v.key}}}`}
            </code>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Les <code className="rounded bg-muted px-1 py-0.5">{`{{variables}}`}</code> sont remplacées par les vraies valeurs du prospect en mode prospection (ex. <code className="rounded bg-muted px-1 py-0.5">{`{{site}}`}</code>). Utilisez <code className="rounded bg-muted px-1 py-0.5">((nom))</code> comme rappel à dire de vive voix. Gardez l&apos;intrigue — teasez la valeur sans dévoiler le détail ni les tarifs.
        </p>
      </div>

      {/* Éditeur */}
      {editorOpen ? (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{editingId === "new" ? "Nouveau script" : "Modifier le script"}</h2>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nom interne</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Premier appel — hook « courage à 2 mains »" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Script (déroulé de l&apos;appel)</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={12}
              placeholder={"Bonjour monsieur ((nom)), je suis Pierre, je vous appelle car…\n\nRéponse potentielle : …\n\nRelance : …"}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-y leading-relaxed"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
              <X className="h-3.5 w-3.5" /> Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={isPending || !name.trim() || !script.trim()}>
              <Check className="h-3.5 w-3.5" /> {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={startCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nouveau script
        </Button>
      )}

      {/* Liste — réordonnable par glisser-déposer */}
      {items.length === 0 && !editorOpen ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <Phone className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun script pour le moment</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Créez votre premier déroulé d&apos;appel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <div
              key={t.id}
              onDragOver={(e) => handleDragOver(e, t.id)}
              onDrop={handleDrop}
              className={cn(
                "group flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card p-4 transition-colors",
                dragId === t.id && "opacity-50 ring-1 ring-primary/40"
              )}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0 touch-none"
                  title="Glisser pour réordonner"
                  aria-label="Réordonner le script"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold truncate flex-1">{t.name}</p>
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {confirmDeleteId === t.id ? (
                    <>
                      <button onClick={() => remove(t.id)} className="text-[10px] font-medium text-destructive hover:opacity-80 px-1">
                        Suppr.
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-muted-foreground px-1">
                        Non
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(t.id)}
                      className="p-1.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className={cn("text-xs text-muted-foreground/80 whitespace-pre-line leading-relaxed", !expanded.has(t.id) && "line-clamp-6")}>{t.script}</p>
              <button
                type="button"
                onClick={() => toggleExpand(t.id)}
                className="self-start text-[11px] font-medium text-primary hover:underline"
              >
                {expanded.has(t.id) ? "Réduire" : "Dérouler le script"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
