"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Mail, X, Check, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, reorderEmailTemplates } from "@/actions/prospection"
import { TEMPLATE_VARIABLES } from "@/lib/email-template"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  updatedAt: Date | string
}

export function EmailTemplatesView({ templates }: { templates: EmailTemplate[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Ordre local pour le drag & drop — resynchronisé quand la liste serveur
  // change (création / édition / suppression rafraîchies via router.refresh).
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
      await reorderEmailTemplates(orderedIds)
    })
  }

  function startCreate() {
    setEditingId("new")
    setName("")
    setSubject("")
    setBody("")
  }

  function startEdit(t: EmailTemplate) {
    setEditingId(t.id)
    setName(t.name)
    setSubject(t.subject)
    setBody(t.body)
  }

  function save() {
    if (!name.trim() || !subject.trim() || !body.trim()) return
    startTransition(async () => {
      if (editingId === "new") {
        await createEmailTemplate({ name, subject, body })
        toast.success("Modèle créé")
      } else if (editingId) {
        await updateEmailTemplate(editingId, { name, subject, body })
        toast.success("Modèle mis à jour")
      }
      setEditingId(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    setConfirmDeleteId(null)
    startTransition(async () => {
      await deleteEmailTemplate(id)
      toast.success("Modèle supprimé")
      router.refresh()
    })
  }

  const editorOpen = editingId !== null

  return (
    <div className="space-y-4">
      {/* Aide variables */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Variables disponibles — remplacées par les infos de chaque prospect à l&apos;envoi :
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <code key={v.key} className="rounded bg-muted px-1.5 py-0.5 text-[11px]" title={v.label}>
              {`{{${v.key}}}`}
            </code>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Rappel prospection B2B : mentionnez comment vous désinscrire et gardez un objet en rapport avec l&apos;activité du destinataire.
        </p>
      </div>

      {/* Éditeur */}
      {editorOpen ? (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{editingId === "new" ? "Nouveau modèle" : "Modifier le modèle"}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nom interne</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Refonte site Local.fr — 1er contact" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Objet du mail</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Votre site {{site}} — quelques idées d'amélioration" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Corps (texte, paragraphes séparés par une ligne vide)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder={"Bonjour {{prenom}},\n\nJe suis tombé sur le site de {{societe}} et…"}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono text-xs leading-relaxed"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
              <X className="h-3.5 w-3.5" /> Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={isPending || !name.trim() || !subject.trim() || !body.trim()}>
              <Check className="h-3.5 w-3.5" /> {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={startCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nouveau modèle
        </Button>
      )}

      {/* Liste — grille responsive, réordonnable par glisser-déposer */}
      {items.length === 0 && !editorOpen ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <Mail className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun modèle pour le moment</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Créez votre premier modèle de démarchage</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <div
              key={t.id}
              onDragOver={(e) => handleDragOver(e, t.id)}
              onDrop={handleDrop}
              className={cn(
                "group flex flex-col gap-1 rounded-xl border border-border/50 bg-card p-4 transition-colors",
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
                  aria-label="Réordonner le modèle"
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
              <p className="text-xs text-muted-foreground truncate">Objet : {t.subject}</p>
              <p className="text-xs text-muted-foreground/70 line-clamp-3 whitespace-pre-line">{t.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
