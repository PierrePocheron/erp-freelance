"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createInvoice } from "@/actions/facturation"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }

export function CreateInvoiceDialog({
  userId,
  clients,
  projects,
}: {
  userId: string
  clients: Client[]
  projects: Project[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const clientProjects = projects.filter((p) => p.clientId === selectedClientId)

  const defaultDue = new Date()
  defaultDue.setDate(defaultDue.getDate() + 30)
  const defaultDueStr = defaultDue.toISOString().split("T")[0]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const invoice = await createInvoice(userId, {
        clientId: selectedClientId,
        projectId: (fd.get("projectId") as string) || undefined,
        type: (fd.get("type") as string) || undefined,
        dueDate: (fd.get("dueDate") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      })
      setOpen(false)
      router.push(`/facturation/factures/${invoice.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        Nouvelle facture
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === "SELF" ? "Perso" : c.company ? `${c.name} — ${c.company}` : c.name}
                </option>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending || !selectedClientId}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
