"use client"

import { useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CornerDownRight } from "lucide-react"
import { toast } from "sonner"
import { createSkill } from "@/actions/competences"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * Quick-add inline « en rafale » (calqué sur AddTaskForm) : ajoute une compétence
 * sous un parent donné (ou à la racine), le type est hérité du contexte et jamais
 * demandé. Après ajout, le champ se vide et se refocus pour enchaîner. `Escape` ferme.
 */
export function SkillQuickAdd({
  parentId,
  type,
  placeholder = "Nouvelle sous-compétence — Entrée pour ajouter",
  onClose,
}: {
  parentId: string | null
  type: "HARD" | "SOFT"
  placeholder?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    const name = inputRef.current?.value.trim()
    if (!name) return
    submittingRef.current = true
    start(async () => {
      try {
        await createSkill({ name, type, parentId, level: 0, status: "TO_ACQUIRE" })
        toast.success(`« ${name} » ajoutée`)
        if (inputRef.current) {
          inputRef.current.value = ""
          inputRef.current.focus()
        }
        router.refresh()
      } catch {
        toast.error("Ajout impossible")
      } finally {
        submittingRef.current = false
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
      className="flex items-center gap-1.5 py-1"
    >
      <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <Input ref={inputRef} autoFocus placeholder={placeholder} className="h-7 flex-1 text-sm" aria-label="Nom de la nouvelle compétence" />
      <Button type="submit" size="xs" disabled={isPending}>{isPending ? "…" : "Ajouter"}</Button>
      <Button type="button" size="xs" variant="ghost" onClick={onClose}>Fermer</Button>
    </form>
  )
}
