"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronDown, Trash2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createQuoteWithLines } from "@/actions/facturation"
import { ClientCombobox } from "./ClientCombobox"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }

type DraftLine = {
  localId: string
  description: string
  detail: string
  quantity: number
  unitPrice: number
  taxRate: number
}

type LineFormState = {
  description: string
  detail: string
  quantity: string
  unitPrice: string
  taxRate: string
}

const TAX_RATES = [
  { value: 0, label: "0%" },
  { value: 2.1, label: "2,1%" },
  { value: 5.5, label: "5,5%" },
  { value: 8.5, label: "8,5%" },
  { value: 10, label: "10%" },
  { value: 20, label: "20%" },
]

const EXPIRY_OPTIONS = [
  { value: "15", label: "15 jours" },
  { value: "30", label: "30 jours" },
  { value: "45", label: "45 jours" },
  { value: "60", label: "60 jours" },
  { value: "90", label: "90 jours" },
  { value: "0", label: "Sans expiration" },
]

const emptyLineForm: LineFormState = {
  description: "",
  detail: "",
  quantity: "1",
  unitPrice: "0",
  taxRate: "20",
}

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtTaxLabel(rate: number) {
  return rate === 0 ? "0%" : `${String(rate).replace(".", ",")}%`
}

function computeTotals(lines: DraftLine[]) {
  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const byRate: Record<number, number> = {}
  for (const l of lines) {
    byRate[l.taxRate] = (byRate[l.taxRate] ?? 0) + l.quantity * l.unitPrice * (l.taxRate / 100)
  }
  const totalTVA = Object.values(byRate).reduce((s, v) => s + v, 0)
  return { totalHT, byRate, totalTVA, totalTTC: totalHT + totalTVA }
}

function LineForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Ajouter",
}: {
  initial: LineFormState
  onSubmit: (data: LineFormState) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [form, setForm] = useState(initial)
  const subtotal = (parseFloat(form.quantity) || 0) * (parseFloat(form.unitPrice) || 0)

  function set(k: keyof LineFormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleConfirm() {
    if (!form.description.trim()) return
    onSubmit(form)
  }

  return (
    <div className="space-y-2.5 p-3 bg-muted/20 rounded-lg border border-border/60">
      <div className="space-y-1.5">
        <input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          required
          autoFocus
          placeholder="Titre de la prestation *"
          className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={form.detail}
          onChange={(e) => set("detail", e.target.value)}
          placeholder="Description détaillée (optionnel)"
          rows={2}
          className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground shrink-0">Qté</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            className="w-20 text-sm bg-background border border-input rounded-md px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground shrink-0">Prix HT</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => set("unitPrice", e.target.value)}
            className="w-28 text-sm bg-background border border-input rounded-md px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">€</span>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground shrink-0">TVA</label>
          <div className="relative">
            <select
              value={form.taxRate}
              onChange={(e) => set("taxRate", e.target.value)}
              className="appearance-none h-8 pr-7 pl-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TAX_RATES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div className="ml-auto text-sm font-medium text-right">
          <span className="text-muted-foreground text-xs mr-1">Sous-total HT</span>
          {fmtEur(subtotal)}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!form.description.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> {submitLabel}
        </button>
      </div>
    </div>
  )
}

export function CreateQuoteDialog({
  userId,
  clients,
  projects,
}: {
  userId: string
  clients: Client[]
  projects: Project[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState("")
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null)
  const [expiresAtDays, setExpiresAtDays] = useState("30")
  const [depositPercent, setDepositPercent] = useState("30")
  const [generalConditions, setGeneralConditions] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const clientProjects = projects.filter((p) => p.clientId === selectedClientId)
  const { totalHT, byRate, totalTVA, totalTTC } = computeTotals(draftLines)
  const allZeroTax = totalTVA === 0

  function reset() {
    setSelectedClientId("")
    setDraftLines([])
    setShowAddForm(false)
    setEditingLocalId(null)
    setExpiresAtDays("30")
    setDepositPercent("30")
    setGeneralConditions("")
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) reset()
  }

  function handleAddLine(data: LineFormState) {
    setDraftLines((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        description: data.description,
        detail: data.detail,
        quantity: parseFloat(data.quantity) || 1,
        unitPrice: parseFloat(data.unitPrice) || 0,
        taxRate: parseFloat(data.taxRate) || 0,
      },
    ])
    setShowAddForm(false)
  }

  function handleUpdateLine(localId: string, data: LineFormState) {
    setDraftLines((prev) =>
      prev.map((l) =>
        l.localId === localId
          ? {
              ...l,
              description: data.description,
              detail: data.detail,
              quantity: parseFloat(data.quantity) || 1,
              unitPrice: parseFloat(data.unitPrice) || 0,
              taxRate: parseFloat(data.taxRate) || 0,
            }
          : l
      )
    )
    setEditingLocalId(null)
  }

  function startEdit(localId: string) {
    setEditingLocalId(localId)
    setShowAddForm(false)
  }

  function startAdd() {
    setShowAddForm(true)
    setEditingLocalId(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedClientId) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const quote = await createQuoteWithLines(userId, {
        clientId: selectedClientId,
        projectId: (fd.get("projectId") as string) || undefined,
        depositPercent: parseFloat(depositPercent) || 0,
        expiresAtDays: parseFloat(expiresAtDays) > 0 ? parseFloat(expiresAtDays) : undefined,
        generalConditions: generalConditions || undefined,
        lines: draftLines.map((l) => ({
          description: l.description,
          detail: l.detail || undefined,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      })
      setOpen(false)
      router.push(`/facturation/devis/${quote.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        Nouveau devis
      </DialogTrigger>

      <DialogContent className="sm:max-w-4xl p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 pr-12 border-b border-border">
          <DialogTitle>Nouveau devis</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="overflow-y-auto max-h-[calc(80vh-10rem)] px-6 py-5 space-y-6">

            {/* Client + Projet */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <ClientCombobox
                  userId={userId}
                  clients={clients}
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Projet associé</Label>
                <div className="relative">
                  <select
                    name="projectId"
                    disabled={clientProjects.length === 0}
                    className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                  >
                    <option value="">— Aucun —</option>
                    {clientProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Paramètres */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Validité</Label>
                <div className="relative">
                  <select
                    value={expiresAtDays}
                    onChange={(e) => setExpiresAtDays(e.target.value)}
                    className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {EXPIRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Acompte (%)</Label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Prestations */}
            <div className="space-y-2">
              <Label>Prestations</Label>

              {/* Table with existing lines */}
              {draftLines.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-b border-border">
                    <div className="col-span-5">Prestation</div>
                    <div className="col-span-1 text-right">Qté</div>
                    <div className="col-span-2 text-right">Prix HT</div>
                    <div className="col-span-1 text-center">TVA</div>
                    <div className="col-span-2 text-right">Total HT</div>
                    <div className="col-span-1" />
                  </div>

                  {draftLines.map((line) =>
                    editingLocalId === line.localId ? (
                      <div key={line.localId} className="p-3 border-b border-border/50 last:border-0">
                        <LineForm
                          initial={{
                            description: line.description,
                            detail: line.detail,
                            quantity: String(line.quantity),
                            unitPrice: String(line.unitPrice),
                            taxRate: String(line.taxRate),
                          }}
                          onSubmit={(data) => handleUpdateLine(line.localId, data)}
                          onCancel={() => setEditingLocalId(null)}
                          submitLabel="Valider"
                        />
                      </div>
                    ) : (
                      <div
                        key={line.localId}
                        className="group grid grid-cols-12 gap-2 px-3 py-2.5 items-start border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors text-sm"
                      >
                        <div className="col-span-5">
                          <p className="font-medium leading-tight">{line.description}</p>
                          {line.detail && (
                            <p className="text-xs text-muted-foreground mt-0.5">{line.detail}</p>
                          )}
                        </div>
                        <div className="col-span-1 text-right text-muted-foreground">{line.quantity}</div>
                        <div className="col-span-2 text-right text-muted-foreground">{fmtEur(line.unitPrice)}</div>
                        <div className="col-span-1 text-center">
                          <span className="text-xs rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground">
                            {fmtTaxLabel(line.taxRate)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right font-semibold">
                          {fmtEur(line.quantity * line.unitPrice)}
                        </div>
                        <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEdit(line.localId)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraftLines((p) => p.filter((l) => l.localId !== line.localId))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {showAddForm ? (
                    <div className="p-3">
                      <LineForm
                        initial={emptyLineForm}
                        onSubmit={handleAddLine}
                        onCancel={() => setShowAddForm(false)}
                      />
                    </div>
                  ) : editingLocalId === null ? (
                    <button
                      type="button"
                      onClick={startAdd}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter une prestation
                    </button>
                  ) : null}
                </div>
              )}

              {/* No lines yet */}
              {draftLines.length === 0 && (
                showAddForm ? (
                  <LineForm
                    initial={emptyLineForm}
                    onSubmit={handleAddLine}
                    onCancel={() => setShowAddForm(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startAdd}
                    className="flex items-center gap-2 w-full px-3 py-3 text-sm text-muted-foreground border border-dashed border-border rounded-lg hover:text-foreground hover:border-border/80 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter une prestation
                  </button>
                )
              )}

              {/* Totaux */}
              {draftLines.length > 0 && !showAddForm && editingLocalId === null && (
                <div className="flex justify-end pt-1">
                  <div className="space-y-1 min-w-52 text-sm">
                    <div className="flex justify-between gap-8">
                      <span className="text-muted-foreground">Total HT</span>
                      <span className="font-medium">{fmtEur(totalHT)}</span>
                    </div>
                    {allZeroTax ? (
                      <p className="text-xs text-muted-foreground text-right">
                        TVA non applicable — art. 293B du CGI
                      </p>
                    ) : (
                      <>
                        {Object.entries(byRate)
                          .filter(([, v]) => v > 0)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([rate, amount]) => (
                            <div key={rate} className="flex justify-between gap-8">
                              <span className="text-muted-foreground">TVA {fmtTaxLabel(Number(rate))}</span>
                              <span className="text-muted-foreground">{fmtEur(amount)}</span>
                            </div>
                          ))}
                        <div className="border-t border-border pt-1.5 flex justify-between gap-8">
                          <span className="font-bold">Total TTC</span>
                          <span className="font-bold text-base text-primary">{fmtEur(totalTTC)}</span>
                        </div>
                      </>
                    )}
                    {allZeroTax && (
                      <div className="border-t border-border pt-1.5 flex justify-between gap-8">
                        <span className="font-bold">Total</span>
                        <span className="font-bold text-base text-primary">{fmtEur(totalHT)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Conditions générales */}
            <div className="space-y-1.5">
              <Label>Conditions générales</Label>
              <textarea
                value={generalConditions}
                onChange={(e) => setGeneralConditions(e.target.value)}
                rows={3}
                placeholder="Conditions de paiement, délais d'exécution... (apparaissent dans le PDF)"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {draftLines.length === 0
                ? "Vous pourrez ajouter des prestations après création"
                : `${draftLines.length} prestation${draftLines.length > 1 ? "s" : ""} · ${fmtEur(totalHT)} HT${!allZeroTax ? ` · ${fmtEur(totalTTC)} TTC` : ""}`}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !selectedClientId}>
                {isPending ? "Création..." : "Créer le devis"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
