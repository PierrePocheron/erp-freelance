"use client"

import { useOptimistic, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Pencil, Trash2, Check, X, Users } from "lucide-react"
import { assignContactToTeam, createCompanyTeam, deleteCompanyTeam, renameCompanyTeam, updateContactOrgLevel } from "@/actions/crm"
import { avatarColor, initials } from "@/lib/initials"
import { cn } from "@/lib/utils"

export type OrgLevel = "DIRECTION" | "MANAGER" | "CDI" | "ALTERNANT" | "STAGIAIRE" | "PRESTATAIRE"
export type OrgTeam = { id: string; name: string; color: string }
export type OrgMember = {
  id: string
  name: string
  jobTitle: string | null
  teamId: string | null
  orgLevel: OrgLevel | null
}

// L'ordre de cette liste EST l'ordre d'affichage dans une zone : direction et
// managers en haut, CDI au milieu, alternance/stage en bas.
const ORG_LEVELS: { value: OrgLevel; label: string; badge: string }[] = [
  { value: "DIRECTION",   label: "Direction",   badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400"    },
  { value: "MANAGER",     label: "Manager",     badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  { value: "CDI",         label: "CDI",         badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400"       },
  { value: "ALTERNANT",   label: "Alternance",  badge: "bg-teal-500/15 text-teal-700 dark:text-teal-400"       },
  { value: "STAGIAIRE",   label: "Stage",       badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400"          },
  { value: "PRESTATAIRE", label: "Prestataire", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
]
const LEVEL_META = Object.fromEntries(ORG_LEVELS.map((l) => [l.value, l])) as Record<OrgLevel, (typeof ORG_LEVELS)[number]>
const levelRank = (l: OrgLevel | null) => (l ? ORG_LEVELS.findIndex((x) => x.value === l) : ORG_LEVELS.length)

const UNASSIGNED = "__unassigned__"

// ── Carte personne ────────────────────────────────────────────────────────────

function MemberCard({ m, onLevel }: { m: OrgMember; onLevel: (id: string, level: OrgLevel | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: m.id })
  const meta = m.orgLevel ? LEVEL_META[m.orgLevel] : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2 py-1.5",
        isDragging && "opacity-30",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0 touch-none"
        aria-label={`Déplacer ${m.name} vers une autre zone`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: avatarColor(m.name) }}
        aria-hidden
      >
        {initials(m.name)}
      </span>

      <div className="min-w-0 flex-1">
        <Link href={`/contacts/${m.id}`} className="block truncate text-sm font-medium hover:text-primary transition-colors">
          {m.name}
        </Link>
        {m.jobTitle && <p className="truncate text-[11px] text-muted-foreground">{m.jobTitle}</p>}
      </div>

      {/* Le badge de niveau EST le sélecteur (select natif stylé) — un seul contrôle. */}
      <select
        value={m.orgLevel ?? ""}
        onChange={(e) => onLevel(m.id, (e.target.value || null) as OrgLevel | null)}
        aria-label={`Niveau de ${m.name}`}
        className={cn(
          "shrink-0 cursor-pointer appearance-none rounded-full px-2 py-0.5 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          meta ? meta.badge : "bg-muted text-muted-foreground",
        )}
      >
        <option value="">Niveau…</option>
        {ORG_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Zone (équipe / pôle / « à affecter ») ─────────────────────────────────────

function Zone({
  id, name, color, members, dashed, onLevel, onRename, onDelete,
}: {
  id: string
  name: string
  color: string
  members: OrgMember[]
  dashed?: boolean
  onLevel: (id: string, level: OrgLevel | null) => void
  onRename?: (name: string) => void
  onDelete?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  // Groupes de niveau, dans l'ordre hiérarchique ; « Non précisé » en dernier.
  const groups = [...ORG_LEVELS.map((l) => l.value), null as OrgLevel | null]
    .map((level) => ({ level, list: members.filter((m) => m.orgLevel === level) }))
    .filter((g) => g.list.length > 0)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors",
        dashed ? "border-dashed border-border" : "border-border/50",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        {editing ? (
          <form
            className="flex flex-1 items-center gap-1"
            onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onRename?.(draft); setEditing(false) }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setDraft(name); setEditing(false) } }}
              className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm"
              aria-label="Nom de la zone"
              autoFocus
            />
            <button type="submit" className="p-1 text-muted-foreground hover:text-foreground" aria-label="Valider"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { setDraft(name); setEditing(false) }} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Annuler"><X className="h-3.5 w-3.5" /></button>
          </form>
        ) : (
          <>
            <h3 className="flex-1 truncate text-sm font-semibold">{name}</h3>
            <span className="text-xs text-muted-foreground">{members.length}</span>
            {onRename && (
              <button type="button" onClick={() => setEditing(true)} className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors" aria-label={`Renommer la zone ${name}`}>
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => { if (confirm(`Supprimer la zone « ${name} » ? Ses membres repasseront dans « À affecter ».`)) onDelete() }}
                className="p-1 text-muted-foreground/60 hover:text-red-500 transition-colors"
                aria-label={`Supprimer la zone ${name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>

      {members.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-muted-foreground">Déposer une personne ici</p>
      ) : (
        groups.map((g) => (
          <div key={g.level ?? "none"} className="space-y-1">
            <p className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {g.level ? LEVEL_META[g.level].label : "Non précisé"}
            </p>
            {g.list.map((m) => <MemberCard key={m.id} m={m} onLevel={onLevel} />)}
          </div>
        ))
      )}
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────

/**
 * Organigramme d'une société : une zone par équipe/pôle (+ « À affecter » pour
 * les contacts non classés), personnes triées par niveau dans chaque zone
 * (direction et managers en haut, alternance/stage en bas). Le glisser-déposer
 * change de zone, le badge de niveau est un select natif.
 */
export function CompanyOrgBoard({
  companyId, teams, members,
}: {
  companyId: string
  teams: OrgTeam[]
  members: OrgMember[]
}) {
  const [, start] = useTransition()
  // useOptimistic (et non useState) : l'état revient automatiquement aux props
  // serveur une fois l'action terminée — pas d'état local qui se périme.
  const [view, patch] = useOptimistic(
    members,
    (state: OrgMember[], p: { id: string } & Partial<OrgMember>) =>
      state.map((m) => (m.id === p.id ? { ...m, ...p } : m)),
  )
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [dragged, setDragged] = useState<OrgMember | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const byLevelThenName = (a: OrgMember, b: OrgMember) =>
    levelRank(a.orgLevel) - levelRank(b.orgLevel) || a.name.localeCompare(b.name, "fr")

  const inZone = (teamId: string | null) =>
    view.filter((m) => m.teamId === teamId).sort(byLevelThenName)

  // useOptimistic annule tout seul en cas d'échec : sans message, la carte
  // reviendrait à sa place sans explication.
  const run = async (p: Promise<unknown>) => {
    try { await p } catch { toast.error("Modification impossible") }
  }

  const setLevel = (id: string, orgLevel: OrgLevel | null) =>
    start(async () => {
      patch({ id, orgLevel })
      await run(updateContactOrgLevel(id, orgLevel))
    })

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragged(null)
    if (!over) return
    const id = String(active.id)
    const teamId = over.id === UNASSIGNED ? null : String(over.id)
    if (view.find((m) => m.id === id)?.teamId === teamId) return
    start(async () => {
      patch({ id, teamId })
      await run(assignContactToTeam(id, teamId))
    })
  }

  const addTeam = (name: string) =>
    start(async () => {
      await run(createCompanyTeam(companyId, name))
      setNewName("")
      setAdding(false)
    })

  if (members.length === 0 && teams.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun contact associé</p>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => setDragged(view.find((m) => m.id === String(active.id)) ?? null)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Zone
          id={UNASSIGNED}
          name="À affecter"
          color="#94a3b8"
          members={inZone(null)}
          dashed
          onLevel={setLevel}
        />

        {teams.map((t) => (
          <Zone
            key={t.id}
            id={t.id}
            name={t.name}
            color={t.color}
            members={inZone(t.id)}
            onLevel={setLevel}
            onRename={(name) => start(() => run(renameCompanyTeam(t.id, name)))}
            onDelete={() => start(() => run(deleteCompanyTeam(t.id)))}
          />
        ))}

        {/* Créer une zone */}
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 p-3">
          {adding ? (
            <form
              className="flex w-full items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); if (newName.trim()) addTeam(newName) }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setNewName(""); setAdding(false) } }}
                placeholder="Nom de la zone (ex. ALH)"
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                aria-label="Nom de la nouvelle zone"
                autoFocus
              />
              <button type="submit" className="p-1 text-muted-foreground hover:text-foreground" aria-label="Créer la zone"><Check className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setNewName(""); setAdding(false) }} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Annuler"><X className="h-4 w-4" /></button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" /> Nouvelle zone
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {dragged && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-card px-2 py-1.5 text-sm font-medium shadow-xl">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {dragged.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
