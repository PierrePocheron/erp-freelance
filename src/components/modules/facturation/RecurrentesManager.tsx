"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Pencil, Trash2, Power, PowerOff, RefreshCw, RefreshCwIcon, X, Zap } from "lucide-react"
import { useSortState, cmp } from "@/hooks/use-sortable"
import { Th } from "@/components/ui/sortable-header"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  setRecurringInvoiceLines,
  generateInvoiceFromRecurring,
} from "@/actions/facturation"
import { ClientCombobox } from "./ClientCombobox"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string | null }
type Product = { id: string; name: string; unitPrice: number; defaultTaxRate: number; unit: string }
type RecurringLine = {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  productId?: string | null
}
type RecurringRow = {
  id: string
  name: string
  frequency: string
  nextGenerationDate: Date
  isActive: boolean
  createdAt: Date
  totalHT: number
  client: { id: string; name: string; company: string | null }
  project: { id: string; name: string } | null
  lines: RecurringLine[]
}

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel",
  YEARLY: "Annuel",
  CUSTOM: "Personnalisé",
}

const FREQ_BADGE: Record<string, string> = {
  MONTHLY: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  QUARTERLY: "bg-violet-500/15 text-violet-600 border-violet-500/20",
  YEARLY: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  CUSTOM: "bg-muted text-muted-foreground border-border",
}

const fmtEur = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"

