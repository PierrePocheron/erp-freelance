"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ChevronRight, Search, X, Briefcase, Star, HelpCircle, Check, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  createJobApplication, deleteJobApplication, toggleApplicationPriority, completeNextAction,
} from "@/actions/entretien"
import {
  STATUS_CONFIG, EVENT_TYPE_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, CLOSED_STATUSES,
  fmtShort, type JobAppStatus,
} from "./status-config"
import { ApplicationDialog } from "./ApplicationDialog"

export type { JobAppStatus }

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobAppEvent = {
  id: string; applicationId: string; date: Date | string; type: string
  title: string; notes: string | null; outcome?: string | null; cancelledAt?: Date | string | null; createdAt: Date | string
}
export type JobContact = { id: string; name: string; email: string | null; phone: string | null; company: string | null; linkedinUrl?: string | null; type?: string | null }
export type JobApp = {
  id: string; companyName: string; companyId: string | null; position: string
  location: string | null; workMode: string | null; status: string; source: string | null
  url: string | null; salaryMin: number | null; salaryMax: number | null; salaryNote: string | null
  notes: string | null; priority: number; contactId: string | null
  appliedAt: Date | string | null; nextActionAt: Date | string | null; nextActionLabel: string | null
  competencyDossierValidated: boolean; competencyDossierUrl: string | null
  closedAt: Date | string | null; createdAt: Date | string; updatedAt: Date | string
  contact: JobContact | null
  company: { id: string; name: string } | null
  events: JobAppEvent[]
}
export type CompanyOption = { id: string; name: string }


// ── EntretienView ──────────────────────────────────────────────────────────────

// Date de dernière activité d'une candidature (pour trier du plus récent au plus
// ancien) : max des dates connues — candidature, prochain point, clôture, mise à
// jour et événements de la timeline.
function lastActivity(a: JobApp): number {
  const times = [a.createdAt, a.updatedAt, a.appliedAt, a.nextActionAt, a.closedAt, ...a.events.map((e) => e.date)]
    .filter(Boolean)
    .map((d) => new Date(d as Date | string).getTime())
  return times.length ? Math.max(...times) : 0
}

