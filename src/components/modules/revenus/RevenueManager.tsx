"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Repeat, ChevronDown, ChevronUp, CheckCircle2, Clock,
  Pencil, Trash2, RefreshCw, AlertTriangle, X, Check,
  ArrowUpDown, ExternalLink, ChevronsUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createRevenue, updateRevenue, deleteRevenue, markRevenueReceived,
  createRecurringRevenue, updateRecurringRevenue, deleteRecurringRevenue,
  generatePendingRecurringRevenues, bulkMarkReceived,
} from "@/actions/revenue"
import { PAYMENT_METHODS, REVENUE_TYPES } from "@/lib/revenue-constants"

// ── Types ──────────────────────────────────────────────────────────────────────

type Company = { id: string; name: string; city: string | null }
type Client  = { id: string; name: string; company: string | null; companyId: string | null }
type Project = { id: string; name: string; clientId: string | null; companyId: string | null }
export type FiscalSource = { id: string; name: string; bucket: string; color: string; isActive?: boolean }

type Revenue = {
  id: string
  type: string
  label: string
  amount: number
  currency: string
  status: string
  receivedAt: string | null
  expectedAt: string | null
  paymentMethod: string | null
  notes: string | null
  period: string | null
  recurringRevenueId: string | null
  fiscalSourceId: string | null
  companyId: string | null
  clientId: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  recurringRevenue: { id: string; label: string } | null
  fiscalSource: FiscalSource | null
  company: { name: string } | null
  client:  { name: string; company: string | null } | null
  project: { name: string } | null
  // Entrées synthétiques depuis les factures payées (AE)
  isFromInvoice?: boolean
  invoiceHref?: string
}

