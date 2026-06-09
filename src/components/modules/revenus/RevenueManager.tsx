"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Repeat, ChevronDown, ChevronUp, CheckCircle2, Clock,
  Pencil, Trash2, RefreshCw, AlertTriangle, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createRevenue, updateRevenue, deleteRevenue, markRevenueReceived,
  createRecurringRevenue, updateRecurringRevenue, deleteRecurringRevenue,
  generatePendingRecurringRevenues,
} from "@/actions/revenue"
import { PAYMENT_METHODS, REVENUE_TYPES } from "@/lib/revenue-constants"

// ── Types ──────────────────────────────────────────────────────────────────────

type Company = { id: string; name: string; city: string | null }
type Client  = { id: string; name: string; company: string | null; companyId: string | null }
type Project = { id: string; name: string; clientId: string | null; companyId: string | null }

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
  companyId: string | null
  clientId: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  recurringRevenue: { id: string; label: string } | null
  company: { name: string } | null
  client:  { name: string; company: string | null } | null
  project: { name: string } | null
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
  initial,
  onClose,
  onSave,
}: {
  typeLabels: Record<string, string>
  paymentLabels: Record<string, string>
  companies?: Company[]
  clients?: Client[]
  projects?: Project[]
  initial?: Partial<Revenue>
  onClose: () => void
  onSave: () => void
}) {
  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [type,          setType]          = useState(initial?.type ?? "SALARY")
  const [label,         setLabel]         = useState(initial?.label ?? "")
  const [amount,        setAmount]        = useState(initial?.amount?.toString() ?? "")
  const [status,        setStatus]        = useState(initial?.status ?? "PENDING")
  const [receivedAt,    setReceivedAt]    = useState(initial?.receivedAt ? initial.receivedAt.slice(0, 10) : "")
  const [expectedAt,    setExpectedAt]    = useState(initial?.expectedAt ? initial.expectedAt.slice(0, 10) : "")
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "")
  const [notes,         setNotes]         = useState(initial?.notes ?? "")
  const [period,        setPeriod]        = useState(initial?.period ?? defaultPeriod)
  const [companyId,     setCompanyId]     = useState(initial?.companyId ?? "")
  const [clientId,      setClientId]      = useState(initial?.clientId ?? "")
  const [projectId,     setProjectId]     = useState(initial?.projectId ?? "")
  const [error,         setError]         = useState("")
  const [isPending,     start]            = useTransition()

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
}: {
  initialRevenues:     Revenue[]
  initialRecurring:    RecurringRevenue[]
  revenueTypeLabels:   Record<string, string>
  paymentMethodLabels: Record<string, string>
  companies?: Company[]
  clients?: Client[]
  projects?: Project[]
}) {
  const router = useRouter()
  const [tab,               setTab]               = useState<"list" | "recurring">("list")
  const [showForm,          setShowForm]           = useState(false)
  const [showRecurringForm, setShowRecurringForm]  = useState(false)
  const [editRevenue,       setEditRevenue]        = useState<Revenue | null>(null)
  const [editRecurring,     setEditRecurring]      = useState<RecurringRevenue | null>(null)
  const [markReceived,      setMarkReceived]       = useState<Revenue | null>(null)
  const [confirmDelete,     setConfirmDelete]      = useState<string | null>(null)
  const [expandedPeriods,   setExpandedPeriods]    = useState<Set<string>>(new Set([getCurrentPeriod()]))
  const [isPendingGen,      startGen]              = useTransition()
  const [isPendingDel,      startDel]              = useTransition()
  const [genMessage,        setGenMessage]         = useState("")

  function refresh() { router.refresh() }

  function getCurrentPeriod() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }

  // Groupement par période
  const byPeriod: Record<string, Revenue[]> = {}
  for (const r of initialRevenues) {
    const key = r.period ?? "Sans période"
    if (!byPeriod[key]) byPeriod[key] = []
    byPeriod[key].push(r)
  }
  const sortedPeriods = Object.keys(byPeriod).sort((a, b) => b.localeCompare(a))

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

  const typeColor: Record<string, string> = {
    SALARY:     "text-blue-600 bg-blue-500/10",
    STUDY:      "text-indigo-600 bg-indigo-500/10",
    INVESTMENT: "text-emerald-600 bg-emerald-500/10",
    RENTAL:     "text-teal-600 bg-teal-500/10",
    PLATFORM:   "text-purple-600 bg-purple-500/10",
    OTHER:      "text-muted-foreground bg-muted",
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{initialRevenues.length} entrée{initialRevenues.length !== 1 ? "s" : ""}</p>
            <Button type="button" size="sm" onClick={() => { setEditRevenue(null); setShowForm(true) }}>
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>

          {showForm && !editRevenue && (
            <RevenueForm
              typeLabels={revenueTypeLabels}
              paymentLabels={paymentMethodLabels}
              companies={companies}
              clients={clients}
              projects={projects}
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
              initial={editRevenue}
              onClose={() => setEditRevenue(null)}
              onSave={() => { setEditRevenue(null); refresh() }}
            />
          )}

          {initialRevenues.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Aucun revenu enregistré</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajoutez vos revenus hors auto-entreprise pour les suivre ici.
              </p>
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
                    <button
                      type="button"
                      onClick={() => togglePeriod(period)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium text-sm capitalize">
                          {period === "Sans période" ? period : periodLabel(period)}
                        </span>
                        <span className="text-xs text-muted-foreground">{items.length} entrée{items.length > 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {receivedP < totalP && (
                          <span className="text-xs text-amber-600">{fmt(totalP - receivedP)} € en attente</span>
                        )}
                        <span className="font-semibold text-sm tabular-nums text-emerald-600">{fmt(receivedP)} € reçus</span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-border/50">
                        <table className="w-full text-sm">
                          <tbody>
                            {items.map(r => (
                              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[r.type] ?? "text-muted-foreground bg-muted"}`}>
                                      {revenueTypeLabels[r.type] ?? r.type}
                                    </span>
                                    <span className="font-medium">{r.label}</span>
                                    {r.recurringRevenue && (
                                      <span title="Récurrent" className="inline-flex shrink-0">
                                        <Repeat className="h-3 w-3 text-muted-foreground" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {r.company && (
                                      <span className="text-xs text-muted-foreground">{r.company.name}</span>
                                    )}
                                    {r.client && (
                                      <span className="text-xs text-muted-foreground">{r.company ? `· ${r.client.name}` : r.client.name}</span>
                                    )}
                                    {r.project && (
                                      <span className="text-xs text-muted-foreground">{(r.company || r.client) ? `· ${r.project.name}` : r.project.name}</span>
                                    )}
                                    {r.notes && !r.company && !r.client && !r.project && (
                                      <span className="text-xs text-muted-foreground truncate max-w-xs">{r.notes}</span>
                                    )}
                                  </div>
                                  {r.notes && (r.company || r.client || r.project) && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{r.notes}</p>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-right font-semibold tabular-nums">
                                  {fmt(r.amount)} €
                                </td>
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
                                <td className="px-5 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {r.status === "PENDING" && (
                                      <button
                                        type="button"
                                        onClick={() => setMarkReceived(r)}
                                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-500/30 rounded px-2 py-0.5 hover:bg-emerald-500/10 transition-colors"
                                      >
                                        Marquer reçu
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

      {/* Modal "Marquer reçu" */}
      {markReceived && (
        <MarkReceivedModal
          revenue={markReceived}
          paymentLabels={paymentMethodLabels}
          onClose={() => setMarkReceived(null)}
          onSave={() => { setMarkReceived(null); refresh() }}
        />
      )}
    </>
  )
}