export function RecurrentesManager({
  userId,
  clients,
  projects,
  products,
  recurringInvoices,
}: {
  userId: string
  clients: Client[]
  projects: Project[]
  products: Product[]
  recurringInvoices: RecurringRow[]
}) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { sortCol, sortDir, toggle } = useSortState("nextGenerationDate", "asc")

  const sortedRows = useMemo(() => {
    if (!sortCol) return recurringInvoices
    return [...recurringInvoices].sort((a, b) => {
      switch (sortCol) {
        case "name":               return cmp(a.name, b.name, sortDir)
        case "client":             return cmp(a.client.company ?? a.client.name, b.client.company ?? b.client.name, sortDir)
        case "frequency":          return cmp(a.frequency, b.frequency, sortDir)
        case "totalHT":            return cmp(a.totalHT, b.totalHT, sortDir)
        case "nextGenerationDate": return cmp(new Date(a.nextGenerationDate), new Date(b.nextGenerationDate), sortDir)
        case "isActive":           return cmp(a.isActive, b.isActive, sortDir)
        default: return 0
      }
    })
  }, [recurringInvoices, sortCol, sortDir])

  // Template fields
  const [clientId, setClientId] = useState("")
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("MONTHLY")
  const [nextDate, setNextDate] = useState("")
  const [projectId, setProjectId] = useState("")

  // Lines
  const [lines, setLines] = useState<RecurringLine[]>([])

  const clientProjects = projects.filter((p) => p.clientId === clientId)

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  function resetForm() {
    setClientId("")
    setName("")
    setFrequency("MONTHLY")
    setNextDate("")
    setProjectId("")
    setLines([])
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, taxRate: 0 }])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, patch: Partial<RecurringLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function pickProduct(idx: number, productId: string) {
    const p = products.find((p) => p.id === productId)
    if (!p) return
    updateLine(idx, {
      productId: p.id,
      description: p.name,
      unitPrice: p.unitPrice,
      taxRate: p.defaultTaxRate,
    })
  }

  function handleCreate() {
    if (!clientId || !name || !nextDate) return
    startTransition(async () => {
      const rec = await createRecurringInvoice(userId, {
        clientId,
        projectId: projectId || undefined,
        name,
        frequency,
        nextGenerationDate: nextDate,
      })
      if (lines.length > 0) {
        await setRecurringInvoiceLines(rec.id, userId, lines)
      }
      setShowCreate(false)
      resetForm()
      toast.success("Modèle créé")
    })
  }

  function handleToggle(row: RecurringRow) {
    startTransition(async () => {
      await updateRecurringInvoice(row.id, userId, { isActive: !row.isActive })
      toast.success(row.isActive ? "Modèle désactivé" : "Modèle activé")
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteRecurringInvoice(id, userId)
      toast.success("Modèle supprimé")
    })
  }

  function handleGenerate(row: RecurringRow) {
    startTransition(async () => {
      try {
        const inv = await generateInvoiceFromRecurring(row.id, userId)
        toast.success("Facture générée", { description: "Redirection vers la facture…" })
        router.push(`/facturation/factures/${inv.id}`)
      } catch {
        toast.error("Erreur lors de la génération")
      }
    })
  }

  function startEdit(row: RecurringRow) {
    setEditId(row.id)
    setClientId(row.client.id)
    setName(row.name)
    setFrequency(row.frequency)
    setNextDate(new Date(row.nextGenerationDate).toISOString().split("T")[0])
    setProjectId(row.project?.id ?? "")
    setLines(row.lines.map((l) => ({ ...l })))
  }

  function handleUpdate() {
    if (!editId || !name || !nextDate) return
    startTransition(async () => {
      await updateRecurringInvoice(editId, userId, {
        name,
        frequency,
        nextGenerationDate: nextDate,
        projectId: projectId || null,
      })
      await setRecurringInvoiceLines(editId, userId, lines)
      setEditId(null)
      resetForm()
      toast.success("Modèle mis à jour")
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RefreshCwIcon className="h-5 w-5 text-muted-foreground" />
            Factures récurrentes
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {recurringInvoices.length} modèle{recurringInvoices.length !== 1 ? "s" : ""} de facturation récurrente
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true) }} size="sm">
          <Plus className="h-4 w-4" />
          Nouveau modèle
        </Button>
      </div>

      {/* Liste */}
      {recurringInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <RefreshCw className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun modèle récurrent</p>
          <p className="text-sm text-muted-foreground mt-1">
            Créez un modèle pour planifier vos factures récurrentes
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Nom"                  col="name"               sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Client"               col="client"             sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Fréquence"            col="frequency"          sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Montant HT"           col="totalHT"            sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" align="right" />
                <Th label="Prochaine génération" col="nextGenerationDate" sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Statut"               col="isActive"           sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.client.company ?? row.client.name}
                    {row.project && (
                      <span className="text-xs text-muted-foreground ml-1.5">· {row.project.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${FREQ_BADGE[row.frequency] ?? FREQ_BADGE.CUSTOM}`}>
                      {FREQ_LABELS[row.frequency] ?? row.frequency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {row.totalHT > 0 ? fmtEur(row.totalHT) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(row.nextGenerationDate).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      row.isActive
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {row.isActive ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.isActive && (
                        <button
                          type="button"
                          onClick={() => handleGenerate(row)}
                          disabled={isPending}
                          className="p-1.5 rounded text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
                          title="Générer maintenant"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(row)}
                        disabled={isPending}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        title={row.isActive ? "Désactiver" : "Activer"}
                      >
                        {row.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        disabled={isPending}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale création / édition */}
      <Dialog open={showCreate || editId !== null} onOpenChange={(v) => {
        if (!v) { setShowCreate(false); setEditId(null); resetForm() }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le modèle" : "Nouveau modèle récurrent"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nom du modèle *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maintenance mensuelle"
                className="h-8"
              />
            </div>

            {!editId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Client *</label>
                <ClientCombobox
                  userId={userId}
                  clients={clients}
                  value={clientId}
                  onChange={(v) => { setClientId(v); setProjectId("") }}
                />
              </div>
            )}

            {clientProjects.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Projet</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Aucun —</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Fréquence *</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="QUARTERLY">Trimestriel</option>
                  <option value="YEARLY">Annuel</option>
                  <option value="CUSTOM">Personnalisé</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Prochaine génération *</label>
                <Input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>

            {/* Lignes */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-medium">Lignes de prestation</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Ajouter une ligne
                </button>
              </div>

              {lines.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Aucune ligne — la facture générée sera vide</p>
              ) : (
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {products.length > 0 && (
                          <select
                            className="flex h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
                            value={line.productId ?? ""}
                            onChange={(e) => e.target.value ? pickProduct(idx, e.target.value) : updateLine(idx, { productId: null })}
                          >
                            <option value="">Prestation libre…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="Description"
                        className="h-7 text-xs"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-muted-foreground">Qté</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-muted-foreground">PU HT (€)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-muted-foreground">TVA (%)</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={line.taxRate}
                            onChange={(e) => updateLine(idx, { taxRate: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <p className="text-right text-xs text-muted-foreground">
                        Total : <span className="font-medium text-foreground">{fmtEur(line.quantity * line.unitPrice)}</span>
                      </p>
                    </div>
                  ))}

                  {lines.length > 0 && (
                    <p className="text-right text-sm font-semibold">
                      Total HT : {fmtEur(totalHT)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditId(null); resetForm() }}>
                Annuler
              </Button>
              <Button
                type="button"
                disabled={isPending || !name || !nextDate || (!editId && !clientId)}
                onClick={editId ? handleUpdate : handleCreate}
              >
                {isPending ? "Enregistrement…" : editId ? "Enregistrer" : "Créer le modèle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
