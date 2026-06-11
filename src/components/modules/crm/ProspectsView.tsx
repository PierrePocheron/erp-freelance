"use client"

import { useState, useTransition } from "react"
import { createProspect, updateProspectStage, getClientPanel } from "@/actions/crm"
import { ClientPanel } from "./ClientPanel"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Plus, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Stage config ──────────────────────────────────────────────────────────────

export const STAGE_CONFIG = {
  IDENTIFIED:    { label: "Identifié",     cls: "bg-slate-500/15 text-slate-600 border-slate-500/20 dark:text-slate-400",    dot: "bg-slate-400"   },
  CONTACTED:     { label: "Contacté",      cls: "bg-blue-500/15 text-blue-600 border-blue-500/20",                           dot: "bg-blue-400"    },
  NO_RESPONSE:   { label: "Sans réponse",  cls: "bg-amber-500/15 text-amber-700 border-amber-500/20",                        dot: "bg-amber-400"   },
  REPLIED:       { label: "A répondu",     cls: "bg-teal-500/15 text-teal-600 border-teal-500/20",                           dot: "bg-teal-400"    },
  MEETING:       { label: "RDV",           cls: "bg-purple-500/15 text-purple-600 border-purple-500/20",                     dot: "bg-purple-400"  },
  PROPOSAL_SENT: { label: "Devis envoyé",  cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20",                     dot: "bg-indigo-400"  },
  NEGOTIATION:   { label: "Négociation",   cls: "bg-violet-500/15 text-violet-600 border-violet-500/20",                     dot: "bg-violet-400"  },
  WON:           { label: "Gagné 🎉",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",                  dot: "bg-emerald-400" },
  LOST:          { label: "Perdu",         cls: "bg-red-500/15 text-red-600 border-red-500/20",                              dot: "bg-red-400"     },
  ON_HOLD:       { label: "En attente",    cls: "bg-gray-500/15 text-gray-500 border-gray-500/20",                           dot: "bg-gray-400"    },
} as const

export type ProspectStage = keyof typeof STAGE_CONFIG

// Stages affichés dans la barre pipeline (ordre logique de progression)
const PIPELINE_STAGES: ProspectStage[] = [
  "IDENTIFIED", "CONTACTED", "NO_RESPONSE", "REPLIED",
  "MEETING", "PROPOSAL_SENT", "NEGOTIATION",
]
const OUTCOME_STAGES: ProspectStage[] = ["WON", "LOST", "ON_HOLD"]

// ── Types ─────────────────────────────────────────────────────────────────────

const tempConfig = {
  COLD: { dot: "bg-blue-500",   label: "Neutre" },
  WARM: { dot: "bg-amber-500",  label: "Tiède"  },
  HOT:  { dot: "bg-red-500",    label: "Chaud"  },
}

const sourceLabels: Record<string, string> = {
  WORD_OF_MOUTH: "Bouche à oreille",
  LINKEDIN:      "LinkedIn",
  WEBSITE:       "Site web",
  INBOUND:       "Entrant",
  OTHER:         "Autre",
}

type Prospect = {
  id: string
  name: string
  company: string | null
  email: string | null
  source: string
  temperature: string
  prospectStage: string
  createdAt: Date | string
  _count: { interactions: number; projects: number }
  interactions: { date: Date | string; channel: string }[]
  reminders: { dueDate: Date | string }[]
}

type PanelData = Awaited<ReturnType<typeof getClientPanel>>

const fmtShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

// ── ProspectsView ─────────────────────────────────────────────────────────────

export function ProspectsView({
  prospects,
  userId,
  initialStage,
}: {
  prospects: Prospect[]
  userId: string
  initialStage?: ProspectStage
}) {
  const [stageFilter, setStageFilter] = useState<ProspectStage | "ALL">(initialStage ?? "ALL")
  const [quickName, setQuickName] = useState("")
  const [isAdding, startAdding] = useTransition()
  const [open, setOpen] = useState(false)
  const [panelData, setPanelData] = useState<PanelData>(null)
  const [isPanelPending, startPanel] = useTransition()

  function openClient(clientId: string) {
    setOpen(true)
    setPanelData(null)
    startPanel(async () => {
      const data = await getClientPanel(clientId, userId)
      setPanelData(data)
    })
  }

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = quickName.trim()
    if (!name) return
    startAdding(async () => {
      await createProspect({ name })
      setQuickName("")
      toast.success(`Prospect "${name}" ajouté`)
    })
  }

  // Comptages par étape
  const countByStage = Object.fromEntries(
    (Object.keys(STAGE_CONFIG) as ProspectStage[]).map((s) => [
      s, prospects.filter((p) => p.prospectStage === s).length,
    ])
  )

  const filtered = stageFilter === "ALL"
    ? prospects
    : prospects.filter((p) => p.prospectStage === stageFilter)

  return (
    <>
      <div className="space-y-4">
        {/* ── Quick add ── */}
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
          <input
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Nom du prospect…"
            disabled={isAdding}
            className="flex-1 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAdding || !quickName.trim()}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAdding ? "Ajout…" : "Ajouter"}
          </button>
        </form>

        {prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">Aucun prospect pour le moment</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Utilisez le champ ci-dessus pour en ajouter un rapidement</p>
          </div>
        ) : (
          <>
            {/* ── Pipeline bar ── */}
            <div className="overflow-x-auto pb-1 -mx-0.5 px-0.5">
              <div className="flex items-center gap-1.5 min-w-max">
                {/* Tous */}
                <button
                  onClick={() => setStageFilter("ALL")}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
                    stageFilter === "ALL"
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  Tous ({prospects.length})
                </button>

                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />

                {/* Étapes pipeline */}
                {PIPELINE_STAGES.map((stage) => {
                  const cfg = STAGE_CONFIG[stage]
                  const count = countByStage[stage] ?? 0
                  const active = stageFilter === stage
                  return (
                    <button
                      key={stage}
                      onClick={() => setStageFilter(active ? "ALL" : stage)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all whitespace-nowrap",
                        active
                          ? cn(cfg.cls, "ring-1 ring-offset-background ring-offset-1 ring-current/40 scale-105")
                          : count > 0
                            ? cn(cfg.cls, "hover:scale-105")
                            : "border-border/40 text-muted-foreground/30"
                      )}
                    >
                      {cfg.label}{count > 0 ? ` (${count})` : ""}
                    </button>
                  )
                })}

                {/* Séparateur */}
                <span className="mx-0.5 h-4 w-px bg-border/60 shrink-0" />

                {/* Étapes résultat */}
                {OUTCOME_STAGES.map((stage) => {
                  const cfg = STAGE_CONFIG[stage]
                  const count = countByStage[stage] ?? 0
                  const active = stageFilter === stage
                  return (
                    <button
                      key={stage}
                      onClick={() => setStageFilter(active ? "ALL" : stage)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all whitespace-nowrap",
                        active
                          ? cn(cfg.cls, "ring-1 ring-offset-background ring-offset-1 ring-current/40 scale-105")
                          : count > 0
                            ? cn(cfg.cls, "hover:scale-105")
                            : "border-border/40 text-muted-foreground/30"
                      )}
                    >
                      {cfg.label}{count > 0 ? ` (${count})` : ""}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Cards ── */}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-2">Aucun prospect à cette étape.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <ProspectCard
                    key={p.id}
                    prospect={p}
                    onClick={() => openClient(p.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[460px] sm:max-w-[460px] p-0" showCloseButton>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ClientPanel client={panelData as any} loading={isPanelPending || (open && panelData === null)} userId={userId} />
        </SheetContent>
      </Sheet>
    </>
  )
}

// ── ProspectCard ──────────────────────────────────────────────────────────────

function ProspectCard({ prospect, onClick }: { prospect: Prospect; onClick: () => void }) {
  const [stageOpen, setStageOpen] = useState(false)
  const [, startTransition] = useTransition()

  const stage = STAGE_CONFIG[prospect.prospectStage as ProspectStage] ?? STAGE_CONFIG.IDENTIFIED
  const temp  = tempConfig[prospect.temperature as keyof typeof tempConfig] ?? tempConfig.COLD
  const lastInteraction = prospect.interactions[0]
  const nextReminder = prospect.reminders[0]

  function pickStage(e: React.MouseEvent, next: ProspectStage) {
    e.stopPropagation()
    setStageOpen(false)
    startTransition(() => updateProspectStage(prospect.id, next))
  }

  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all text-left w-full"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${temp.dot}`} title={temp.label} />
            <p className="text-xs text-muted-foreground truncate">
              {prospect.company ?? sourceLabels[prospect.source] ?? "—"}
            </p>
          </div>
          <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{prospect.name}</p>
          {prospect.email && <p className="text-xs text-muted-foreground truncate">{prospect.email}</p>}
        </div>

        {/* Stage badge + dropdown */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setStageOpen((v) => !v) }}
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
              stage.cls
            )}
          >
            {stage.label}
          </button>

          {stageOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStageOpen(false) }} />
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-40">
                {/* Pipeline */}
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Pipeline</p>
                {PIPELINE_STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => pickStage(e, s)}
                    className={cn(
                      "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5",
                      s === prospect.prospectStage && "font-semibold"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STAGE_CONFIG[s].dot)} />
                    {STAGE_CONFIG[s].label}
                  </button>
                ))}
                {/* Résultats */}
                <p className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide border-t border-border/50 pt-1.5">Résultat</p>
                {OUTCOME_STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => pickStage(e, s)}
                    className={cn(
                      "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5",
                      s === prospect.prospectStage && "font-semibold"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STAGE_CONFIG[s].dot)} />
                    {STAGE_CONFIG[s].label}
                    {s === "WON" && <span className="ml-auto text-[9px] text-muted-foreground">→ Client</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {lastInteraction ? (
          <span>Contact {fmtShort(lastInteraction.date)}</span>
        ) : (
          <span className="italic opacity-50">Pas encore contacté</span>
        )}
        {nextReminder && (
          <>
            <span className="text-border">·</span>
            <span className={new Date(nextReminder.dueDate) < new Date() ? "text-red-500 font-medium" : "text-amber-600"}>
              ⏰ {fmtShort(nextReminder.dueDate)}
            </span>
          </>
        )}
        {prospect._count.projects > 0 && (
          <span className="ml-auto shrink-0">
            {prospect._count.projects} projet{prospect._count.projects !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  )
}
