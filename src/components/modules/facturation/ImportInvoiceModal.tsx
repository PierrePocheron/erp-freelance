"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload, X, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { importHistoricalInvoice } from "@/actions/facturation"

type Client  = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string | null }

function clientLabel(c: Client) {
  if (c.type === "SELF") return "Perso"
  return c.company ? `${c.name} — ${c.company}` : c.name
}

export function ImportInvoiceModal({
  userId,
  clients,
  projects,
}: {
  userId: string
  clients: Client[]
  projects: Project[]
}) {
  const router  = useRouter()
  const [open,  setOpen]  = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  // ── form state ────────────────────────────────────────────────────────────
  const [clientId,      setClientId]      = useState("")
  const [projectId,     setProjectId]     = useState("")
  const [customNumber,  setCustomNumber]  = useState("")
  const [date,          setDate]          = useState(today)
  const [description,   setDescription]   = useState("")
  const [amountHT,      setAmountHT]      = useState("")
  const [taxRate,       setTaxRate]       = useState("0")
  const [isPaid,        setIsPaid]        = useState(true)
  const [paidAt,        setPaidAt]        = useState(today)
  const [paidAmount,    setPaidAmount]    = useState("")
  const [notes,         setNotes]         = useState("")

  const clientProjects = projects.filter(
    (p) => !clientId || p.clientId === clientId
  )

  const amountNum = parseFloat(amountHT) || 0
  const taxNum    = parseFloat(taxRate)  || 0
  const amountTTC = amountNum * (1 + taxNum / 100)

  function reset() {
    setClientId(""); setProjectId(""); setCustomNumber("")
    setDate(today); setDescription(""); setAmountHT("")
    setTaxRate("0"); setIsPaid(true); setPaidAt(today)
    setPaidAmount(""); setNotes(""); setError(null)
  }

  function handleClose() { setOpen(false); reset() }

  function handleSubmit() {
    if (!clientId)          return setError("Sélectionne un client")
    if (!description.trim()) return setError("Libellé requis")
    if (amountNum <= 0)     return setError("Montant invalide")
    setError(null)

    startTransition(async () => {
      const res = await importHistoricalInvoice(userId, {
        clientId,
        projectId:    projectId || undefined,
        customNumber: customNumber || undefined,
        date,
        description,
        amountHT:     amountNum,
        taxRate:      taxNum,
        isPaid,
        paidAt:       isPaid ? paidAt : undefined,
        paidAmount:   isPaid && paidAmount ? parseFloat(paidAmount) : undefined,
        notes:        notes || undefined,
      })
      if (res.error) return setError(res.error)
      handleClose()
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Upload className="h-3.5 w-3.5" />
        Importer
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-base">Importer une facture historique</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aucun PDF généré — document existant hors ERP
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">

          {/* Client + Projet */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Client *</label>
              <select
                value={clientId}
                onChange={e => { setClientId(e.target.value); setProjectId("") }}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="">Sélectionner…</option>
                {clients.filter(c => c.type !== "SELF").map(c => (
                  <option key={c.id} value={c.id}>{clientLabel(c)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Projet (optionnel)</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={!clientId || clientProjects.length === 0}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-40"
              >
                <option value="">Aucun</option>
                {clientProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Numéro + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Numéro de référence</label>
              <input
                type="text"
                value={customNumber}
                onChange={e => setCustomNumber(e.target.value)}
                placeholder="Ex: FAC-2025-001"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Laissez vide pour auto-générer</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date de la facture *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Libellé / mission *</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Développement site web Nala Surf House"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>

          {/* Montants */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Montant HT (€) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountHT}
                onChange={e => setAmountHT(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">TVA %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">0 % = franchise AE</p>
            </div>
          </div>

          {amountNum > 0 && (
            <p className="text-xs text-muted-foreground -mt-1">
              Total TTC :{" "}
              <span className="font-medium text-foreground">
                {amountTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </span>
            </p>
          )}

          {/* Payée ? */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsPaid(v => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
                isPaid ? "bg-emerald-500 border-emerald-500" : "bg-muted border-border"
              }`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                isPaid ? "translate-x-4" : "translate-x-0.5"
              }`} />
            </button>
            <span className="text-sm font-medium">Payée</span>
          </div>

          {isPaid && (
            <div className="grid grid-cols-2 gap-3 pl-0">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date du virement</label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={e => setPaidAt(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Montant reçu (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  placeholder={amountTTC > 0 ? amountTTC.toFixed(2) : "0.00"}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Laissez vide = montant TTC</p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes internes (optionnel)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Facture envoyée par email le 23/04/2026"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="gap-1.5">
            {isPending
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importation…</>
              : <><Check className="h-3.5 w-3.5" /> Importer la facture</>
            }
          </Button>
        </div>

      </div>
    </div>
  )
}
