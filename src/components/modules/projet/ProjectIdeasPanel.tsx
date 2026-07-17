"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Lightbulb, Plus, Trash2, Loader2, ArrowRight, X, ChevronDown, ChevronRight, Copy, Check,
} from "lucide-react"
import {
  createProjectIdea, updateProjectIdea, deleteProjectIdea, convertIdeaToProject,
} from "@/actions/projet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Idea = { id: string; title: string; content: string; createdAt: Date }
type Company = { id: string; name: string; city: string | null }

// ── IdeaCard ─────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  userId,
  companies,
  onDelete,
}: {
  idea: Idea
  userId: string
  companies: Company[]
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const [expanded,       setExpanded]       = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [isPending,      startTransition]   = useTransition()
  const [title,          setTitle]          = useState(idea.title)
  const [content, setContent] = useState(idea.content)
  const [showConvert, setShowConvert] = useState(false)
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "")
  const [keepIdea, setKeepIdea] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTitleBlur() {
    if (title.trim() && title !== idea.title) {
      startTransition(() => updateProjectIdea(idea.id, userId, { title: title.trim() }))
    }
  }

  function handleContentChange(val: string) {
    setContent(val)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      startTransition(() => updateProjectIdea(idea.id, userId, { content: val }))
    }, 800)
  }

  function handleDelete() {
    onDelete(idea.id)
    startTransition(() => deleteProjectIdea(idea.id, userId))
  }

  function handleSave() {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    startTransition(async () => {
      await updateProjectIdea(idea.id, userId, { title: title.trim() || idea.title, content })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleCopy() {
    const text = `# ${title}\n\n${content}`
    navigator.clipboard.writeText(text)
  }

  function handleConvert() {
    startTransition(async () => {
      const project = await convertIdeaToProject(idea.id, userId, companyId || null, !keepIdea)
      if (!keepIdea) onDelete(idea.id)
      router.push(`/projets/${project.id}`)
    })
  }

  return (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card transition-all",
      expanded && "border-border"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 group">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>

        <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />

        {expanded ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="flex-1 text-sm font-semibold bg-transparent outline-none border-b border-transparent focus:border-primary"
          />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex-1 text-left text-sm font-semibold truncate"
          >
            {title}
          </button>
        )}

        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
          {new Date(idea.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>

        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}

        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity">
          {expanded && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className={cn(
                "p-1 transition-colors",
                saved ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-600"
              )}
              title="Valider les modifications"
            >
              {saved
                ? <Check className="h-3.5 w-3.5" />
                : isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Copier le contenu (pour l'IA)"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setExpanded(true); setShowConvert(true) }}
            className="text-muted-foreground hover:text-primary p-1 transition-colors"
            title="Convertir en projet"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleDelete}
                className="text-[10px] font-medium text-destructive hover:opacity-80 px-1">
                Oui
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1">
                Non
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground hover:text-destructive p-1 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Contenu expandé */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30">
          {/* Zone de notes (pour l'IA) */}
          <div className="pt-3">
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Notes · prompt IA · contexte du projet
            </p>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={8}
              placeholder={`Décris ton projet ici pour prompter ton IA...\n\nExemple :\n- Stack technique souhaitée\n- Fonctionnalités principales\n- Contraintes et contexte\n- Public cible\n- Intégrations nécessaires`}
              className="w-full text-sm bg-muted/30 rounded-lg border border-border/50 px-3 py-2.5 resize-y outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 leading-relaxed font-mono"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-muted-foreground">Sauvegarde automatique • {content.length} caractères</p>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                {"Copier pour l'IA"}
              </button>
            </div>
          </div>

          {/* Convertir en projet */}
          {showConvert ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Convertir en projet</p>
                <button type="button" onClick={() => setShowConvert(false)}>
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Société</label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">— Aucune société —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.city ? ` (${c.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepIdea}
                    onChange={(e) => setKeepIdea(e.target.checked)}
                    className="rounded"
                  />
                  {"Conserver l'idée après conversion"}
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={handleConvert}
                  className="gap-1.5"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Créer le projet
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowConvert(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConvert(true)}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Convertir en projet
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── ProjectIdeasPanel ─────────────────────────────────────────────────────────

export function ProjectIdeasPanel({
  userId,
  initialIdeas,
  companies,
}: {
  userId: string
  initialIdeas: Idea[]
  companies: Company[]
}) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [newTitle, setNewTitle] = useState("")
  const [isPending, startTransition] = useTransition()
  const [collapsed, setCollapsed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const t = newTitle.trim()
    if (!t || isPending) return
    const optimistic = { id: `tmp-${Date.now()}`, title: t, content: "", createdAt: new Date() }
    setIdeas((prev) => [optimistic, ...prev])
    setNewTitle("")
    startTransition(async () => {
      const idea = await createProjectIdea(userId, t)
      setIdeas((prev) => prev.map((i) => i.id === optimistic.id ? idea : i))
      inputRef.current?.focus()
    })
  }

  function handleDelete(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <h2 className="font-semibold">Idées de projets</h2>
        <span className="text-xs text-muted-foreground">{ideas.length}</span>
      </div>

      {!collapsed && (
        <>
          {/* Formulaire création */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre de l'idée..."
              className="h-8 text-sm"
              disabled={isPending}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!newTitle.trim() || isPending}
              className="gap-1 h-8"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Ajouter
            </Button>
          </form>

          {/* Liste */}
          {ideas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">{"Aucune idée pour l'instant"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{"Notez vos idées de projets avant de les lancer"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  userId={userId}
                  companies={companies}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
