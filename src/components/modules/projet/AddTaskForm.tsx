"use client"

import { useTransition, useRef, useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { createTask } from "@/actions/projet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddTaskForm({
  projectId,
  parentTaskId,
  placeholder = "Nouvelle tâche...",
  isShortcutTarget = false,
}: {
  projectId: string
  parentTaskId?: string
  placeholder?: string
  isShortcutTarget?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  // Listen for the global N shortcut event
  useEffect(() => {
    if (!isShortcutTarget) return
    function onEvent() {
      setOpen(true)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
    document.addEventListener("erp:new-task", onEvent)
    return () => document.removeEventListener("erp:new-task", onEvent)
  }, [isShortcutTarget])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submittingRef.current) return
    const formData = new FormData(e.currentTarget)
    const title = (formData.get("title") as string)?.trim()
    if (!title) return
    if (parentTaskId) formData.set("parentTaskId", parentTaskId)
    submittingRef.current = true
    startTransition(async () => {
      await createTask(projectId, formData)
      submittingRef.current = false
      // Keep form open — reset title, refocus for consecutive add
      if (inputRef.current) {
        inputRef.current.value = ""
        inputRef.current.focus()
      }
      const hoursInput = formRef.current?.querySelector<HTMLInputElement>('input[name="estimatedHours"]')
      if (hoursInput) hoursInput.value = ""
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 30)
        }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
      >
        <Plus className="h-3.5 w-3.5" />
        {placeholder}
      </button>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex gap-2 items-center">
      <Input
        ref={inputRef}
        name="title"
        placeholder={placeholder}
        autoFocus
        className="h-8 text-sm flex-1"
        required
      />
      {!parentTaskId && (
        <Input name="estimatedHours" type="number" min="0" step="0.5" placeholder="~h" className="h-8 text-sm w-16" />
      )}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "..." : "↵"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        ✕
      </Button>
    </form>
  )
}
