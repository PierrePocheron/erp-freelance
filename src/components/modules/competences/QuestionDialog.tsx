"use client"

import { useEffect, useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createInterviewQuestion, updateInterviewQuestion, deleteInterviewQuestion, type QuestionInput } from "@/actions/competences"
import { SkillChipsInput } from "./SkillChipsInput"

export type QuestionForEdit = {
  id: string
  question: string
  answer: string | null
  difficulty: number | null
  status: "TO_REVIEW" | "REVIEWED"
  applicationId: string | null
  skillNames: string[]
}

export function QuestionDialog({
  open, onOpenChange, questionForEdit, defaultApplicationId, applications, skillSuggestions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  questionForEdit?: QuestionForEdit
  defaultApplicationId?: string | null
  applications: { id: string; label: string }[]
  skillSuggestions: string[]
}) {
  const router = useRouter()
  const fid = useId()
  const isEdit = !!questionForEdit
  const [isPending, start] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState("")
  const [status, setStatus] = useState<"TO_REVIEW" | "REVIEWED">("TO_REVIEW")
  const [applicationId, setApplicationId] = useState("")

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuestion(questionForEdit?.question ?? "")
    setAnswer(questionForEdit?.answer ?? "")
    setSkills(questionForEdit?.skillNames ?? [])
    setDifficulty(questionForEdit?.difficulty != null ? String(questionForEdit.difficulty) : "")
    setStatus(questionForEdit?.status ?? "TO_REVIEW")
    setApplicationId(questionForEdit?.applicationId ?? defaultApplicationId ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, questionForEdit, defaultApplicationId])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    const input: QuestionInput = {
      question: question.trim(),
      answer: answer.trim() || null,
      difficulty: difficulty ? Number(difficulty) : null,
      status,
      applicationId: applicationId || null,
      skillNames: skills,
    }
    start(async () => {
      try {
        if (isEdit) await updateInterviewQuestion(questionForEdit!.id, input)
        else await createInterviewQuestion(input)
        onOpenChange(false); router.refresh()
      } catch { toast.error("Enregistrement impossible") }
    })
  }
  function handleDelete() {
    if (!questionForEdit) return
    startDelete(async () => {
      try { await deleteInterviewQuestion(questionForEdit.id); onOpenChange(false); router.refresh() }
      catch { toast.error("Suppression impossible") }
    })
  }

  const inputCls = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
  const taCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Modifier la question" : "Nouvelle question technique"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={`${fid}-q`} className="text-xs text-muted-foreground">Question *</label>
            <textarea id={`${fid}-q`} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} required autoFocus
              placeholder="Ex : Avantages et inconvénients d'un ORM ?" className={taCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${fid}-skills`} className="text-xs text-muted-foreground">Compétences / thèmes</label>
            <SkillChipsInput id={`${fid}-skills`} value={skills} onChange={setSkills} suggestions={skillSuggestions} placeholder="Ex : ORM, Spring, SQL…" />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${fid}-a`} className="text-xs text-muted-foreground">Réponse / notes à revoir</label>
            <textarea id={`${fid}-a`} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3}
              placeholder="Ce que j'ai répondu, la bonne réponse, points à retravailler…" className={taCls} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label htmlFor={`${fid}-diff`} className="text-xs text-muted-foreground">Difficulté</label>
              <select id={`${fid}-diff`} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="1">Facile</option>
                <option value="2">Moyen</option>
                <option value="3">Difficile</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${fid}-status`} className="text-xs text-muted-foreground">Statut</label>
              <select id={`${fid}-status`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
                <option value="TO_REVIEW">À revoir</option>
                <option value="REVIEWED">Revu</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${fid}-app`} className="text-xs text-muted-foreground">Entretien</label>
              <select id={`${fid}-app`} value={applicationId} onChange={(e) => setApplicationId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {applications.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={handleDelete} disabled={isDeleting || isPending} className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </Button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
              <Button type="submit" disabled={isPending || !question.trim()}>{isEdit ? "Enregistrer" : "Créer"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
