"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Pencil, CheckCircle2, Circle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { QuestionDialog, type QuestionForEdit } from "./QuestionDialog"
import { setQuestionStatus } from "@/actions/competences"

type QItem = {
  id: string
  question: string
  answer: string | null
  difficulty: number | null
  status: "TO_REVIEW" | "REVIEWED"
  application: { id: string; companyName: string } | null
  skills: { skill: { id: string; name: string } }[]
}

const DIFF: Record<number, string> = { 1: "Facile", 2: "Moyen", 3: "Difficile" }

export function QuestionsView({
  questions, applications, skillSuggestions,
}: {
  questions: QItem[]
  applications: { id: string; label: string }[]
  skillSuggestions: string[]
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; editing?: QuestionForEdit }>({ open: false })
  const [q, setQ] = useState("")
  const [skill, setSkill] = useState("")
  const [status, setStatus] = useState<"all" | "TO_REVIEW" | "REVIEWED">("all")

  const allSkillNames = useMemo(
    () => [...new Set(questions.flatMap((x) => x.skills.map((s) => s.skill.name)))].sort((a, b) => a.localeCompare(b)),
    [questions],
  )

  const filtered = questions.filter((x) => {
    if (status !== "all" && x.status !== status) return false
    if (skill && !x.skills.some((s) => s.skill.name === skill)) return false
    if (q && !`${x.question} ${x.answer ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const openEdit = (x: QItem) => setDialog({ open: true, editing: {
    id: x.id, question: x.question, answer: x.answer, difficulty: x.difficulty, status: x.status,
    applicationId: x.application?.id ?? null, skillNames: x.skills.map((s) => s.skill.name),
  } })
  const toggle = (x: QItem) =>
    setQuestionStatus(x.id, x.status === "REVIEWED" ? "TO_REVIEW" : "REVIEWED").then(() => router.refresh())

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une question…" aria-label="Rechercher une question"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <select value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Filtrer par compétence"
          className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="">Toutes compétences</option>
          {allSkillNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-input text-xs">
          {(["all", "TO_REVIEW", "REVIEWED"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s}
              className={cn("px-2.5 py-2", status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {s === "all" ? "Tout" : s === "TO_REVIEW" ? "À revoir" : "Revu"}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true })} className="h-9 gap-1.5"><Plus className="h-3.5 w-3.5" /> Question</Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {questions.length === 0
            ? "Aucune question pour l'instant. Ajoutez celles posées lors de vos entretiens !"
            : "Aucune question ne correspond aux filtres."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((x) => (
            <div key={x.id} className="group rounded-xl border border-border/50 bg-card p-3">
              <div className="flex items-start gap-2">
                <button onClick={() => toggle(x)} title={x.status === "REVIEWED" ? "Marquer à revoir" : "Marquer revu"}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground">
                  {x.status === "REVIEWED" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{x.question}</p>
                  {x.answer && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{x.answer}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {x.skills.map((s) => (
                      <Link key={s.skill.id} href={`/competences/${s.skill.id}`} className="rounded-full border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted">{s.skill.name}</Link>
                    ))}
                    {x.difficulty && <span className="text-[10px] text-muted-foreground">{DIFF[x.difficulty]}</span>}
                    {x.application && <Link href={`/entretiens/${x.application.id}`} className="text-[10px] text-muted-foreground hover:underline">· {x.application.companyName}</Link>}
                  </div>
                </div>
                <button onClick={() => openEdit(x)} title="Modifier"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuestionDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        questionForEdit={dialog.editing}
        applications={applications}
        skillSuggestions={skillSuggestions}
      />
    </div>
  )
}
