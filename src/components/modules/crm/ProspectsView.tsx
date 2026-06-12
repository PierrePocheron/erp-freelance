"use client"

import { useState, useTransition } from "react"
import { createProspect, updateProspectStage, getClientPanel } from "@/actions/crm"
import { ClientPanel } from "./ClientPanel"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Plus, ChevronRight, Search, X } from "lucide-react"
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

const SOURCE_OPTIONS = [
  { value: "WORD_OF_MOUTH", label: "Bouche à oreille" },
  { value: "LINKEDIN",      label: "LinkedIn" },
  { value: "WEBSITE",       label: "Site web" },
  { value: "INBOUND",       label: "Entrant" },
  { value: "OTHER",         label: "Autre" },
]

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
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"default" | "stale" | "hot">("default")
  const [quickName, setQuickName] = useState("")
  const [quickEmail, setQuickEmail] = useState("")
  const [quickSource, setQuickSource] = useState("OTHER")
  const [showExtended, setShowExtended] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [batchText, setBatchText] = useState("")
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
      await createProspect({ name, email: quickEmail.trim() || undefined, source: quickSource })
      setQuickName("")
      setQuickEmail("")
      setQuickSource("OTHER")
      setShowExtended(false)
      toast.success(`Prospect "${name}" ajouté`)
    })
  }

  /** Parse le batch: une ligne = `Nom | Email? | Source?` */
  function parseBatchLines() {
    return batchText
      .split("\n")
      .map((line) => {
        const parts = line.split("|").map((s) => s.trim())
        const name = parts[0] ?? ""
        const email = parts[1] && parts[1].includes("@") ? parts[1] : undefined
        const src   = parts[2]?.toUpperCase() ?? "OTHER"
        const source = ["WORD_OF_MOUTH", "LINKEDIN", "WEBSITE", "INBOUND", "OTHER"].includes(src) ? src : "OTHER"
        return { name, email, source }
      })
      .filter((p) => p.name.length > 0)
  }

  function handleBatchAdd(e: React.FormEvent) {
    e.preventDefault()
    const lines = parseBatchLines()
    if (lines.length === 0) return
    startAdding(async () => {
      for (const { name, email, source } of lines) {
        await createProspect({ name, email, source })
      }
      setBatchText("")
      setBatchMode(false)
      toast.success(`${lines.length} prospect${lines.length > 1 ? "s" : ""} ajouté${lines.length > 1 ? "s" : ""}`)
    })
  }

  // Comptages par étape
  const countByStage = Object.fromEntries(
    (Object.keys(STAGE_CONFIG) as ProspectStage[]).map((s) => [
      s, prospects.filter((p) => p.prospectStage === s).length,
    ])
  )

  const tempOrder = { HOT: 0, WARM: 1, COLD: 2 }
  const stageOrder: Record<string, number> = {
    IDENTIFIED: 0, CONTACTED: 1, NO_RESPONSE: 2, REPLIED: 3,
    MEETING: 4, PROPOSAL_SENT: 5, NEGOTIATION: 6, WON: 7, LOST: 8, ON_HOLD: 9,
  }

  const needle = search.trim().toLowerCase()
  const filtered = prospects
    .filter((p) => stageFilter === "ALL" || p.prospectStage === stageFilter)
    .filter((p) =>
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      (p.company ?? "").toLowerCase().includes(needle) ||
      (p.email ?? "").toLowerCase().includes(needle)
    )
    .sort((a, b) => {
      if (sort === "hot") {
        const td = (tempOrder[a.temperature as keyof typeof tempOrder] ?? 2) -
                   (tempOrder[b.temperature as keyof typeof tempOrder] ?? 2)
        if (td !== 0) return td
        return (stageOrder[a.prospectStage] ?? 99) - (stageOrder[b.prospectStage] ?? 99)
      }
      if (sort === "stale") {
        const aDate = a.interactions[0]?.date ? new Date(a.interactions[0].date).getTime() : 0
        const bDate = b.interactions[0]?.date ? new Date(b.interactions[0].date).getTime() : 0
        return aDate - bDate // 0 (jamais contacté) en premier, puis le plus ancien
      }
      return 0 // "default" → garde l'ordre serveur
    })

  return (
    <>
      <div className="space-y-4">
        {/* ── Quick add (mode simple ou batch) ── */}
        {batchMode ? (
          <form onSubmit={handleBatchAdd} className="space-y-2">
            <div className="flex items-start gap-2">
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"Jean Dupont\nMarie Martin | marie@martin.fr | LINKEDIN\nSociété XYZ | contact@xyz.fr"}
                disabled={isAdding}
                rows={4}
                autoFocus
                className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none font-mono text-xs leading-relaxed"
              />
            </div>
            {parseBatchLines().length > 0 && (
              <p className="text-xs text-muted-foreground pl-0.5">
                {parseBatchLines().length} prospect{parseBatchLines().length > 1 ? "s" : ""} à importer
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setBatchMode(false); setBatchText("") }}
                className="h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isAdding || parseBatchLines().length === 0}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAdding ? "Import…" : `Importer ${parseBatchLines().length > 0 ? parseBatchLines().length : ""}`.trim()}
              </button>
              <p className="text-[10px] text-muted-foreground/60 ml-auto">Format : Nom | Email | Source</p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleQuickAdd} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="Nom du prospect…"
                disabled={isAdding}
                className="flex-1 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowExtended((v) => !v)}
                title={showExtended ? "Masquer les options" : "Plus d'options (email, source)"}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-lg border text-xs transition-colors shrink-0",
                  showExtended
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                ···
              </button>
              <button
                type="button"
                onClick={() => setBatchMode(true)}
                title="Importer plusieurs prospects en lot"
                className="h-8 px-2.5 rounded-lg border border-input text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
              >
                En lot
              </button>
              <button
                type="submit"
                disabled={isAdding || !quickName.trim()}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAdding ? "Ajout…" : "Ajouter"}
              </button>
            </div>

            {/* Champs étendus */}
            {showExtended && (
              <div className="flex items-center gap-2">
                <input
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="Email (optionnel)"
                  type="email"
                  disabled={isAdding}
                  className="flex-1 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
                <select
                  value={quickSource}
                  onChange={(e) => setQuickSource(e.target.value)}
                  disabled={isAdding}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </form>
        )}

        {prospects.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Recherche */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full h-8 rounded-lg border border-input bg-transparent pl-8 pr-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Tri */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
            >
              <option value="default">Par défaut</option>
              <option value="hot">Chauds en premier</option>
              <option value="stale">Sans contact d'abord</option>
            </select>
          </div>
        )}

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
              <p className="text-sm text-muted-foreground/60 italic py-2">
                {search ? `Aucun résultat pour « ${search} »` : "Aucun prospect à cette étape."}
              </p>
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
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className="group rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all text-left w-full cursor-pointer"
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
    </div>
  )
}
