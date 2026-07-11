"use client"

import { useState, useTransition, useRef } from "react"
import { Plus, Loader2, X } from "lucide-react"
import { createTaskTag, deleteTaskTag, updateTaskTagColor } from "@/actions/projet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { TaskTag } from "./TaskItem"

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#64748b",
]

export function TagManager({
  projectId,
  initialTags,
}: {
  projectId: string
  initialTags: TaskTag[]
}) {
  const [tags, setTags] = useState(initialTags)
  const [name, setName] = useState("")
  const [color, setColor] = useState(TAG_COLORS[0])
  const [isPending, startTransition] = useTransition()
  const submittingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n || submittingRef.current) return
    if (tags.find((t) => t.name.toLowerCase() === n.toLowerCase())) return
    submittingRef.current = true
    const optimistic: TaskTag = { id: `tmp-${Date.now()}`, name: n, color }
    setTags((prev) => [...prev, optimistic])
    setName("")
    startTransition(async () => {
      await createTaskTag(projectId, n, color)
      submittingRef.current = false
      inputRef.current?.focus()
    })
  }

  function handleDelete(tag: TaskTag) {
    setTags((prev) => prev.filter((t) => t.id !== tag.id))
    startTransition(() => deleteTaskTag(tag.id, projectId))
  }

  function handleColorChange(tag: TaskTag, newColor: string) {
    setTags((prev) => prev.map((t) => t.id === tag.id ? { ...t, color: newColor } : t))
    startTransition(() => updateTaskTagColor(tag.id, projectId, newColor))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Tags existants */}
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center gap-1 group/tag">
          <label
            className="h-3 w-3 rounded-full cursor-pointer shrink-0 hover:scale-110 transition-transform"
            style={{ backgroundColor: tag.color }}
            title="Changer la couleur"
          >
            <input
              type="color"
              className="sr-only"
              defaultValue={tag.color}
              onChange={(e) => handleColorChange(tag, e.target.value)}
            />
          </label>
          <span
            className="text-xs font-medium rounded-full px-2 py-0.5 leading-none"
            style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` }}
          >
            {tag.name}
          </span>
          <button
            type="button"
            onClick={() => handleDelete(tag)}
            className="md:opacity-0 md:group-hover/tag:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            title="Supprimer le tag"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Formulaire création */}
      <form onSubmit={handleCreate} className="flex items-center gap-1.5">
        {/* Color swatches */}
        <div className="flex gap-1">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-4 w-4 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? c : "transparent",
                boxShadow: color === c ? `0 0 0 1px white, 0 0 0 2px ${c}` : "none",
              }}
            />
          ))}
        </div>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nouveau tag"
          className="h-7 text-xs w-28"
          disabled={isPending}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending || !name.trim()}
          className="h-7 px-2 text-xs gap-1"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </form>
    </div>
  )
}