export function EntretienView({
  applications,
  contacts,
  companies,
  initialStatus,
  stats,
}: {
  applications: JobApp[]
  contacts: JobContact[]
  companies: CompanyOption[]
  initialStatus?: JobAppStatus
  stats: { active: number; upcoming: number }
}) {
  const [statusFilter, setStatusFilter] = useState<JobAppStatus | "ALL" | "ACTIVE">(initialStatus ?? "ACTIVE")
  const [priorityOnly, setPriorityOnly] = useState(false)
  const [search, setSearch] = useState("")
  const [quickCompany, setQuickCompany] = useState("")
  const [quickPosition, setQuickPosition] = useState("")
  const [isAdding, startAdding] = useTransition()

  // Dialog création (l'édition se fait désormais sur la page détail)
  const [dialog, setDialog] = useState<{ open: boolean; item?: JobApp }>({ open: false })
  const router = useRouter()

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    const companyName = quickCompany.trim()
    const position = quickPosition.trim()
    if (!companyName || !position) return
    startAdding(async () => {
      await createJobApplication({ companyName, position, status: "WISHLIST" })
      setQuickCompany("")
      setQuickPosition("")
      toast.success(`Candidature "${position}" ajoutée`)
    })
  }

  // Comptages par statut
  const countByStatus = Object.fromEntries(
    (Object.keys(STATUS_CONFIG) as JobAppStatus[]).map((s) => [
      s, applications.filter((a) => a.status === s).length,
    ])
  ) as Record<JobAppStatus, number>
  const activeCount = applications.filter((a) => !CLOSED_STATUSES.includes(a.status as JobAppStatus)).length

  // ── Timeline : événements passés récents (3 sem.) + prochains RDV planifiés,
  // tous entretiens confondus, triés chronologiquement. ──
  const timeline = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- « maintenant » pour situer passé/futur
    const now = Date.now()
    const windowStart = now - 21 * 86_400_000
    type TL = { appId: string; company: string; position: string; label: string; time: number; type: string; future: boolean }
    const items: TL[] = []
    for (const a of applications) {
      for (const e of a.events) {
        if (e.cancelledAt) continue
        const t = new Date(e.date).getTime()
        if (t >= windowStart) items.push({ appId: a.id, company: a.companyName, position: a.position, label: e.title, time: t, type: e.type, future: t > now })
      }
      if (a.nextActionAt) {
        const t = new Date(a.nextActionAt).getTime()
        if (t >= windowStart) items.push({ appId: a.id, company: a.companyName, position: a.position, label: a.nextActionLabel ?? "Rendez-vous", time: t, type: "OTHER", future: t > now })
      }
    }
    return items.sort((x, y) => x.time - y.time)
  }, [applications])

  const priorityCount = applications.filter((a) => a.priority > 0).length
  const needle = search.trim().toLowerCase()
  const filtered = applications
    .filter((a) => {
      if (statusFilter === "ALL") return true
      if (statusFilter === "ACTIVE") return !CLOSED_STATUSES.includes(a.status as JobAppStatus)
      return a.status === statusFilter
    })
    .filter((a) => !priorityOnly || a.priority > 0)
    .filter((a) =>
      !needle ||
      a.companyName.toLowerCase().includes(needle) ||
      a.position.toLowerCase().includes(needle) ||
      (a.location ?? "").toLowerCase().includes(needle)
    )
    // Plus récents d'abord (par dernière activité)
    .sort((a, b) => lastActivity(b) - lastActivity(a))

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="sm:hidden text-2xl font-bold tracking-tight">Entretiens</h1>
            <p className="text-sm text-muted-foreground">Suivi des candidatures et processus de recrutement</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/entretiens/faq"
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Réponses-types, FAQ et lettres de motivation"
            >
              <HelpCircle className="h-4 w-4" /> <span className="hidden sm:inline">Réponses &amp; modèles</span>
            </Link>
            <button
              onClick={() => setDialog({ open: true })}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Nouvelle candidature
            </button>
          </div>
        </div>

        {/* Stats compactes */}
        <div className="flex flex-wrap gap-2.5">
          <StatCard label="En cours"    value={stats.active}   onClick={() => setStatusFilter("ACTIVE")} />
          <StatCard label="RDV à venir" value={stats.upcoming} accent="amber" />
        </div>

        {/* Timeline — passé récent + prochains RDV, tous entretiens */}
        {timeline.length > 0 && (
          <Timeline items={timeline} onOpen={(id) => router.push(`/entretiens/${id}`)} />
        )}

        {/* Quick add */}
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            value={quickCompany}
            onChange={(e) => setQuickCompany(e.target.value)}
            placeholder="Entreprise cible…"
            list="qa-company-suggestions"
            disabled={isAdding}
            className="flex-1 min-w-32 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <datalist id="qa-company-suggestions">
            {companies.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
          <input
            value={quickPosition}
            onChange={(e) => setQuickPosition(e.target.value)}
            placeholder="Poste / mission…"
            disabled={isAdding}
            className="flex-1 min-w-32 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAdding || !quickCompany.trim() || !quickPosition.trim()}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAdding ? "Ajout…" : "Ajouter"}
          </button>
        </form>

        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center gap-3">
            <Briefcase className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">Aucune candidature</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez votre première candidature ci-dessus</p>
            </div>
          </div>
        ) : (
          <>
            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (société, poste, lieu)…"
                className="w-full h-8 rounded-lg border border-input bg-transparent pl-8 pr-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Barre pipeline */}
            <div className="overflow-x-auto pb-1 -mx-0.5 px-0.5">
              <div className="flex items-center gap-1.5 min-w-max">
                <FilterChip active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")} label={`En cours (${activeCount})`} neutral />
                <FilterChip active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} label={`Tout (${applications.length})`} neutral />
                {priorityCount > 0 && (
                  <button
                    onClick={() => setPriorityOnly((v) => !v)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap",
                      priorityOnly
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-700"
                        : "border-border text-muted-foreground hover:border-amber-400/40 hover:text-amber-600"
                    )}
                  >
                    <Star className={cn("h-2.5 w-2.5", priorityOnly && "fill-current")} />
                    Prioritaires ({priorityCount})
                  </button>
                )}
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                {PIPELINE_STATUSES.map((s) => (
                  <StatusChip key={s} status={s} count={countByStatus[s]} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? "ACTIVE" : s)} />
                ))}
                <span className="mx-0.5 h-4 w-px bg-border/60 shrink-0" />
                {OUTCOME_STATUSES.map((s) => (
                  <StatusChip key={s} status={s} count={countByStatus[s]} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? "ACTIVE" : s)} />
                ))}
              </div>
            </div>

            {/* Cards */}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-2">
                {search ? `Aucun résultat pour « ${search} »` : "Aucune candidature à ce statut."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((a) => (
                  <ApplicationCard key={a.id} app={a} onOpen={() => router.push(`/entretiens/${a.id}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog création / édition */}
      {dialog.open && (
        <ApplicationDialog
          key={dialog.item?.id ?? "new"}
          item={dialog.item}
          contacts={contacts}
          companies={companies}
          onClose={() => setDialog({ open: false })}
        />
      )}

    </>
  )
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function StatCard({
  label, value, accent, onClick,
}: {
  label: string; value: number; accent?: "amber" | "emerald" | "green"; onClick?: () => void
}) {
  const color = accent === "amber" ? "text-amber-600" : accent === "emerald" ? "text-emerald-600" : accent === "green" ? "text-green-600" : ""
  const inner = (
    <div className={cn("rounded-lg border border-border/50 bg-card px-4 py-2 min-w-[112px]", onClick && "hover:border-border cursor-pointer transition-colors")}>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className={cn("text-xl font-bold leading-tight", color)}>{value}</p>
    </div>
  )
  return onClick ? <button onClick={onClick} className="text-left">{inner}</button> : inner
}

/**
 * Timeline transverse : événements passés récents + prochains RDV de TOUS les
 * entretiens, sur un rail vertical. Un séparateur « Aujourd'hui » situe où on en
 * est ; le passé est estompé (fait), le futur en ambre (à venir). Clic → fiche.
 */
function Timeline({
  items,
  onOpen,
}: {
  items: { appId: string; company: string; position: string; label: string; time: number; type: string; future: boolean }[]
  onOpen: (id: string) => void
}) {
  const firstFutureIdx = items.findIndex((i) => i.future)
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Timeline des entretiens</h2>
        <span className="text-xs text-muted-foreground">· passé récent &amp; à venir</span>
      </div>
      <ol className="relative max-h-80 overflow-y-auto px-4 py-3 space-y-3 before:absolute before:left-[1.30rem] before:top-4 before:bottom-4 before:w-px before:bg-border">
        {items.map((it, i) => {
          const cfg = EVENT_TYPE_CONFIG[it.type] ?? EVENT_TYPE_CONFIG.OTHER
          return (
            <li key={`${it.appId}-${it.time}-${i}`}>
              {i === firstFutureIdx && (
                <div className="relative -ml-4 mb-3 flex items-center gap-2 pl-4">
                  <span className="h-px flex-1 bg-amber-500/40" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">À venir</span>
                  <span className="h-px flex-1 bg-amber-500/40" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpen(it.appId)}
                className="relative flex w-full items-start gap-3 rounded-lg px-1.5 py-1 text-left hover:bg-muted/50 transition-colors"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-card text-[11px]",
                    it.future ? "bg-amber-500/15 ring-1 ring-amber-500/40" : "bg-muted"
                  )}
                >
                  {cfg.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">
                    {it.company} <span className="text-muted-foreground font-normal">— {it.label}</span>
                  </p>
                  <p className={cn("text-xs", it.future ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                    {fmtShort(new Date(it.time))} · {it.position}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 self-center" />
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function FilterChip({ active, onClick, label, neutral }: { active: boolean; onClick: () => void; label: string; neutral?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-foreground text-background border-foreground"
          : neutral
            ? "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            : "border-border text-muted-foreground"
      )}
    >
      {label}
    </button>
  )
}

function StatusChip({ status, count, active, onClick }: { status: JobAppStatus; count: number; active: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all whitespace-nowrap",
        active
          ? cn(cfg.cls, "ring-1 ring-current/40 scale-105")
          : count > 0
            ? cn(cfg.cls, "hover:scale-105")
            : "border-border/40 text-muted-foreground/30"
      )}
    >
      {cfg.label}{count > 0 ? ` (${count})` : ""}
    </button>
  )
}

function ApplicationCard({ app, onOpen }: { app: JobApp; onOpen: () => void }) {
  const [, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cfg = STATUS_CONFIG[app.status as JobAppStatus] ?? STATUS_CONFIG.WISHLIST
  const nextOverdue = app.nextActionAt && new Date(app.nextActionAt) < new Date()
  const lastEvent = app.events[0]
  const isPriority = app.priority > 0

  function quickDelete(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(() => deleteJobApplication(app.id))
  }

  function togglePriority(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(() => toggleApplicationPriority(app.id))
  }

  // Valide le RDV planifié en un clic : l'archive dans l'historique + efface le point.
  function markDone(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      await completeNextAction(app.id)
      toast.success(`« ${app.companyName} » — rendez-vous marqué fait ✓`)
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen() }}
      className="group rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{app.companyName}</p>
          <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{app.position}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePriority}
            title={isPriority ? "Retirer la priorité" : "Marquer prioritaire"}
            className={cn(
              "rounded-md p-0.5 transition-all",
              isPriority
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted-foreground/30 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hover:text-amber-400"
            )}
          >
            <Star className={cn("h-3 w-3", isPriority && "fill-current")} />
          </button>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.cls)}>{cfg.short}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {app.location && <span>{app.location}</span>}
        {app.workMode && <><span className="text-border">·</span><span>{app.workMode}</span></>}
      </div>

      <div className="flex items-center gap-2 text-xs mt-1.5 flex-wrap">
        {app.nextActionAt ? (
          <span className={cn("font-medium", nextOverdue ? "text-red-500" : "text-amber-600")}>
            📅 {app.nextActionLabel ?? "RDV"} · {fmtShort(app.nextActionAt)}
          </span>
        ) : lastEvent ? (
          <span className="text-muted-foreground">Dernier contact {fmtShort(lastEvent.date)}</span>
        ) : (
          <span className="text-muted-foreground/50 italic">Pas encore de contact</span>
        )}
        {app.nextActionAt && (
          <button
            onClick={markDone}
            title="Marquer ce rendez-vous comme fait (l'archive dans l'historique)"
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Check className="h-3 w-3" /> Fait
          </button>
        )}
        {app.events.length > 0 && !confirmDelete && (
          <span className="ml-auto text-muted-foreground/60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity">
            {app.events.length} évt
          </span>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-2 ml-auto" onClick={e => e.stopPropagation()}>
            <button onClick={quickDelete} className="text-[10px] font-medium text-destructive hover:opacity-80">
              Supprimer
            </button>
            <button onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
              className="text-[10px] text-muted-foreground hover:text-foreground">
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="text-muted-foreground/40 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
            title="Supprimer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
