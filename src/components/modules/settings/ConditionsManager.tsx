"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Star, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  createConditionsTemplate,
  updateConditionsTemplate,
  deleteConditionsTemplate,
  setDefaultConditionsTemplate,
} from "@/actions/conditions"

type Template = {
  id: string
  name: string
  content: string
  isDefault: boolean
}

function InlineEditor({
  name,
  content,
  onSave,
  onCancel,
  isPending,
  autoFocusName = false,
}: {
  name: string
  content: string
  onSave: (name: string, content: string) => void
  onCancel: () => void
  isPending: boolean
  autoFocusName?: boolean
}) {
  const [n, setN] = useState(name)
  const [c, setC] = useState(content)

  return (
    <div className="p-3 space-y-2">
      <input
        value={n}
        onChange={(e) => setN(e.target.value)}
        placeholder="Nom du modèle (ex: Standard 30 jours)"
        autoFocus={autoFocusName}
        className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <textarea
        value={c}
        onChange={(e) => setC(e.target.value)}
        rows={5}
        placeholder="Paiement à 30 jours à date de facture. En cas de retard de paiement, une pénalité de 1,5% par mois sera appliquée..."
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={isPending || !n.trim()}
          onClick={() => onSave(n.trim(), c)}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}

export function ConditionsManager({
  userId,
  templates,
}: {
  userId: string
  templates: Template[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSaveEdit(id: string, name: string, content: string) {
    startTransition(async () => {
      await updateConditionsTemplate(id, userId, { name, content })
      setEditingId(null)
      router.refresh()
    })
  }

  function handleAdd(name: string, content: string) {
    startTransition(async () => {
      await createConditionsTemplate(userId, { name, content })
      setAdding(false)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteConditionsTemplate(id, userId)
      router.refresh()
    })
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      await setDefaultConditionsTemplate(id, userId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {templates.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground py-1">Aucun modèle. Ajoutez-en un ci-dessous.</p>
      )}

      {templates.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border transition-colors",
            editingId === t.id
              ? "border-primary/40 bg-primary/5"
              : "border-border/60 bg-muted/20"
          )}
        >
          {editingId === t.id ? (
            <InlineEditor
              name={t.name}
              content={t.content}
              isPending={isPending}
              onSave={(name, content) => handleSaveEdit(t.id, name, content)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="flex items-start gap-3 px-3 py-2.5 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  {t.isDefault && (
                    <span className="shrink-0 text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium">
                      défaut
                    </span>
                  )}
                </div>
                {t.content ? (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {t.content}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/50 mt-0.5 italic">Aucun contenu</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title={t.isDefault ? "Modèle par défaut" : "Définir par défaut"}
                  disabled={isPending || t.isDefault}
                  onClick={() => handleSetDefault(t.id)}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
                    t.isDefault
                      ? "text-primary cursor-default"
                      : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                  )}
                >
                  <Star className={cn("h-3.5 w-3.5", t.isDefault && "fill-current")} />
                </button>
                <button
                  type="button"
                  title="Modifier"
                  onClick={() => { setEditingId(t.id); setAdding(false) }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  disabled={isPending}
                  onClick={() => handleDelete(t.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5">
          <InlineEditor
            name=""
            content=""
            isPending={isPending}
            autoFocusName
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null) }}
          className="flex items-center gap-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un modèle
        </button>
      )}
    </div>
  )
}
