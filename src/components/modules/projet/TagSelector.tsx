"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Plus, Tag as TagIcon, Check, Loader2 } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
import { cn } from "@/lib/utils"
import { TagBadge } from "./TagBadge"
import { createTag, setProjectTags } from "@/actions/tags"

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#78716c",
]

type Tag = { id: string; name: string; color: string }

type Props = {
  projectId: string
  userId: string
  availableTags: Tag[]
  selectedTagIds: string[]
}

export function TagSelector({ projectId, userId, availableTags: initialTags, selectedTagIds: initialSelected }: Props) {
  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelected))
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [isCreating, startCreateTransition] = useTransition()
  const newNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) newNameRef.current?.focus()
  }, [creating])

  const selectedTags = tags.filter((t) => selectedIds.has(t.id))

  function toggleTag(tagId: string) {
    const next = new Set(selectedIds)
    if (next.has(tagId)) next.delete(tagId)
    else next.add(tagId)
    setSelectedIds(next)
    startTransition(async () => {
      await setProjectTags(projectId, Array.from(next))
    })
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    startCreateTransition(async () => {
      const tag = await createTag(userId, name, newColor)
      setTags((prev) => [...prev, tag])
      const next = new Set(selectedIds)
      next.add(tag.id)
      setSelectedIds(next)
      await setProjectTags(projectId, Array.from(next))
      setNewName("")
      setNewColor(PRESET_COLORS[0])
      setCreating(false)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} onRemove={() => toggleTag(tag.id)} />
      ))}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
          )}
        >
          <TagIcon className="h-3 w-3" />
          Tags
          {isPending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6}>
            <Popover.Popup className="z-50 min-w-52 max-w-64 rounded-xl border border-border bg-popover p-2 shadow-lg text-sm outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              {/* Tag list */}
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {tags.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Aucun tag créé</p>
                )}
                {tags.map((tag) => {
                  const selected = selectedIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left text-xs">{tag.name}</span>
                      {selected && <Check className="h-3 w-3 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* Séparateur */}
              <div className="my-1.5 h-px bg-border" />

              {/* Créer un tag */}
              {creating ? (
                <div className="space-y-2 px-1">
                  <input
                    ref={newNameRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate()
                      if (e.key === "Escape") setCreating(false)
                    }}
                    placeholder="Nom du tag..."
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          "h-5 w-5 rounded-full transition-transform hover:scale-110",
                          newColor === c && "ring-2 ring-offset-1 ring-foreground/50"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim() || isCreating}
                      className="flex-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      {isCreating ? "..." : "Créer"}
                    </button>
                    <button
                      onClick={() => setCreating(false)}
                      className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Nouveau tag
                </button>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
