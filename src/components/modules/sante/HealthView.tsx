"use client"

import { useState } from "react"
import { Plus, Heart, Stethoscope, Wallet, Syringe } from "lucide-react"
import { cn } from "@/lib/utils"
import { HealthEventDialog }      from "./HealthEventDialog"
import { ConsultationDialog }     from "./ConsultationDialog"
import { ReimbursementDialog }    from "./ReimbursementDialog"

// ── Types ─────────────────────────────────────────────────────────────────────

export type HEvent = {
  id: string; date: Date | string; type: string
  title: string; description: string | null; bodyPart: string | null
  resolvedAt: Date | string | null; createdAt: Date | string; updatedAt: Date | string
}
export type HConsultation = {
  id: string; date: Date | string; practitionerName: string; practitionerType: string
  title: string; notes: string | null; cost: number | null
  hasDocument: boolean; documentRef: string | null; healthEventId: string | null
  createdAt: Date | string; updatedAt: Date | string
  healthEvent: { id: string; title: string; bodyPart: string | null } | null
  reimbursements: HReimbursement[]
}
export type HReimbursement = {
  id: string; date: Date | string; amount: number; source: string; notes: string | null
  consultationId: string | null; createdAt: Date | string; updatedAt: Date | string
  consultation?: { id: string; title: string; practitionerName: string } | null
}

// ── Config ─────────────────────────────────────────────────────────────────────

export const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: string; cls: string; dot: string }> = {
  INJURY:  { label: "Blessure",  icon: "🩸", cls: "bg-red-500/15 text-red-600 border-red-500/20",      dot: "bg-red-500"     },
  ILLNESS: { label: "Maladie",   icon: "🩸", cls: "bg-orange-500/15 text-orange-600 border-orange-500/20", dot: "bg-orange-500" },
  OTHER:   { label: "Autre",     icon: "🩸", cls: "bg-muted text-muted-foreground border-border",         dot: "bg-gray-400"    },
}

