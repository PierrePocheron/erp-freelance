"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Check, Search, HelpCircle, Pin, PinOff, ChevronDown, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createInterviewAnswer, updateInterviewAnswer, deleteInterviewAnswer, toggleInterviewAnswerPinned,
  setAnswerApplications,
} from "@/actions/entretien"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type LinkedApp = { id: string; companyName: string; position: string }
type InterviewAnswer = {
  id: string
  question: string
  answer: string
  category: string | null
  pinned: boolean
  updatedAt: Date | string
  applications: LinkedApp[]
}

export function InterviewFaqView({ answers, applications }: { answers: InterviewAnswer[]; applications: LinkedApp[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [category, setCategory] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [linkedAppIds, setLinkedAppIds] = useState<string[]>([]) // candidatures liées (éditeur)
  const [isPending, startTransition] = useTransition()

  // Recherche + filtre catégorie
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState<string | null>(null)

  const categories = useMemo(
    () => Array.from(new Set(answers.map((a) => a.category).filter(Boolean) as string[])).sort(),
    [answers]
  )

  // Recherche multi-mots (tous les mots doivent apparaître) sur question + réponse + catégorie.
  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return answers.filter((a) => {
      if (catFilter && a.category !== catFilter) return false
      if (tokens.length === 0) return true
      const hay = `${a.question} ${a.answer} ${a.category ?? ""}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [answers, search, catFilter])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function startCreate() {
    setEditingId("new"); setQuestion(""); setAnswer(""); setCategory(""); setLinkedAppIds([])
  }
  function startEdit(a: InterviewAnswer) {
    setEditingId(a.id); setQuestion(a.question); setAnswer(a.answer); setCategory(a.category ?? "")
    setLinkedAppIds(a.applications.map((x) => x.id))
  }
  function toggleLinkedApp(id: string) {
    setLinkedAppIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  function save() {
    if (!question.trim() || !answer.trim()) return
    startTransition(async () => {
      let id: string | null = editingId === "new" ? null : editingId
      if (editingId === "new") {
        id = await createInterviewAnswer({ question, answer, category })
        toast.success("Réponse ajoutée")
      } else if (editingId) {
        await updateInterviewAnswer(editingId, { question, answer, category })
        toast.success("Réponse mise à jour")
      }
      if (id) await setAnswerApplications(id, linkedAppIds)
      setEditingId(null)
      router.refresh()
    })
  }
  function remove(id: string) {
    setConfirmDeleteId(null)
    startTransition(async () => {
      await deleteInterviewAnswer(id)
      toast.success("Réponse supprimée")
      router.refresh()
    })
  }
  function togglePin(id: string) {
    startTransition(async () => {
      await toggleInterviewAnswerPinned(id)
      router.refresh()
    })
  }

  const editorOpen = editingId !== null

  return (
    <div className="space-y-4">
      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une question, une réponse, un mot-clé…"
          className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <CatChip label="Toutes" active={catFilter === null} onClick={() => setCatFilter(null)} />
          {categories.map((c) => (
            <CatChip key={c} label={c} active={catFilter === c} onClick={() => setCatFilter(catFilter === c ? null : c)} />
          ))}
        </div>
      )}

      {/* Éditeur */}
      {editorOpen ? (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{editingId === "new" ? "Nouvelle réponse" : "Modifier la réponse"}</h2>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Question / sujet</label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex : Parlez-moi de vous" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Réponse préparée</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={8}
              placeholder="Votre réponse-type, les points clés à ne pas oublier…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-y leading-relaxed"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Catégorie (optionnel)</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Présentation, Motivation, Technique, Salaire, Lettre de motivation…" list="faq-categories" />
            <datalist id="faq-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          {applications.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Utilisé pour ces candidatures</label>
              <div className="flex flex-wrap gap-1.5">
                {applications.map((app) => {
                  const on = linkedAppIds.includes(app.id)
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => toggleLinkedApp(app.id)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                        on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      {on && <Check className="h-3 w-3 shrink-0" />}
                      {app.companyName}{app.position ? ` · ${app.position}` : ""}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
              <X className="h-3.5 w-3.5" /> Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={isPending || !question.trim() || !answer.trim()}>
              <Check className="h-3.5 w-3.5" /> {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={startCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nouvelle réponse
        </Button>
      )}

      {/* Liste */}
      {answers.length === 0 && !editorOpen ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <HelpCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucune réponse-type pour le moment</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Ajoutez vos questions fréquentes et vos réponses préparées</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 italic py-2">
          Aucun résultat{search ? ` pour « ${search} »` : ""}{catFilter ? ` dans « ${catFilter} »` : ""}.
        </p>
      ) : (
        <div className="gap-4 lg:columns-2 2xl:columns-3 *:mb-4 *:break-inside-avoid">
          {filtered.map((a) => {
            const isOpen = expanded.has(a.id)
            return (
              <div key={a.id} className="group rounded-xl border border-border/50 bg-card p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(a.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      <p className="text-sm font-semibold leading-snug">{a.question}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => togglePin(a.id)}
                      title={a.pinned ? "Désépingler" : "Épingler"}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        a.pinned ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/30 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hover:text-amber-400"
                      )}
                    >
                      {a.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => startEdit(a)}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === a.id ? (
                      <>
                        <button onClick={() => remove(a.id)} className="text-[10px] font-medium text-destructive hover:opacity-80 px-1">Suppr.</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-muted-foreground px-1">Non</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(a.id)}
                        className="p-1.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className={cn("text-sm text-muted-foreground/90 whitespace-pre-line leading-relaxed pl-5", !isOpen && "line-clamp-3")}>{a.answer}</p>
                {a.category && (
                  <span className="ml-5 inline-block rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                    {a.category}
                  </span>
                )}
                {a.applications.length > 0 && (
                  <div className="ml-5 flex flex-wrap gap-1 pt-0.5">
                    {a.applications.map((app) => (
                      <Link
                        key={app.id}
                        href={`/entretiens/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
                        title="Voir la candidature"
                      >
                        <Briefcase className="h-2.5 w-2.5 shrink-0" /> {app.companyName}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
        active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
