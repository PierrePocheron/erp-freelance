"use client"

import { useState, useTransition } from "react"
import { Plus, Heart, Stethoscope, Wallet, Syringe, Clock, Check } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { markReimbursementReceived, resolveHealthEvent } from "@/actions/sante"
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
  id: string; amount: number; source: string; status: string
  expectedDate: Date | string | null; receivedAt: Date | string | null; notes: string | null
  consultationId: string | null; createdAt: Date | string; updatedAt: Date | string
  consultation?: { id: string; title: string; practitionerName: string } | null
}

/** Date de référence d'un remboursement pour le tri/affichage. */
export function reimbursementDate(r: HReimbursement): Date {
  return new Date(r.receivedAt ?? r.expectedDate ?? r.createdAt)
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
  const [tab, setTab] = useState<"timeline" | "blessures" | "consultations" | "remboursements">("timeline")
  const [, startMark]    = useTransition()
  const [, startResolve] = useTransition()

  // Dialogs
  const [eventDialog, setEventDialog]   = useState<{ open: boolean; item?: HEvent }>({ open: false })
  const [consultDialog, setConsultDialog] = useState<{ open: boolean; item?: HConsultation }>({ open: false })
  const [reimburseDialog, setReimburseDialog] = useState<{ open: boolean; item?: HReimbursement }>({ open: false })

  function markReceived(id: string) {
    startMark(async () => {
      await markReimbursementReceived(id)
      toast.success("Remboursement marqué reçu")
    })
  }

  function quickResolve(id: string) {
    startResolve(async () => {
      await resolveHealthEvent(id)
      toast.success("Événement marqué résolu")
    })
  }

  // Remboursements en attente (tous statuts PENDING)
  const pendingReimbursements = reimbursements.filter(r => r.status === "PENDING")
  const pendingTotal   = pendingReimbursements.reduce((s, r) => s + r.amount, 0)
  const pendingSecu    = pendingReimbursements.filter(r => r.source === "SECU").reduce((s, r) => s + r.amount, 0)
  const pendingMutuelle = pendingReimbursements.filter(r => r.source === "MUTUELLE").reduce((s, r) => s + r.amount, 0)

  // ── Timeline : fusionner tous les éléments, trier par date desc ──────────────
  type TEntry =
    | { kind: "event";  date: Date; data: HEvent }
    | { kind: "consult"; date: Date; data: HConsultation }
    | { kind: "reimburse"; date: Date; data: HReimbursement }

  const timeline: TEntry[] = [
    ...events.map((e)        => ({ kind: "event"     as const, date: new Date(e.date), data: e })),
    ...consultations.map((c) => ({ kind: "consult"   as const, date: new Date(c.date), data: c })),
    ...reimbursements.map((r)=> ({ kind: "reimburse" as const, date: reimbursementDate(r), data: r })),
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
          <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
            <span className="text-xs text-muted-foreground">{fmtShort(e.date)}</span>
            {!e.resolvedAt && (
              <span
                role="button"
                tabIndex={0}
                onClick={(ev) => { ev.stopPropagation(); quickResolve(e.id) }}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.stopPropagation(); quickResolve(e.id) } }}
                className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
              >
                Marquer résolu
              </span>
            )}
          </div>
        </button>
      )
    }

    if (entry.kind === "consult") {
      const c = entry.data
      const received = c.reimbursements.filter(r => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)
      const pending  = c.reimbursements.filter(r => r.status === "PENDING").reduce((s, r) => s + r.amount, 0)
      const remaining = (c.cost ?? 0) - received
      const settled   = c.cost != null && remaining <= 0.01
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
              <>
                <span className="text-xs font-medium block">{c.cost.toFixed(0)} € payé</span>
                {settled ? (
                  <span className="text-[10px] text-emerald-600 block">✓ Remboursé</span>
                ) : (
                  <>
                    {pending > 0 && (
                      <span className="text-[10px] text-amber-600 block">{pending.toFixed(0)} € attendu</span>
                    )}
                    {remaining - pending > 0.01 && (
                      <span className="text-[10px] text-muted-foreground block">
                        {(remaining - pending).toFixed(0)} € à charge
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </button>
      )
    }

    // reimburse
    const r = entry.data
    const isPending = r.status === "PENDING"
    return (
      <div
        key={`r-${r.id}`}
        role="button"
        tabIndex={0}
        onClick={() => setReimburseDialog({ open: true, item: r })}
        onKeyDown={(e) => { if (e.key === "Enter") setReimburseDialog({ open: true, item: r }) }}
        className={cn(
          "w-full text-left flex items-start gap-3 rounded-xl border p-3 hover:shadow-sm transition-all group cursor-pointer",
          isPending
            ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 border-dashed"
            : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
        )}
      >
        <span className="text-xl shrink-0 mt-0.5">{isPending ? "⏳" : "💸"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              isPending
                ? "border-amber-500/20 bg-amber-500/15 text-amber-700"
                : "border-emerald-500/20 bg-emerald-500/15 text-emerald-700"
            )}>
              {r.source === "SECU" ? "Sécu" : "Mutuelle"}
            </span>
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium",
              isPending ? "text-amber-600" : "text-emerald-600"
            )}>
              {isPending ? <><Clock className="h-3 w-3" /> En attente</> : <><Check className="h-3 w-3" /> Reçu</>}
            </span>
          </div>
          <p className={cn(
            "text-sm font-semibold transition-colors",
            isPending ? "text-amber-700 group-hover:text-amber-600" : "text-emerald-700 group-hover:text-emerald-600"
          )}>
            {isPending ? "" : "+"}{r.amount.toFixed(2)} €
          </p>
          {r.consultation && (
            <p className="text-xs text-muted-foreground">{r.consultation.practitionerName} — {r.consultation.title}</p>
          )}
          {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
          <span className="text-xs text-muted-foreground">{fmtShort(reimbursementDate(r))}</span>
          {isPending && (
            <button
              onClick={(e) => { e.stopPropagation(); markReceived(r.id) }}
              className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Marquer reçu
            </button>
          )}
        </div>
      </div>
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

        {/* Remboursements en attente */}
        {pendingTotal > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {pendingTotal.toFixed(2)} € en attente de remboursement
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pendingReimbursements.length} remboursement{pendingReimbursements.length > 1 ? "s" : ""} non reçu{pendingReimbursements.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {pendingSecu > 0 && (
                  <div className="text-right">
                    <p className="text-muted-foreground">Sécu</p>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">{pendingSecu.toFixed(2)} €</p>
                  </div>
                )}
                {pendingMutuelle > 0 && (
                  <div className="text-right">
                    <p className="text-muted-foreground">Mutuelle</p>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">{pendingMutuelle.toFixed(2)} €</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border/50">
          {(["timeline", "blessures", "consultations", "remboursements"] as const).map((t) => {
            const activeEvents = events.filter(e => !e.resolvedAt)
            const labels = { timeline: "Tout", blessures: "Blessures", consultations: "Consultations", remboursements: "Remboursements" }
            const counts = {
              timeline: timeline.length,
              blessures: activeEvents.length,
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

        {tab === "blessures" && (
          <>
            {events.length === 0 ? (
              <EmptyState onEvent={() => setEventDialog({ open: true })} onConsult={() => setConsultDialog({ open: true })} />
            ) : (
              <>
                {events.filter(e => !e.resolvedAt).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">En cours</p>
                    {renderTimeline(events.filter(e => !e.resolvedAt).map(e => ({ kind: "event" as const, date: new Date(e.date), data: e })))}
                  </div>
                )}
                {events.filter(e => e.resolvedAt).length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Résolus</p>
                    {renderTimeline(events.filter(e => e.resolvedAt).map(e => ({ kind: "event" as const, date: new Date(e.date), data: e })))}
                  </div>
                )}
              </>
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
                {renderTimeline(reimbursements.map(r => ({ kind: "reimburse" as const, date: reimbursementDate(r), data: r })))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs — montés seulement à l'ouverture, avec key pour repartir d'un état frais */}
      {eventDialog.open && (
        <HealthEventDialog
          key={eventDialog.item?.id ?? "new"}
          item={eventDialog.item}
          onClose={() => setEventDialog({ open: false })}
        />
      )}
      {consultDialog.open && (
        <ConsultationDialog
          key={consultDialog.item?.id ?? "new"}
          item={consultDialog.item}
          events={events}
          onClose={() => setConsultDialog({ open: false })}
        />
      )}
      {reimburseDialog.open && (
        <ReimbursementDialog
          key={reimburseDialog.item?.id ?? "new"}
          item={reimburseDialog.item}
          consultations={consultations}
          onClose={() => setReimburseDialog({ open: false })}
        />
      )}
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
