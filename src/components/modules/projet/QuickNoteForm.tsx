"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"

export function QuickNoteForm({ action }: { action: (fd: FormData) => Promise<void> }) {
  const ref = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd+Enter soumet, Enter seul agrandit (comportement textarea normal)
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      ref.current?.requestSubmit()
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    action(fd).then(() => {
      if (ref.current) ref.current.reset()
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    })
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        ref={textareaRef}
        name="content"
        rows={1}
        placeholder="Note, décision, retour client…"
        required
        onInput={resize}
        onKeyDown={handleKeyDown}
        className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none overflow-hidden"
      />
      <Button type="submit" size="sm" variant="outline" className="self-end shrink-0">
        Ajouter
      </Button>
    </form>
  )
}
