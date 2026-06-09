"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText, FilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createInvoice, createInvoiceFromQuote } from "@/actions/facturation"
import { cn } from "@/lib/utils"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string | null }
type Quote = {
  id: string
  number: string
  clientId: string
  projectId: string | null
  totalHT: number
  depositPercent: number
  status: string
  client: { name: string; company: string | null }
}

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"
}

function clientLabel(c: Client) {
  if (c.type === "SELF") return "Perso"
  return c.company ? `${c.name} — ${c.company}` : c.name
}

export function CreateInvoiceDialog({
  userId,
  clients,
  projects,
  quotes = [],
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  userId: string
  clients: Client[]
  projects: Project[]
  quotes?: Quote[]
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [mode, setMode] = useState<"blank" | "from_quote">("blank")
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "")
  const [selectedQuoteId, setSelectedQuoteId] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen

  function handleOpenChange(v: boolean) {
    if (!isControlled) setInternalOpen(v)
    controlledOnOpenChange?.(v)
    if (!v) {
      setMode("blank")
      setSelectedQuoteId("")
      setSelectedClientId(clients[0]?.id ?? "")
    }
  }

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId)
  const clientProjects = projects.filter((p) => p.clientId === selectedClientId)

  const defaultDue = new Date()
  defaultDue.setDate(defaultDue.getDate() + 30)
  const defaultDueStr = defaultDue.toISOString().split("T")[0]

  function handleQuoteSelect(quoteId: string) {
    setSelectedQuoteId(quoteId)
    const q = quotes.find((q) => q.id === quoteId)
    if (q) setSelectedClientId(q.clientId)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    if (mode === "from_quote" && selectedQuoteId) {
      const invoiceType = fd.get("invoiceType") as "DEPOSIT" | "FINAL" | "RECURRING"
      startTransition(async () => {
        const invoice = await createInvoiceFromQuote(selectedQuoteId, userId, invoiceType)
        handleOpenChange(false)
        router.push(`/facturation/factures/${invoice.id}`)
      })
    } else {
      startTransition(async () => {
        const invoice = await createInvoice(userId, {
          clientId: selectedClientId,
          projectId: (fd.get("projectId") as string) || undefined,
          type: (fd.get("type") as string) || undefined,
          dueDate: (fd.get("dueDate") as string) || undefined,
          notes: (fd.get("notes") as string) || undefined,
        })
        handleOpenChange(false)
        router.push(`/facturation/factures/${invoice.id}`)
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Mode toggle — seulement si des devis sont disponibles */}
          {quotes.length > 0 && (
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setMode("blank")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 transition-colors",
                  mode === "blank" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <FilePlus className="h-4 w-4" />
                Facture vierge
              </button>
              <button
                type="button"
                onClick={() => setMode("from_quote")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 border-l border-border transition-colors",
                  mode === "from_quote" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <FileText className="h-4 w-4" />
                Depuis un devis
              </button>
            </div>
          )}

          {mode === "from_quote" ? (
            <>
              {/* Sélection du devis */}
              <div className="space-y-1.5">
                <Label>Devis *</Label>
                <select
                  value={selectedQuoteId}
                  onChange={(e) => handleQuoteSelect(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Choisir un devis —</option>
                  {quotes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.number} · {q.client.company ?? q.client.name} · {fmtEur(q.totalHT)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedQuote && (
                <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant HT</span>
                    <span className="font-medium">{fmtEur(selectedQuote.totalHT)}</span>
                  </div>
                  {selectedQuote.depositPercent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Acompte ({selectedQuote.depositPercent}%)</span>
                      <span>{fmtEur(selectedQuote.totalHT * selectedQuote.depositPercent / 100)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Type de facturation */}
              <div className="space-y-1.5">
                <Label>Type de facture *</Label>
                <select
                  name="invoiceType"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {selectedQuote && selectedQuote.depositPercent > 0 && (
                    <>
                      <option value="DEPOSIT">Acompte ({selectedQuote.depositPercent}% · {fmtEur(selectedQuote.totalHT * selectedQuote.depositPercent / 100)})</option>
                      <option value="FINAL">Solde (montant total)</option>
                    </>
                  )}
                  <option value="RECURRING">Intermédiaire (montant total)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{clientLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {clientProjects.length > 0 && (
                  <div className="space-y-1.5 col-span-2">
                    <Label>Projet associé</Label>
                    <select name="projectId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">— Aucun —</option>
                      {clientProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select name="type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="STANDALONE">Standard</option>
                    <option value="DEPOSIT">Acompte</option>
                    <option value="FINAL">Solde</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Échéance</Label>
                  <Input name="dueDate" type="date" defaultValue={defaultDueStr} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Conditions de paiement..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
            <Button
              type="submit"
              disabled={isPending || (mode === "blank" ? !selectedClientId : !selectedQuoteId)}
            >
              {isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
