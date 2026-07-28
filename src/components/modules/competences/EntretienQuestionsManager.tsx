"use client"

import { useState } from "react"
import { Plus, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { QuestionDialog, type QuestionForEdit } from "./QuestionDialog"

type Q = {
  id: string
  question: string
  answer: string | null
  difficulty: number | null
  status: "TO_REVIEW" | "REVIEWED"
  skills: { skill: { id: string; name: string } }[]
}

/** Questions posées lors d'un entretien : capture rapide depuis la fiche entretien. */
export function EntretienQuestionsManager({
  applicationId, applicationLabel, questions, skillSuggestions,
}: {
  applicationId: string
  applicationLabel: string
  questions: Q[]
  skillSuggestions: string[]
}) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: QuestionForEdit }>({ open: false })
  const apps = [{ id: applicationId, label: applicationLabel }]

  const edit = (qx: Q) => setDialog({ open: true, editing: {
    id: qx.id, question: qx.question, answer: qx.answer, difficulty: qx.difficulty, status: qx.status,
    applicationId, skillNames: qx.skills.map((s) => s.skill.name),
  } })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><HelpCircle className="h-3.5 w-3.5" /> Questions posées</p>
        <Button size="sm" variant="outline" onClick={() => setDialog({ open: true })} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> Ajouter</Button>
      </div>
      {questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune question notée pour cet entretien.</p>
      ) : (
        <ul className="space-y-1">
          {questions.map((qx) => (
            <li key={qx.id} className="flex items-start gap-2 text-sm">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", qx.status === "REVIEWED" ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
              <button onClick={() => edit(qx)} className="flex-1 text-left hover:underline">{qx.question}</button>
            </li>
          ))}
        </ul>
      )}
      <QuestionDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        questionForEdit={dialog.editing}
        defaultApplicationId={applicationId}
        applications={apps}
        skillSuggestions={skillSuggestions}
      />
    </div>
  )
}
