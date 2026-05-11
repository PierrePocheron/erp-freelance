"use client"

import { useTransition, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { createTask } from "@/actions/projet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddTaskForm({
  projectId,
  parentTaskId,
  placeholder = "Nouvelle tâche...",
}: {
  projectId: string
  parentTaskId?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (parentTaskId) formData.set("parentTaskId", parentTaskId)
    startTransition(async () => {
      await createTask(projectId, formData)
      ref.current?.reset()
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
      >
        <Plus className="h-3.5 w-3.5" />
        {placeholder}
      </button>
    )
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="flex gap-2">
      <Input name="title" placeholder={placeholder} autoFocus className="h-8 text-sm" required />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "..." : "Ajouter"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        ✕
      </Button>
    </form>
  )
}
