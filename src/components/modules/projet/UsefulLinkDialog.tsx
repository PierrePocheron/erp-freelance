"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createUsefulLink, updateUsefulLink, deleteUsefulLink } from "@/actions/projet"
import { LINK_CATEGORY_CONFIG } from "@/lib/link-categories"

export type UsefulLinkForEdit = { id: string; label: string; url: string; category: string }

export function UsefulLinkDialog({ projectId, link }: { projectId: string; link?: UsefulLinkForEdit }) {
  const router = useRouter()
  const isEdit = !!link
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const [label, setLabel]       = useState(link?.label ?? "")
  const [url, setUrl]           = useState(link?.url ?? "")
  const [category, setCategory] = useState(link?.category ?? "OTHER")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !url.trim()) return
    startTransition(async () => {
      if (isEdit) {
        await updateUsefulLink(link.id, projectId, { label: label.trim(), url: url.trim(), category })
      } else {
        await createUsefulLink(projectId, { label: label.trim(), url: url.trim(), category })
      }
      setOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!link) return
    startDelete(async () => {
      await deleteUsefulLink(link.id, projectId)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={<button className="text-muted-foreground hover:text-foreground transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100" title="Modifier" />}
        >
          <Pencil className="h-3.5 w-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" variant="outline" className="w-full gap-1.5" />}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un lien
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le lien" : "Nouveau lien utile"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Label</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="GitHub repo, Figma…" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">URL</label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.entries(LINK_CATEGORY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
