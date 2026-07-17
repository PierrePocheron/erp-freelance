"use client"

import { useState, useTransition, useRef } from "react"
import { Pencil, Check, X } from "lucide-react"
import { updateProjectInfo, updateProjectStatus, updateProjectPriority, updateProjectCategory } from "@/actions/projet"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CATEGORY_CONFIG, ALL_CATEGORIES } from "./category-config"
import type { ProjectCategory } from "@/generated/prisma/enums"

// ── Statut du projet ──────────────────────────────────────────────────────────

const statusOptions = [
  { value: "ACTIVE", label: "Actif", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  { value: "PAUSED", label: "En pause", cls: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  { value: "COMPLETED", label: "Terminé", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  { value: "ARCHIVED", label: "Archivé", cls: "bg-muted text-muted-foreground border-border" },
]

export function ProjectStatusEdit({
  projectId,
  value,
}: {
  projectId: string
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current = statusOptions.find((s) => s.value === value) ?? statusOptions[0]

  function pick(next: string) {
    if (next === value) { setOpen(false); return }
    startTransition(async () => {
      await updateProjectStatus(projectId, next as "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED")
      toast.success("Statut mis à jour")
      setOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75",
          current.cls
        )}
      >
        {current.label}
        <Pencil className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-32">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => pick(opt.value)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs rounded-md hover:bg-muted transition-colors",
                  opt.value === value && "font-medium"
                )}
              >
                <span className={cn("inline-block rounded-full px-2 py-0.5 border text-xs", opt.cls)}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Catégorie (thème) du projet ───────────────────────────────────────────────

export function ProjectCategoryEdit({
  projectId,
  value,
}: {
  projectId: string
  value: ProjectCategory
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current = CATEGORY_CONFIG[value] ?? CATEGORY_CONFIG.AUTRE

  function pick(next: ProjectCategory) {
    if (next === value) { setOpen(false); return }
    startTransition(async () => {
      await updateProjectCategory(projectId, next)
      toast.success("Catégorie mise à jour")
      setOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75",
          current.chipCls
        )}
      >
        {current.label}
        <Pencil className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-40">
            {ALL_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs rounded-md hover:bg-muted transition-colors",
                  c === value && "font-medium"
                )}
              >
                <span className="flex items-center gap-2">
                  {/* Échantillon couleur + motif de la bannière */}
                  <span
                    className={cn("inline-block h-3.5 w-6 rounded-sm shrink-0", CATEGORY_CONFIG[c].bannerCls)}
                    style={CATEGORY_CONFIG[c].pattern}
                  />
                  <span className={cn("inline-block rounded-full px-2 py-0.5 border text-xs", CATEGORY_CONFIG[c].chipCls)}>
                    {CATEGORY_CONFIG[c].label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Priorité du projet ────────────────────────────────────────────────────────

export const PRIORITY_CONFIG = {
  LOW:    { label: "Basse",    cls: "text-slate-500 border-slate-500/30 bg-slate-500/10" },
  MEDIUM: { label: "Normale",  cls: "text-blue-500 border-blue-500/30 bg-blue-500/10"   },
  HIGH:   { label: "Haute",    cls: "text-amber-500 border-amber-500/40 bg-amber-500/10" },
  URGENT: { label: "Urgente",  cls: "text-red-500 border-red-500/40 bg-red-500/10"       },
} as const

export type ProjectPriority = keyof typeof PRIORITY_CONFIG

export function ProjectPriorityEdit({
  projectId,
  value,
}: {
  projectId: string
  value: ProjectPriority
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current = PRIORITY_CONFIG[value] ?? PRIORITY_CONFIG.MEDIUM

  function pick(next: ProjectPriority) {
    if (next === value) { setOpen(false); return }
    startTransition(async () => {
      await updateProjectPriority(projectId, next)
      toast.success("Priorité mise à jour")
      setOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75",
          current.cls
        )}
      >
        {current.label}
        <Pencil className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-32">
            {(Object.keys(PRIORITY_CONFIG) as ProjectPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => pick(p)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs rounded-md hover:bg-muted transition-colors",
                  p === value && "font-medium"
                )}
              >
                <span className={cn("inline-block rounded-full px-2 py-0.5 border text-xs", PRIORITY_CONFIG[p].cls)}>
                  {PRIORITY_CONFIG[p].label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Nom du projet ─────────────────────────────────────────────────────────────

export function ProjectNameEdit({ projectId, value }: { projectId: string; value: string }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLInputElement>(null)

  function save() {
    const name = ref.current?.value.trim()
    if (!name) return
    startTransition(async () => {
      await updateProjectInfo(projectId, { name })
      setEditing(false)
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save()
    if (e.key === "Escape") setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          defaultValue={value}
          onKeyDown={onKeyDown}
          autoFocus
          onBlur={save}
          className="text-2xl font-bold tracking-tight bg-transparent border-b-2 border-primary outline-none w-full"
        />
        <button onClick={save} disabled={isPending} className="text-emerald-500 hover:text-emerald-600 shrink-0">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
    >
      <h1 className="text-2xl font-bold tracking-tight">{value}</h1>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity" />
    </button>
  )
}

// ── Description ───────────────────────────────────────────────────────────────

export function ProjectDescriptionEdit({
  projectId,
  value,
}: {
  projectId: string
  value: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLTextAreaElement>(null)

  function save() {
    const description = ref.current?.value.trim() || null
    startTransition(async () => {
      await updateProjectInfo(projectId, { description })
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-start gap-2">
        <textarea
          ref={ref}
          defaultValue={value ?? ""}
          autoFocus
          rows={2}
          placeholder="Ajouter une description..."
          onBlur={save}
          className="flex-1 resize-none bg-transparent border border-input rounded-md px-2 py-1 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex flex-col gap-1">
          <button onClick={save} disabled={isPending} className="text-emerald-500 hover:text-emerald-600">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
    >
      <p className={cn("text-sm", value ? "text-muted-foreground" : "text-muted-foreground/50 italic")}>
        {value ?? "Ajouter une description..."}
      </p>
      <Pencil className="h-3 w-3 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

// ── Heures estimées ───────────────────────────────────────────────────────────

export function ProjectHoursEdit({
  projectId,
  value,
}: {
  projectId: string
  value: number | null
}) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLInputElement>(null)

  function save() {
    const raw = ref.current?.value
    const estimatedHours = raw ? parseFloat(raw) : null
    startTransition(async () => {
      await updateProjectInfo(projectId, { estimatedHours })
      setEditing(false)
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save()
    if (e.key === "Escape") setEditing(false)
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/5 px-2.5 py-0.5">
        <input
          ref={ref}
          type="number"
          defaultValue={value ?? ""}
          onKeyDown={onKeyDown}
          autoFocus
          min="0"
          step="0.5"
          placeholder="0"
          onBlur={save}
          className="w-14 bg-transparent text-xs outline-none"
        />
        <span className="text-xs text-muted-foreground">h</span>
        <button onClick={save} disabled={isPending} className="text-emerald-500 hover:text-emerald-600">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5",
        value ? "border-border bg-muted/50 text-foreground" : "border-dashed border-border text-muted-foreground"
      )}
    >
      <span>⏱</span>
      {value ? `${value}h estimées` : "Heures estimées"}
      <Pencil className="h-2.5 w-2.5 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity" />
    </button>
  )
}
