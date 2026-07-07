"use client"

import { useState, useMemo, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Landmark, Plus, ChevronDown, ChevronUp, CheckCircle2, Clock,
  Trash2, X, AlertTriangle, Receipt, Wallet, ExternalLink, Search, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createUrssafDeclaration, markUrssafDeclared, markUrssafPaid,
  deleteUrssafDeclaration, suggestDeclarationLines, type SuggestedLine,
} from "@/actions/urssaf"
import {
  computeContributions, periodLabel, previousPeriod, nextPeriod,
  FISCAL_CATEGORY_LABELS, FISCAL_CATEGORY_SHORT,
  type FiscalCategory, type UrssafRates, type DeclarationFrequency,
} from "@/lib/urssaf"

// ── Types ──────────────────────────────────────────────────────────────────────

type DeclarationLine = {
  id:        string
  category:  string
  invoiceId: string | null
  revenueId: string | null
  label:     string
  amount:    number
}

type Declaration = {
  id:                   string
  period:               string
  status:               string
  dueDate:              string | null
  declaredAt:           string | null
  paidAt:               string | null
  amountBNC:            number
  amountBICServices:    number
  amountBICSales:       number
  cotisations:          number
  cfp:                  number
  versementLiberatoire: number
  totalPaid:            number
  notes:                string | null
  lines:                DeclarationLine[]
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:    { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  DECLARED: { label: "Déclarée",  cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  PAID:     { label: "Payée",     cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
}

// Statut de la facture/revenu source d'une ligne suggérée (pas le statut de la déclaration)
const LINE_STATUS_META: Record<string, { label: string; cls: string }> = {
  PAID:     { label: "Payée",      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  RECEIVED: { label: "Reçu",       cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  SENT:     { label: "Envoyée",    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  ISSUED:   { label: "Émise",      cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  LATE:     { label: "En retard",  cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  PENDING:  { label: "En attente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
}

const ALL_CATEGORIES: FiscalCategory[] = ["BNC", "BIC_SERVICES", "BIC_SALES"]

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR") : "—"

// ── Composant principal ────────────────────────────────────────────────────────

export function ImpotsView({
  declarations,
  rates,
  vlEnabled,
  frequency,
  periodToDeclare,
  suggestedLines,
}: {
  declarations:    Declaration[]
  rates:           UrssafRates
  vlEnabled:       boolean
  frequency:       DeclarationFrequency
  periodToDeclare: string
  suggestedLines:  SuggestedLine[]
}) {
  const router = useRouter()
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [showNewDialog, setShowNew]   = useState(false)
  const [payingId, setPayingId]       = useState<string | null>(null)

  // Stats annuelles
  const year = new Date().getFullYear()
  const yearDecls = declarations.filter(d => d.period.startsWith(String(year)))
  const declaredCA = yearDecls.reduce((s, d) => s + d.amountBNC + d.amountBICServices + d.amountBICSales, 0)
  const paidTotal  = yearDecls.reduce((s, d) => s + d.totalPaid, 0)
  const nextDue    = declarations.find(d => d.status !== "PAID")?.dueDate ?? null
  // Seules les lignes réellement encaissées comptent dans l'estimation "à déclarer" —
  // suggestedLines contient aussi les factures encore en attente pour qu'on puisse
  // les rattacher au bon moment, mais elles ne sont pas dues tant qu'elles ne sont pas payées.
  const pendingToDeclare = suggestedLines.filter(l => l.defaultIncluded).reduce((s, l) => s + l.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Impôts &amp; URSSAF
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Déclarations {frequency === "QUARTERLY" ? "trimestrielles" : "mensuelles"} de chiffre d&apos;affaires auto-entrepreneur
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nouvelle déclaration
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={`CA déclaré ${year}`}    value={`${fmt(declaredCA)} €`}  icon={Receipt} />
        <StatCard label="Cotisations payées"      value={`${fmt(paidTotal)} €`}   icon={Wallet} accent="emerald" />
        <StatCard label={`À déclarer (${periodLabel(periodToDeclare).split(" · ")[0]})`}
                  value={`${fmt(pendingToDeclare)} €`} icon={Clock} accent={pendingToDeclare > 0 ? "amber" : undefined} />
        <StatCard label="Prochaine échéance"      value={fmtDate(nextDue)}        icon={AlertTriangle}
                  accent={nextDue && new Date(nextDue) < new Date() ? "red" : undefined} />
      </div>

      {/* Liste des déclarations */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Historique
        </h2>
        {declarations.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune déclaration enregistrée. Créez la première pour la période {periodLabel(periodToDeclare)}.
          </div>
        )}
        {declarations.map(d => (
          <DeclarationCard
            key={d.id}
            declaration={d}
            expanded={expanded === d.id}
            onToggle={() => setExpanded(prev => prev === d.id ? null : d.id)}
            onPay={() => setPayingId(d.id)}
            rates={rates}
            vlEnabled={vlEnabled}
          />
        ))}
      </div>

      {/* Dialogs */}
      {showNewDialog && (
        <NewDeclarationDialog
          defaultPeriod={periodToDeclare}
          suggestedLines={suggestedLines}
          existingPeriods={new Map(declarations.map(d => [d.period, d.id]))}
          rates={rates}
          vlEnabled={vlEnabled}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); router.refresh() }}
          onJumpToExisting={(id) => { setShowNew(false); setExpanded(id) }}
        />
      )}
      {payingId && (
        <PayDialog
          declaration={declarations.find(d => d.id === payingId)!}
          rates={rates}
          vlEnabled={vlEnabled}
          onClose={() => setPayingId(null)}
          onSaved={() => { setPayingId(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: React.ElementType
  accent?: "emerald" | "amber" | "red"
}) {
  const accentCls =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
    accent === "amber"   ? "text-amber-600 dark:text-amber-400" :
    accent === "red"     ? "text-red-600 dark:text-red-400" : ""
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-xl font-bold tabular-nums ${accentCls}`}>{value}</p>
    </div>
  )
}

// ── Carte déclaration ──────────────────────────────────────────────────────────

function DeclarationCard({ declaration: d, expanded, onToggle, onPay, rates, vlEnabled }: {
  declaration: Declaration
  expanded:    boolean
  onToggle:    () => void
  onPay:       () => void
  rates:       UrssafRates
  vlEnabled:   boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const meta = STATUS_META[d.status] ?? STATUS_META.DRAFT
  const totalCA = d.amountBNC + d.amountBICServices + d.amountBICSales

  const estimate = useMemo(() => computeContributions(
    { BNC: d.amountBNC, BIC_SERVICES: d.amountBICServices, BIC_SALES: d.amountBICSales },
    rates, vlEnabled
  ), [d.amountBNC, d.amountBICServices, d.amountBICSales, rates, vlEnabled])

  const isLate = d.status !== "PAID" && d.dueDate && new Date(d.dueDate) < new Date()

  function handleDeclare() {
    startTransition(async () => {
      await markUrssafDeclared(d.id, new Date())
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm(`Supprimer la déclaration ${periodLabel(d.period)} ?`)) return
    startTransition(async () => {
      await deleteUrssafDeclaration(d.id)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Ligne résumé */}
      <button onClick={onToggle} className="flex items-center gap-4 w-full p-4 text-left hover:bg-accent/50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{periodLabel(d.period)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
              {meta.label}
            </span>
            {isLate && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400">
                Échéance dépassée
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {d.status === "PAID"
              ? `Payé ${fmt(d.totalPaid)} € le ${fmtDate(d.paidAt)}`
              : `Échéance ${fmtDate(d.dueDate)}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold tabular-nums">{fmt(totalCA)} €</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {d.status === "PAID" ? `${fmt(d.totalPaid)} € URSSAF` : `~${fmt(estimate.totalDue)} € estimés`}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Détail */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 p-4 space-y-4">
          {/* Lignes par catégorie */}
          <div className="grid md:grid-cols-2 gap-3">
            {ALL_CATEGORIES.map(cat => {
              const lines = d.lines.filter(l => l.category === cat)
              if (lines.length === 0) return null
              const catTotal = lines.reduce((s, l) => s + l.amount, 0)
              const est = estimate.byCategory[cat]
              return (
                <div key={cat} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-semibold mb-2">{FISCAL_CATEGORY_LABELS[cat]}</p>
                  <div className="space-y-1">
                    {lines.map(l => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{l.label}</span>
                          {l.invoiceId && (
                            <Link href={`/facturation/factures/${l.invoiceId}`} className="text-primary shrink-0">
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </span>
                        <span className="font-medium tabular-nums shrink-0">{fmt(l.amount)} €</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border mt-2 pt-2 text-xs">
                    <span className="text-muted-foreground">
                      Cotisations {rates[cat].cotisations} %{vlEnabled ? ` + VL ${rates[cat].vl} %` : ""}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {fmt(catTotal)} € → {fmt(est.cotisations + est.vl + est.cfp)} €
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Récap montants */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <RecapPill label="Cotisations" estimate={estimate.totalCotisations} actual={d.status === "PAID" ? d.cotisations : null} />
            <RecapPill label="CFP"         estimate={estimate.totalCFP}         actual={d.status === "PAID" ? d.cfp : null} />
            {vlEnabled && (
              <RecapPill label="Vers. libératoire" estimate={estimate.totalVL} actual={d.status === "PAID" ? d.versementLiberatoire : null} />
            )}
            <RecapPill label="Total" estimate={estimate.totalDue} actual={d.status === "PAID" ? d.totalPaid : null} highlight />
          </div>

          {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {d.status === "DRAFT" && (
              <Button size="sm" onClick={handleDeclare} disabled={isPending} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marquer déclarée
              </Button>
            )}
            {d.status !== "PAID" && (
              <Button size="sm" variant={d.status === "DECLARED" ? "default" : "outline"} onClick={onPay} className="gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Enregistrer le paiement
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}
              className="gap-1.5 text-red-600 hover:text-red-700 ml-auto">
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RecapPill({ label, estimate, actual, highlight }: {
  label: string; estimate: number; actual: number | null; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-2.5 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold tabular-nums">
        {actual !== null ? `${fmt(actual)} €` : `~${fmt(estimate)} €`}
      </p>
      {actual !== null && actual !== estimate && (
        <p className="text-[10px] text-muted-foreground tabular-nums">estimé {fmt(estimate)} €</p>
      )}
    </div>
  )
}

// ── Dialog nouvelle déclaration ────────────────────────────────────────────────

type EditableLine = SuggestedLine & { included: boolean; key: string }

let freeLineSeq = 0
const lineKey = (l: SuggestedLine) => l.invoiceId ?? l.revenueId ?? `free-${freeLineSeq++}`

function NewDeclarationDialog({
  defaultPeriod, suggestedLines, existingPeriods, rates, vlEnabled,
  onClose, onCreated, onJumpToExisting,
}: {
  defaultPeriod:    string
  suggestedLines:   SuggestedLine[]
  existingPeriods:  Map<string, string>  // period → declaration id, pour bloquer les doublons
  rates:            UrssafRates
  vlEnabled:        boolean
  onClose:          () => void
  onCreated:        () => void
  onJumpToExisting: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [period, setPeriod]         = useState(defaultPeriod)
  const [loadedPeriod, setLoadedPeriod] = useState(defaultPeriod)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState("")
  const [showOthers, setShowOthers] = useState(false)
  const [lines, setLines]           = useState<EditableLine[]>(
    suggestedLines.map(l => ({ ...l, included: l.defaultIncluded, key: lineKey(l) }))
  )
  // Ligne libre (encaissement sans facture ni revenu dans l'app)
  const [freeLabel, setFreeLabel]   = useState("")
  const [freeAmount, setFreeAmount] = useState("")
  const [freeCat, setFreeCat]       = useState<FiscalCategory>("BNC")

  const existingId = existingPeriods.get(period) ?? null

  // Recharge les factures/revenus rattachables à la période navigable (← →) —
  // sans ce refetch, changer de période ne mettait à jour que le libellé
  // affiché et laissait la liste figée sur la période initiale.
  useEffect(() => {
    if (period === loadedPeriod || existingId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFetching(true)
    suggestDeclarationLines(period).then(fresh => {
      if (cancelled) return
      setLines(fresh.map(l => ({ ...l, included: l.defaultIncluded, key: lineKey(l) })))
      setLoadedPeriod(period)
      setIsFetching(false)
    })
    return () => { cancelled = true }
  }, [period, loadedPeriod, existingId])

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lines
    return lines.filter(l => l.label.toLowerCase().includes(q))
  }, [lines, search])

  // Regroupe pour garder la liste lisible même avec beaucoup de factures :
  // les lignes déjà encaissées restent toujours visibles, les autres (envoyées,
  // en retard…) sont repliées derrière un compteur — sauf pendant une recherche,
  // où on veut voir tous les résultats correspondants sans étape supplémentaire.
  const isSearching = search.trim().length > 0
  const encaissees = visibleLines.filter(l => l.defaultIncluded)
  const autres      = visibleLines.filter(l => !l.defaultIncluded)

  const included = lines.filter(l => l.included)
  const amounts = useMemo(() => {
    const sum = (cat: FiscalCategory) =>
      included.filter(l => l.category === cat).reduce((s, l) => s + l.amount, 0)
    return { BNC: sum("BNC"), BIC_SERVICES: sum("BIC_SERVICES"), BIC_SALES: sum("BIC_SALES") }
  }, [included])
  const estimate = useMemo(
    () => computeContributions(amounts, rates, vlEnabled),
    [amounts, rates, vlEnabled]
  )

  function setCategory(key: string, cat: FiscalCategory) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, category: cat } : l))
  }

  function toggleLine(key: string) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, included: !l.included } : l))
  }

  function addFreeLine() {
    const amount = parseFloat(freeAmount.replace(",", "."))
    if (!freeLabel.trim() || !Number.isFinite(amount) || amount <= 0) return
    setLines(prev => [...prev, {
      category: freeCat, invoiceId: null, revenueId: null,
      label: freeLabel.trim(), amount, included: true,
      status: "PAID", defaultIncluded: true, key: `free-${freeLineSeq++}`,
    }])
    setFreeLabel(""); setFreeAmount("")
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const res = await createUrssafDeclaration({
        period,
        lines: included.map(l => ({
          category: l.category, invoiceId: l.invoiceId,
          revenueId: l.revenueId, label: l.label, amount: l.amount,
        })),
      })
      if (res.error) setError(res.error)
      else onCreated()
    })
  }

  return (
    <DialogShell title="Nouvelle déclaration URSSAF" onClose={onClose}>
      {/* Période */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setPeriod(previousPeriod(period))}
          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">←</button>
        <span className="text-sm font-semibold">{periodLabel(period)}</span>
        <button onClick={() => setPeriod(nextPeriod(period))}
          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">→</button>
      </div>

      {/* Période déjà déclarée — on bloque la création et on redirige vers l'existante */}
      {existingId ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Une déclaration existe déjà pour {periodLabel(period)}.
          </p>
          <Button size="sm" variant="outline" onClick={() => onJumpToExisting(existingId)} className="w-full">
            Voir la déclaration
          </Button>
        </div>
      ) : (
        <>
          {/* Recherche parmi les factures / revenus de la période */}
          {lines.length > 5 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrer par client, numéro…"
                className="bg-transparent text-xs outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          {/* Lignes : toutes les factures/revenus de la période, quel que soit leur
              statut (émise, envoyée, en retard, payée, en attente…) — pré-cochées
              seulement si déjà encaissées. Relier directement plutôt que ressaisir.
              Les non-encaissées restent repliées par défaut pour que la liste reste
              lisible même avec beaucoup de factures sur la période. */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto relative pr-0.5">
            {isFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {lines.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucune facture ni revenu rattachable à cette période.
              </p>
            )}
            {lines.length > 0 && visibleLines.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucun résultat pour « {search} »
              </p>
            )}
            {encaissees.map(l => <DeclarationLineRow key={l.key} line={l} onToggle={toggleLine} onCategory={setCategory} />)}

            {autres.length > 0 && (isSearching ? (
              autres.map(l => <DeclarationLineRow key={l.key} line={l} onToggle={toggleLine} onCategory={setCategory} />)
            ) : (
              <>
                <button
                  onClick={() => setShowOthers(v => !v)}
                  className="flex items-center gap-1.5 w-full text-left text-[11px] text-muted-foreground hover:text-foreground px-1 py-1"
                >
                  {showOthers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showOthers ? "Masquer" : "Afficher aussi"} {autres.length} facture{autres.length > 1 ? "s" : ""} non encore encaissée{autres.length > 1 ? "s" : ""}
                </button>
                {showOthers && autres.map(l => <DeclarationLineRow key={l.key} line={l} onToggle={toggleLine} onCategory={setCategory} />)}
              </>
            ))}
          </div>

          {/* Ligne libre */}
          <div className="flex items-center gap-1.5">
            <Input value={freeLabel} onChange={e => setFreeLabel(e.target.value)}
              placeholder="Encaissement manuel…" className="h-8 text-xs flex-1" />
            <select value={freeCat} onChange={e => setFreeCat(e.target.value as FiscalCategory)}
              className="rounded-md border border-input bg-background px-1.5 py-1.5 text-[10px] shrink-0">
              {ALL_CATEGORIES.map(c => <option key={c} value={c}>{FISCAL_CATEGORY_SHORT[c]}</option>)}
            </select>
            <Input value={freeAmount} onChange={e => setFreeAmount(e.target.value)}
              placeholder="€" className="h-8 text-xs w-20" inputMode="decimal" />
            <Button size="sm" variant="outline" onClick={addFreeLine} className="h-8 px-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Estimation */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-xs">
            <Row label={`CA total (${included.length} ligne${included.length > 1 ? "s" : ""})`} value={`${fmt(estimate.totalCA)} €`} bold />
            <Row label="Cotisations sociales" value={`${fmt(estimate.totalCotisations)} €`} />
            <Row label="CFP" value={`${fmt(estimate.totalCFP)} €`} />
            {vlEnabled && <Row label="Versement libératoire" value={`${fmt(estimate.totalVL)} €`} />}
            <div className="border-t border-border pt-1">
              <Row label="Total URSSAF estimé" value={`${fmt(estimate.totalDue)} €`} bold accent />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" onClick={handleCreate} disabled={isPending || included.length === 0}>
              {isPending ? "Création…" : "Créer la déclaration"}
            </Button>
          </div>
        </>
      )}
    </DialogShell>
  )
}

function DeclarationLineRow({ line: l, onToggle, onCategory }: {
  line:       EditableLine
  onToggle:   (key: string) => void
  onCategory: (key: string, cat: FiscalCategory) => void
}) {
  const statusMeta = LINE_STATUS_META[l.status]
  return (
    <div className={`flex items-center gap-2 rounded-lg border p-2 ${
      l.included ? "border-border bg-card" : "border-border/50 opacity-60"
    }`}>
      <input type="checkbox" checked={l.included} onChange={() => onToggle(l.key)}
        className="h-3.5 w-3.5 accent-[var(--primary)] shrink-0" />
      <span className="flex-1 min-w-0 text-xs truncate">{l.label}</span>
      {statusMeta && (
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
      )}
      <select
        value={l.category}
        onChange={e => onCategory(l.key, e.target.value as FiscalCategory)}
        className="rounded-md border border-input bg-background px-1.5 py-1 text-[10px] shrink-0"
      >
        {ALL_CATEGORIES.map(c => (
          <option key={c} value={c}>{FISCAL_CATEGORY_SHORT[c]}</option>
        ))}
      </select>
      <span className="text-xs font-semibold tabular-nums shrink-0 w-16 text-right">{fmt(l.amount)} €</span>
    </div>
  )
}

// ── Dialog paiement ────────────────────────────────────────────────────────────

function PayDialog({ declaration: d, rates, vlEnabled, onClose, onSaved }: {
  declaration: Declaration
  rates:       UrssafRates
  vlEnabled:   boolean
  onClose:     () => void
  onSaved:     () => void
}) {
  const [isPending, startTransition] = useTransition()
  const estimate = computeContributions(
    { BNC: d.amountBNC, BIC_SERVICES: d.amountBICServices, BIC_SALES: d.amountBICSales },
    rates, vlEnabled
  )
  const [cotisations, setCotisations] = useState(String(estimate.totalCotisations))
  const [cfp, setCfp]                 = useState(String(estimate.totalCFP))
  const [vl, setVl]                   = useState(String(estimate.totalVL))
  const [paidAt, setPaidAt]           = useState(new Date().toISOString().slice(0, 10))
  const [error, setError]             = useState<string | null>(null)

  const parse = (s: string) => {
    const n = parseFloat(s.replace(",", "."))
    return Number.isFinite(n) ? n : 0
  }
  const total = parse(cotisations) + parse(cfp) + parse(vl)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await markUrssafPaid(d.id, {
        paidAt:               new Date(paidAt),
        cotisations:          parse(cotisations),
        cfp:                  parse(cfp),
        versementLiberatoire: parse(vl),
      })
      if (res.error) setError(res.error)
      else onSaved()
    })
  }

  return (
    <DialogShell title={`Paiement — ${periodLabel(d.period)}`} onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        Saisissez les montants du récapitulatif URSSAF (pré-remplis avec l&apos;estimation).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Cotisations sociales (€)" value={cotisations} onChange={setCotisations} />
        <Field label="CFP (€)" value={cfp} onChange={setCfp} />
        {vlEnabled && <Field label="Versement libératoire (€)" value={vl} onChange={setVl} />}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Payé le</label>
          <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="h-8 text-xs mt-1" />
        </div>
      </div>
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center justify-between">
        <span className="text-xs font-medium">Total payé</span>
        <span className="text-sm font-bold tabular-nums">{fmt(total)} €</span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Enregistrement…" : "Confirmer le paiement"}
        </Button>
      </div>
    </DialogShell>
  )
}

// ── Primitives locales ─────────────────────────────────────────────────────────

function DialogShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs mt-1" inputMode="decimal" />
    </div>
  )
}

function Row({ label, value, bold, accent }: {
  label: string; value: string; bold?: boolean; accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={accent ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-medium"} ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  )
}