type RecurringRevenue = {
  id: string
  type: string
  label: string
  amount: number
  currency: string
  dayOfMonth: number
  paymentMethod: string | null
  notes: string | null
  isActive: boolean
  companyId: string | null
  clientId: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  _count: { revenues: number }
  company: { name: string } | null
  client:  { name: string; company: string | null } | null
  project: { name: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function periodLabel(period: string): string {
  const [year, month] = period.split("-")
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("fr-FR", {
    month: "long", year: "numeric",
  })
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Formulaire revenu ─────────────────────────────────────────────────────────

function RevenueForm({
  typeLabels,
  paymentLabels,
  companies = [],
  clients = [],
  projects = [],
  fiscalSources = [],
  initial,
  onClose,
  onSave,
}: {
  typeLabels: Record<string, string>
  paymentLabels: Record<string, string>
  companies?: Company[]
  clients?: Client[]
  projects?: Project[]
  fiscalSources?: FiscalSource[]
  initial?: Partial<Revenue>
  onClose: () => void
  onSave: () => void
}) {
  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [type,           setType]          = useState(initial?.type ?? "SALARY")
  const [label,          setLabel]         = useState(initial?.label ?? "")
  const [amount,         setAmount]        = useState(initial?.amount?.toString() ?? "")
  const [status,         setStatus]        = useState(initial?.status ?? "PENDING")
  const [receivedAt,     setReceivedAt]    = useState(initial?.receivedAt ? initial.receivedAt.slice(0, 10) : "")
  const [expectedAt,     setExpectedAt]    = useState(initial?.expectedAt ? initial.expectedAt.slice(0, 10) : "")
  const [paymentMethod,  setPaymentMethod] = useState(initial?.paymentMethod ?? "")
  const [notes,          setNotes]         = useState(initial?.notes ?? "")
  const [period,         setPeriod]        = useState(initial?.period ?? defaultPeriod)
  const [fiscalSourceId, setFiscalSource]  = useState(initial?.fiscalSourceId ?? "")
  const [companyId,      setCompanyId]     = useState(initial?.companyId ?? "")
  const [clientId,       setClientId]      = useState(initial?.clientId ?? "")
  const [projectId,      setProjectId]     = useState(initial?.projectId ?? "")
  const [error,          setError]         = useState("")
  const [isPending,      start]            = useTransition()

  const filteredClients = companyId ? clients.filter(c => c.companyId === companyId) : clients
  const filteredProjects = projects.filter(p =>
    companyId
      ? p.companyId === companyId || (clientId && p.clientId === clientId)
      : clientId ? p.clientId === clientId : true
  )

  function handleSubmit() {
    if (!label.trim()) { setError("Le libellé est requis"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError("Montant invalide"); return }

    setError("")
    start(async () => {
      const data = {
        type,
        label,
        amount: amt,
        status,
        receivedAt: receivedAt ? new Date(receivedAt) : null,
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        period: period || null,
        fiscalSourceId: fiscalSourceId || null,
        companyId: companyId || null,
        clientId: clientId || null,
        projectId: projectId || null,
      }

      let res: { error?: string }
      if (initial?.id) {
        res = await updateRevenue(initial.id, data)
      } else {
        res = await createRevenue(data)
      }

      if (res.error) {
        setError(res.error)
      } else {
        onSave()
      }
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{initial?.id ? "Modifier" : "Nouveau revenu"}</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {REVENUE_TYPES.map(t => (
              <option key={t} value={t}>{typeLabels[t] ?? t}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Période (AAAA-MM)</label>
          <Input
            value={period}
            onChange={e => setPeriod(e.target.value)}
            placeholder="2026-06"
            className="h-9"
          />
        </div>

        {fiscalSources.length > 0 && (
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Source fiscale</label>
            <select
              value={fiscalSourceId}
              onChange={e => setFiscalSource(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucune —</option>
              {fiscalSources.map(fs => (
                <option key={fs.id} value={fs.id}>{fs.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Libellé</label>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="ex: Salaire juin 2026"
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Montant (€)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Statut</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="PENDING">En attente</option>
            <option value="RECEIVED">Reçu</option>
          </select>
        </div>

        {status === "PENDING" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date prévisionnelle</label>
            <Input
              type="date"
              value={expectedAt}
              onChange={e => setExpectedAt(e.target.value)}
              className="h-9"
            />
          </div>
        )}

        {status === "RECEIVED" && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date de réception</label>
              <Input
                type="date"
                value={receivedAt}
                onChange={e => setReceivedAt(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Moyen de paiement</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Choisir —</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{paymentLabels[m] ?? m}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Remarques optionnelles"
            className="h-9"
          />
        </div>

        {/* Association société / contact / projet */}
        {companies.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Société</label>
            <select
              value={companyId}
              onChange={e => { setCompanyId(e.target.value); setClientId(""); setProjectId("") }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucune —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        {clients.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Contact</label>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setProjectId("") }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucun —</option>
              {filteredClients.map(c => (
                <option key={c.id} value={c.id}>{c.company ? `${c.company} — ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
        )}
        {projects.length > 0 && (
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Projet</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucun —</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Annuler</Button>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "…" : initial?.id ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </div>
  )
}

// ── Modal "Marquer reçu" ───────────────────────────────────────────────────────

function MarkReceivedModal({
  revenue,
  paymentLabels,
  onClose,
  onSave,
}: {
  revenue: Revenue
  paymentLabels: Record<string, string>
  onClose: () => void
  onSave: () => void
}) {
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState("")
  const [error, setError] = useState("")
  const [isPending, start] = useTransition()

  function handleSubmit() {
    if (!receivedAt) { setError("La date est requise"); return }
    setError("")
    start(async () => {
      const res = await markRevenueReceived(revenue.id, new Date(receivedAt), paymentMethod || "OTHER")
      if (res.error) setError(res.error)
      else onSave()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm mx-4 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Marquer comme reçu</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{revenue.label}</p>
        <p className="text-2xl font-bold tabular-nums">{fmt(revenue.amount)} {revenue.currency}</p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date de réception</label>
            <Input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Moyen de paiement</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Choisir —</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{paymentLabels[m] ?? m}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "…" : "Confirmer"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Formulaire récurrent ───────────────────────────────────────────────────────

function RecurringForm({
  typeLabels,
  paymentLabels,
  companies = [],
  clients = [],
  projects = [],
  initial,
  onClose,
  onSave,
}: {
  typeLabels: Record<string, string>
  paymentLabels: Record<string, string>
  companies?: Company[]
  clients?: Client[]
  projects?: Project[]
  initial?: Partial<RecurringRevenue>
  onClose: () => void
  onSave: () => void
}) {
  const [type,          setType]          = useState(initial?.type ?? "SALARY")
  const [label,         setLabel]         = useState(initial?.label ?? "")
  const [amount,        setAmount]        = useState(initial?.amount?.toString() ?? "")
  const [dayOfMonth,    setDayOfMonth]    = useState(initial?.dayOfMonth?.toString() ?? "1")
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "")
  const [notes,         setNotes]         = useState(initial?.notes ?? "")
  const [companyId,     setCompanyId]     = useState(initial?.companyId ?? "")
  const [clientId,      setClientId]      = useState(initial?.clientId ?? "")
  const [projectId,     setProjectId]     = useState(initial?.projectId ?? "")
  const [error,         setError]         = useState("")
  const [isPending,     start]            = useTransition()

  const filteredClients  = companyId ? clients.filter(c => c.companyId === companyId) : clients
  const filteredProjects = projects.filter(p =>
    companyId
      ? p.companyId === companyId || (clientId && p.clientId === clientId)
      : clientId ? p.clientId === clientId : true
  )

  function handleSubmit() {
    if (!label.trim()) { setError("Le libellé est requis"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError("Montant invalide"); return }
    setError("")
    start(async () => {
      const data = {
        type,
        label,
        amount: amt,
        dayOfMonth: parseInt(dayOfMonth) || 1,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        companyId: companyId || null,
        clientId: clientId || null,
        projectId: projectId || null,
      }
      let res: { error?: string }
      if (initial?.id) {
        res = await updateRecurringRevenue(initial.id, data)
      } else {
        res = await createRecurringRevenue(data)
      }
      if (res.error) setError(res.error)
      else onSave()
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{initial?.id ? "Modifier" : "Nouveau récurrent"}</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {REVENUE_TYPES.map(t => (
              <option key={t} value={t}>{typeLabels[t] ?? t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Jour du mois</label>
          <Input
            type="number" min="1" max="28"
            value={dayOfMonth}
            onChange={e => setDayOfMonth(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Libellé</label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex: Salaire Nom Entreprise" className="h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Montant mensuel (€)</label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Moyen habituel</label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Choisir —</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{paymentLabels[m] ?? m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optionnel" className="h-9" />
        </div>

        {/* Association société / contact / projet */}
        {companies.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Société</label>
            <select
              value={companyId}
              onChange={e => { setCompanyId(e.target.value); setClientId(""); setProjectId("") }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucune —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        {clients.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Contact</label>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setProjectId("") }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucun —</option>
              {filteredClients.map(c => (
                <option key={c.id} value={c.id}>{c.company ? `${c.company} — ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
        )}
        {projects.length > 0 && (
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Projet</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Aucun —</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Annuler</Button>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "…" : initial?.id ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export function RevenueManager({
  initialRevenues,
  initialRecurring,
  revenueTypeLabels,
  paymentMethodLabels,
  companies = [],
  clients = [],
  projects = [],
  fiscalSources = [],
}: {
  initialRevenues:     Revenue[]
  initialRecurring:    RecurringRevenue[]
  revenueTypeLabels:   Record<string, string>
  paymentMethodLabels: Record<string, string>
  companies?: Company[]
  clients?: Client[]
  projects?: Project[]
  fiscalSources?: FiscalSource[]
}) {
  const router = useRouter()
  const [tab,               setTab]               = useState<"list" | "recurring">("list")
  const [showForm,          setShowForm]           = useState(false)
  const [showRecurringForm, setShowRecurringForm]  = useState(false)
  const [editRevenue,       setEditRevenue]        = useState<Revenue | null>(null)
  const [editRecurring,     setEditRecurring]      = useState<RecurringRevenue | null>(null)
  const [confirmDelete,     setConfirmDelete]      = useState<string | null>(null)
  const [selectedIds,       setSelectedIds]        = useState<Set<string>>(new Set())
  const [bulkDate,          setBulkDate]           = useState(() => new Date().toISOString().slice(0, 10))
  const [isBulking,         startBulk]             = useTransition()
  const [quickMarkingId,    setQuickMarkingId]     = useState<string | null>(null)
  const [expandedPeriods,   setExpandedPeriods]    = useState<Set<string>>(new Set([getCurrentPeriod()]))
  const [isPendingGen,      startGen]              = useTransition()
  const [isPendingDel,      startDel]              = useTransition()
  const [genMessage,        setGenMessage]         = useState("")
  // ── Filtres ────────────────────────────────────────────────────────────────
  const [filterSourceId,   setFilterSourceId]     = useState("")           // "" = toutes
  const [sortOrder,        setSortOrder]           = useState<"desc"|"asc">("desc") // desc = plus récent en premier

  function refresh() { router.refresh() }

  function getCurrentPeriod() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }

  // Sources disponibles dans les données (pour le sélecteur de filtre)
  const availableSources = useMemo(() => {
    const map = new Map<string, FiscalSource>()
    for (const r of initialRevenues) {
      if (r.fiscalSource) map.set(r.fiscalSource.id, r.fiscalSource)
    }
    return [...map.values()]
  }, [initialRevenues])

  // Revenus filtrés par source
  const filteredRevenues = filterSourceId
    ? initialRevenues.filter(r => r.fiscalSourceId === filterSourceId)
    : initialRevenues

  // Groupement par période (sur la liste filtrée)
  const byPeriod: Record<string, Revenue[]> = {}
  for (const r of filteredRevenues) {
    const key = r.period ?? "Sans période"
    if (!byPeriod[key]) byPeriod[key] = []
    byPeriod[key].push(r)
  }
  const sortedPeriods = Object.keys(byPeriod).sort((a, b) =>
    sortOrder === "desc" ? b.localeCompare(a) : a.localeCompare(b)
  )

  const allExpanded = sortedPeriods.length > 0 && sortedPeriods.every(p => expandedPeriods.has(p))

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedPeriods(new Set())
    } else {
      setExpandedPeriods(new Set(sortedPeriods))
    }
  }

  function togglePeriod(p: string) {
    setExpandedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  function handleGenerate() {
    setGenMessage("")
    startGen(async () => {
      const { generated } = await generatePendingRecurringRevenues()
      setGenMessage(generated > 0 ? `${generated} entrée${generated > 1 ? "s" : ""} générée${generated > 1 ? "s" : ""}` : "Aucune nouvelle entrée")
      refresh()
    })
  }

  function handleDelete(id: string) {
    startDel(async () => {
      await deleteRevenue(id)
      setConfirmDelete(null)
      refresh()
    })
  }

  function handleDeleteRecurring(id: string) {
    startDel(async () => {
      await deleteRecurringRevenue(id)
      setConfirmDelete(null)
      refresh()
    })
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllPendingInPeriod(period: string) {
    const pendingIds = (byPeriod[period] ?? []).filter(r => r.status === "PENDING" && !r.isFromInvoice).map(r => r.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) pendingIds.forEach(id => next.delete(id))
      else             pendingIds.forEach(id => next.add(id))
      return next
    })
  }

  function handleQuickMark(id: string) {
    setQuickMarkingId(id)
    startBulk(async () => {
      await markRevenueReceived(id, new Date(), "OTHER")
      setQuickMarkingId(null)
      refresh()
    })
  }

  function handleBulkMark() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    startBulk(async () => {
      await bulkMarkReceived(ids, bulkDate ? new Date(bulkDate) : new Date())
      setSelectedIds(new Set())
      refresh()
    })
  }

  const selectedTotal = selectedIds.size > 0
    ? [...selectedIds].reduce((sum, id) => sum + (initialRevenues.find(r => r.id === id)?.amount ?? 0), 0)
    : 0

  const typeColor: Record<string, string> = {
    SALARY:        "text-blue-600 bg-blue-500/10",
    STUDY:         "text-indigo-600 bg-indigo-500/10",
    INVESTMENT:    "text-emerald-600 bg-emerald-500/10",
    RENTAL:        "text-teal-600 bg-teal-500/10",
    FREELANCE:     "text-orange-600 bg-orange-500/10",
    PLATFORM:      "text-purple-600 bg-purple-500/10",
    REIMBURSEMENT: "text-pink-600 bg-pink-500/10",
    OTHER:         "text-muted-foreground bg-muted",
  }

  return (
    <>
      {/* Onglets */}
      <div className="flex gap-0 border-b border-border mb-4">
        {(["list", "recurring"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-2.5 px-1 mr-5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "list" ? "Revenus" : "Récurrents"}
          </button>
        ))}
      </div>

      {/* ── Onglet Revenus ───────────────────────────────────────────────── */}
      {tab === "list" && (
        <div className="space-y-4">
          {/* Barre supérieure : compteur + bouton */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredRevenues.length} entrée{filteredRevenues.length !== 1 ? "s" : ""}
              {filterSourceId && <span className="ml-1 text-xs">(filtrées)</span>}
            </p>
            <Button type="button" size="sm" onClick={() => { setEditRevenue(null); setShowForm(true) }}>
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>

          {/* Barre de filtres */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre source fiscale */}
            {availableSources.length > 0 && (
              <div className="relative">
                <select
                  value={filterSourceId}
                  onChange={e => setFilterSourceId(e.target.value)}
                  className="h-8 rounded-md border border-border bg-card pl-2.5 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                >
                  <option value="">Toutes les sources</option>
                  {availableSources.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {filterSourceId && (
                  <button
                    type="button"
                    onClick={() => setFilterSourceId("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {/* Ordre chronologique */}
            <button
              type="button"
              onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
              title={sortOrder === "desc" ? "Plus récent en premier" : "Plus ancien en premier"}
              className="h-8 px-2.5 text-xs rounded-md border border-border bg-card hover:bg-accent transition-colors flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === "desc" ? "Plus récent" : "Plus ancien"}
            </button>
            {/* Tout déplier / replier */}
            {sortedPeriods.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="h-8 px-2.5 text-xs rounded-md border border-border bg-card hover:bg-accent transition-colors flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ChevronsUpDown className="h-3 w-3" />
                {allExpanded ? "Tout replier" : "Tout déplier"}
              </button>
            )}
          </div>

          {showForm && !editRevenue && (
            <RevenueForm
              typeLabels={revenueTypeLabels}
              paymentLabels={paymentMethodLabels}
              companies={companies}
              clients={clients}
              projects={projects}
              fiscalSources={fiscalSources}
              onClose={() => setShowForm(false)}
              onSave={() => { setShowForm(false); refresh() }}
            />
          )}

          {editRevenue && (
            <RevenueForm
              typeLabels={revenueTypeLabels}
              paymentLabels={paymentMethodLabels}
              companies={companies}
              clients={clients}
              projects={projects}
              fiscalSources={fiscalSources}
              initial={editRevenue}
              onClose={() => setEditRevenue(null)}
              onSave={() => { setEditRevenue(null); refresh() }}
            />
          )}

          {filteredRevenues.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">
                {filterSourceId ? "Aucun revenu pour cette source fiscale" : "Aucun revenu enregistré"}
              </p>
              {!filterSourceId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ajoutez vos revenus ou liez des factures AE à une source fiscale.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPeriods.map(period => {
                const items = byPeriod[period]
                const expanded = expandedPeriods.has(period)
                const totalP = items.reduce((s, r) => s + r.amount, 0)
                const receivedP = items.filter(r => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)

                return (
                  <div key={period} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                    <div
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => togglePeriod(period)}
                      onKeyDown={e => e.key === "Enter" && togglePeriod(period)}
                    >
                      <div className="flex items-center gap-3">
                        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium text-sm capitalize">
                          {period === "Sans période" ? period : periodLabel(period)}
                        </span>
                        <span className="text-xs text-muted-foreground">{items.length} entrée{items.length > 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        {expanded && items.some(r => r.status === "PENDING" && !r.isFromInvoice) && (
                          <button
                            type="button"
                            onClick={() => selectAllPendingInPeriod(period)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border/50 hover:border-border transition-colors"
                          >
                            {items.filter(r => r.status === "PENDING" && !r.isFromInvoice).every(r => selectedIds.has(r.id))
                              ? "Désélectionner"
                              : "Tout sélectionner"}
                          </button>
                        )}
                        {receivedP < totalP && (
                          <span className="text-xs text-amber-600">{fmt(totalP - receivedP)} € en attente</span>
                        )}
                        <span className="font-semibold text-sm tabular-nums text-emerald-600">{fmt(receivedP)} € reçus</span>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-border/50">
                        <table className="w-full text-sm">
                          <tbody>
                            {items.map(r => (
                              <tr key={r.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.has(r.id) ? "bg-emerald-500/5" : ""}`}>
                                {/* Checkbox — masqué pour les entrées issues de factures */}
                                <td className="pl-4 pr-1 py-3 w-8">
                                  {!r.isFromInvoice && r.status === "PENDING" && (
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(r.id)}
                                      onChange={() => toggleSelect(r.id)}
                                      className="h-4 w-4 rounded border-border accent-emerald-600 cursor-pointer"
                                    />
                                  )}
                                </td>

                                {/* Libellé + infos */}
                                <td className="px-5 py-3 pl-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeColor[r.type] ?? "text-muted-foreground bg-muted"}`}>
                                      {revenueTypeLabels[r.type] ?? r.type}
                                    </span>
                                    {r.isFromInvoice && r.invoiceHref ? (
                                      <a
                                        href={r.invoiceHref}
                                        className="font-medium font-mono text-xs text-primary hover:underline"
                                      >
                                        {r.label}
                                      </a>
                                    ) : (
                                      <span className="font-medium">{r.label}</span>
                                    )}
                                    {r.isFromInvoice && (
                                      <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">
                                        FAC
                                      </span>
                                    )}
                                    {r.recurringRevenue && (
                                      <span title="Récurrent" className="inline-flex shrink-0">
                                        <Repeat className="h-3 w-3 text-muted-foreground" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {r.fiscalSource && (
                                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: r.fiscalSource.color }} />
                                        {r.fiscalSource.name}
                                      </span>
                                    )}
                                    {r.company && (
                                      <span className="text-xs text-muted-foreground">{r.fiscalSource ? `· ${r.company.name}` : r.company.name}</span>
                                    )}
                                    {r.client && (
                                      <span className="text-xs text-muted-foreground">{(r.fiscalSource || r.company) ? `· ${r.client.name}` : r.client.name}</span>
                                    )}
                                    {r.project && (
                                      <span className="text-xs text-muted-foreground">{(r.fiscalSource || r.company || r.client) ? `· ${r.project.name}` : r.project.name}</span>
                                    )}
                                    {r.notes && !r.isFromInvoice && !r.fiscalSource && !r.company && !r.client && !r.project && (
                                      <span className="text-xs text-muted-foreground truncate max-w-xs">{r.notes}</span>
                                    )}
                                  </div>
                                  {r.notes && !r.isFromInvoice && (r.company || r.client || r.project) && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{r.notes}</p>
                                  )}
                                </td>

                                {/* Montant */}
                                <td className="px-5 py-3 text-right font-semibold tabular-nums">
                                  {fmt(r.amount)} €
                                </td>

                                {/* Statut / date */}
                                <td className="px-5 py-3 hidden sm:table-cell">
                                  {r.status === "RECEIVED" ? (
                                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      {fmtDate(r.receivedAt)}
                                      {r.paymentMethod && (
                                        <span className="text-muted-foreground ml-1">
                                          · {paymentMethodLabels[r.paymentMethod] ?? r.paymentMethod}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1 text-xs text-amber-600">
                                        <Clock className="h-3.5 w-3.5" />
                                        En attente
                                      </div>
                                      {r.expectedAt && (
                                        <p className="text-xs text-muted-foreground pl-4">
                                          prévu {fmtDate(r.expectedAt)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="px-5 py-3 text-right">
                                  {r.isFromInvoice ? (
                                    /* Entrée issue d'une facture — lien uniquement */
                                    r.invoiceHref ? (
                                      <a
                                        href={r.invoiceHref}
                                        title="Voir la facture"
                                        className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-primary transition-colors"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : null
                                  ) : (
                                    /* Entrée manuelle — actions habituelles */
                                    <div className="flex items-center justify-end gap-1.5">
                                      {r.status === "PENDING" && (
                                        <button
                                          type="button"
                                          onClick={() => handleQuickMark(r.id)}
                                          disabled={isBulking}
                                          title="Marquer reçu aujourd'hui"
                                          className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-600 transition-colors disabled:opacity-40"
                                        >
                                          {quickMarkingId === r.id
                                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            : <Check className="h-3.5 w-3.5" />
                                          }
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => { setEditRevenue(r); setShowForm(false) }}
                                        className="text-muted-foreground hover:text-foreground p-1 rounded"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      {confirmDelete === r.id ? (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(r.id)}
                                            disabled={isPendingDel}
                                            className="text-xs text-red-500 hover:text-red-600 font-medium"
                                          >
                                            Supprimer
                                          </button>
                                          <button type="button" onClick={() => setConfirmDelete(null)} className="text-xs text-muted-foreground">Annuler</button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDelete(r.id)}
                                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Récurrents ────────────────────────────────────────────── */}
      {tab === "recurring" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{initialRecurring.length} modèle{initialRecurring.length !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPendingGen}
                onClick={handleGenerate}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPendingGen ? "animate-spin" : ""}`} />
                Générer en attente
              </Button>
              <Button type="button" size="sm" onClick={() => { setEditRecurring(null); setShowRecurringForm(true) }}>
                <Plus className="h-3.5 w-3.5" />
                Nouveau
              </Button>
            </div>
          </div>

          {genMessage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              {genMessage}
            </div>
          )}

          {(showRecurringForm && !editRecurring) && (
            <RecurringForm
              typeLabels={revenueTypeLabels}
              paymentLabels={paymentMethodLabels}
              companies={companies}
              clients={clients}
              projects={projects}
              onClose={() => setShowRecurringForm(false)}
              onSave={() => { setShowRecurringForm(false); refresh() }}
            />
          )}

          {editRecurring && (
            <RecurringForm
              typeLabels={revenueTypeLabels}
              paymentLabels={paymentMethodLabels}
              companies={companies}
              clients={clients}
              projects={projects}
              initial={editRecurring}
              onClose={() => setEditRecurring(null)}
              onSave={() => { setEditRecurring(null); refresh() }}
            />
          )}

          {initialRecurring.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Aucun revenu récurrent configuré</p>
              <p className="text-xs text-muted-foreground mt-1">
                Créez des modèles récurrents (salaire, loyer…) pour générer automatiquement les entrées chaque mois.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-medium">Libellé</th>
                    <th className="px-5 py-2.5 text-left font-medium hidden sm:table-cell">Type</th>
                    <th className="px-5 py-2.5 text-right font-medium">Montant</th>
                    <th className="px-5 py-2.5 text-center font-medium hidden md:table-cell">Jour</th>
                    <th className="px-5 py-2.5 text-center font-medium hidden md:table-cell">Entrées</th>
                    <th className="px-5 py-2.5 text-center font-medium">Actif</th>
                    <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {initialRecurring.map(rec => (
                    <tr key={rec.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-medium">{rec.label}</span>
                        {rec.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{rec.notes}</p>}
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{revenueTypeLabels[rec.type] ?? rec.type}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmt(rec.amount)} €</td>
                      <td className="px-5 py-3 text-center text-muted-foreground hidden md:table-cell">{rec.dayOfMonth}</td>
                      <td className="px-5 py-3 text-center text-muted-foreground hidden md:table-cell">{rec._count.revenues}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-block h-2 w-2 rounded-full ${rec.isActive ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setEditRecurring(rec); setShowRecurringForm(false) }}
                            className="text-muted-foreground hover:text-foreground p-1 rounded"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {confirmDelete === rec.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteRecurring(rec.id)}
                                disabled={isPendingDel}
                                className="text-xs text-red-500 hover:text-red-600 font-medium"
                              >
                                Supprimer
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)} className="text-xs text-muted-foreground">Annuler</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(rec.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Floating bulk-mark bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-2xl rounded-2xl px-4 py-3">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            · {fmt(selectedTotal)} €
          </span>
          <div className="w-px h-5 bg-border shrink-0" />
          <input
            type="date"
            value={bulkDate}
            onChange={e => setBulkDate(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="button"
            size="sm"
            disabled={isBulking}
            onClick={handleBulkMark}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
          >
            {isBulking
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5" />
            }
            Valider{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            title="Désélectionner tout"
            className="text-muted-foreground hover:text-foreground p-1 rounded shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
}