export const PRACTITIONER_LABELS: Record<string, string> = {
  GENERAL:    "Médecin généraliste",
  OSTEOPATH:  "Ostéopathe",
  SPECIALIST: "Spécialiste",
  SOS_MEDECIN:"SOS Médecin",
  NURSE:      "Infirmier(ère)",
  PHYSIO:     "Kiné",
  DENTIST:    "Dentiste",
  OTHER:      "Autre praticien",
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

const fmtShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

// ── HealthView ─────────────────────────────────────────────────────────────────

export function HealthView({
  events,
  consultations,
  reimbursements,
  stats,
  currentYear,
}: {
  events: HEvent[]
  consultations: HConsultation[]
  reimbursements: HReimbursement[]
  stats: { consultationsThisYear: number; spentThisYear: number; reimbursedThisYear: number; activeIssues: number }
  currentYear: number
}) {
  const [tab, setTab] = useState<"timeline" | "consultations" | "remboursements">("timeline")

  // Dialogs
  const [eventDialog, setEventDialog]   = useState<{ open: boolean; item?: HEvent }>({ open: false })
  const [consultDialog, setConsultDialog] = useState<{ open: boolean; item?: HConsultation }>({ open: false })
  const [reimburseDialog, setReimburseDialog] = useState<{ open: boolean; item?: HReimbursement }>({ open: false })

  // ── Timeline : fusionner tous les éléments, trier par date desc ──────────────
  type TEntry =
    | { kind: "event";  date: Date; data: HEvent }
    | { kind: "consult"; date: Date; data: HConsultation }
    | { kind: "reimburse"; date: Date; data: HReimbursement }

  const timeline: TEntry[] = [
    ...events.map((e)        => ({ kind: "event"     as const, date: new Date(e.date), data: e })),
    ...consultations.map((c) => ({ kind: "consult"   as const, date: new Date(c.date), data: c })),
    ...reimbursements.map((r)=> ({ kind: "reimburse" as const, date: new Date(r.date), data: r })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  // ── Rendu d'une entrée timeline ───────────────────────────────────────────────

  function renderEntry(entry: TEntry) {
    if (entry.kind === "event") {
      const e = entry.data
      const cfg = EVENT_TYPE_CONFIG[e.type] ?? EVENT_TYPE_CONFIG.OTHER
      return (
        <button
          key={`e-${e.id}`}
          onClick={() => setEventDialog({ open: true, item: e })}
          className="w-full text-left flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all group"
        >
          <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.cls)}>
                {cfg.label}
              </span>
              {e.bodyPart && (
                <span className="text-[10px] text-muted-foreground">{e.bodyPart}</span>
              )}
              {e.resolvedAt && (
                <span className="text-[10px] text-emerald-600">✓ Résolu {fmtShort(e.resolvedAt)}</span>
              )}
            </div>
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">{e.title}</p>
            {e.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtShort(e.date)}</span>
        </button>
      )
    }

    if (entry.kind === "consult") {
      const c = entry.data
      const reimbursed = c.reimbursements.reduce((s, r) => s + r.amount, 0)
      const remaining  = (c.cost ?? 0) - reimbursed
      return (
        <button
          key={`c-${c.id}`}
          onClick={() => setConsultDialog({ open: true, item: c })}
          className="w-full text-left flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all group"
        >
          <span className="text-xl shrink-0 mt-0.5">🥼</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="rounded-full border border-blue-500/20 bg-blue-500/15 text-blue-600 px-2 py-0.5 text-[10px] font-semibold">
                {PRACTITIONER_LABELS[c.practitionerType] ?? c.practitionerType}
              </span>
              {c.hasDocument && <span className="text-[10px] text-muted-foreground">♻️ Drive</span>}
            </div>
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">{c.practitionerName}</p>
            <p className="text-xs text-muted-foreground">{c.title}</p>
            {c.healthEvent && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                🩸 {c.healthEvent.title}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 mt-0.5 space-y-0.5">
            <span className="text-xs text-muted-foreground block">{fmtShort(c.date)}</span>
            {c.cost != null && (
              <span className={cn(
                "text-xs font-medium block",
                remaining > 0 ? "text-amber-600" : "text-emerald-600"
              )}>
                {remaining > 0 ? `${remaining.toFixed(0)} € restant` : "✓ Remboursé"}
              </span>
            )}
            {c.cost != null && remaining > 0 && (
              <span className="text-[10px] text-muted-foreground block">{c.cost} € payé</span>
            )}
          </div>
        </button>
      )
    }

    // reimburse
    const r = entry.data
    return (
      <button
        key={`r-${r.id}`}
        onClick={() => setReimburseDialog({ open: true, item: r })}
        className="w-full text-left flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 hover:border-emerald-500/40 hover:shadow-sm transition-all group"
      >
        <span className="text-xl shrink-0 mt-0.5">💸</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/15 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
              {r.source === "SECU" ? "Sécu" : "Mutuelle"}
            </span>
          </div>
          <p className="text-sm font-semibold text-emerald-700 group-hover:text-emerald-600 transition-colors">
            +{r.amount.toFixed(2)} €
          </p>
          {r.consultation && (
            <p className="text-xs text-muted-foreground">{r.consultation.practitionerName} — {r.consultation.title}</p>
          )}
          {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtShort(r.date)}</span>
      </button>
    )
  }

  // ── Séparateurs d'année ───────────────────────────────────────────────────────

  function renderTimeline(entries: TEntry[]) {
    const result: React.ReactNode[] = []
    let lastYear: number | null = null
    for (const entry of entries) {
      const y = entry.date.getFullYear()
      if (y !== lastYear) {
        result.push(
          <div key={`year-${y}`} className="flex items-center gap-3 py-1">
            <span className="text-sm font-bold text-muted-foreground/60 tracking-widest">{y}</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
        )
        lastYear = y
      }
      result.push(renderEntry(entry))
    }
    return result
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Santé</h1>
            <p className="text-sm text-muted-foreground">Suivi médical personnel</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEventDialog({ open: true })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Blessure / Maladie
            </button>
            <button
              onClick={() => setConsultDialog({ open: true })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Consultation
            </button>
            <button
              onClick={() => setReimburseDialog({ open: true })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Remboursement
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Stethoscope className="h-4 w-4 text-blue-500" />}
            label={`Consultations ${currentYear}`}
            value={stats.consultationsThisYear}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4 text-amber-500" />}
            label={`Dépensé ${currentYear}`}
            value={`${stats.spentThisYear.toFixed(2)} €`}
          />
          <StatCard
            icon={<Heart className="h-4 w-4 text-emerald-500" />}
            label={`Remboursé ${currentYear}`}
            value={`${stats.reimbursedThisYear.toFixed(2)} €`}
            positive
          />
          <StatCard
            icon={<Syringe className="h-4 w-4 text-red-500" />}
            label="Problèmes en cours"
            value={stats.activeIssues}
            highlight={stats.activeIssues > 0}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border/50">
          {(["timeline", "consultations", "remboursements"] as const).map((t) => {
            const labels = { timeline: "Tout", consultations: "Consultations", remboursements: "Remboursements" }
            const counts = {
              timeline: timeline.length,
              consultations: consultations.length,
              remboursements: reimbursements.length,
            }
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "pb-2 px-3 text-sm font-medium border-b-2 transition-colors",
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {labels[t]}
                {counts[t] > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">({counts[t]})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {tab === "timeline" && (
          <>
            {timeline.length === 0 ? (
              <EmptyState onEvent={() => setEventDialog({ open: true })} onConsult={() => setConsultDialog({ open: true })} />
            ) : (
              <div className="space-y-2">{renderTimeline(timeline)}</div>
            )}
          </>
        )}

        {tab === "consultations" && (
          <>
            {consultations.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-4">Aucune consultation enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {renderTimeline(consultations.map(c => ({ kind: "consult" as const, date: new Date(c.date), data: c })))}
              </div>
            )}
          </>
        )}

        {tab === "remboursements" && (
          <>
            {reimbursements.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-4">Aucun remboursement enregistré.</p>
            ) : (
              <div className="space-y-2">
                {renderTimeline(reimbursements.map(r => ({ kind: "reimburse" as const, date: new Date(r.date), data: r })))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <HealthEventDialog
        open={eventDialog.open}
        item={eventDialog.item}
        onClose={() => setEventDialog({ open: false })}
      />
      <ConsultationDialog
        open={consultDialog.open}
        item={consultDialog.item}
        events={events}
        onClose={() => setConsultDialog({ open: false })}
      />
      <ReimbursementDialog
        open={reimburseDialog.open}
        item={reimburseDialog.item}
        consultations={consultations}
        onClose={() => setReimburseDialog({ open: false })}
      />
    </>
  )
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, positive, highlight,
}: {
  icon: React.ReactNode; label: string; value: string | number; positive?: boolean; highlight?: boolean
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-1",
      highlight ? "border-red-500/20 bg-red-500/5" : "border-border/50 bg-card"
    )}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={cn("text-xl font-bold", positive ? "text-emerald-600" : highlight ? "text-red-600" : "")}>
        {value}
      </p>
    </div>
  )
}

function EmptyState({ onEvent, onConsult }: { onEvent: () => void; onConsult: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center gap-3">
      <span className="text-4xl">🏥</span>
      <div>
        <p className="text-sm font-medium">Aucun événement de santé</p>
        <p className="text-xs text-muted-foreground mt-1">Commencez par enregistrer une blessure ou une consultation</p>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onEvent} className="h-8 px-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 text-xs font-medium hover:bg-red-500/20 transition-colors">
          Blessure / Maladie
        </button>
        <button onClick={onConsult} className="h-8 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 text-xs font-medium hover:bg-blue-500/20 transition-colors">
          Consultation
        </button>
      </div>
    </div>
  )
}
