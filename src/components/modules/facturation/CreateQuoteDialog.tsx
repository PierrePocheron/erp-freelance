"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, UserPlus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createQuote } from "@/actions/facturation"
import { createQuickClient } from "@/actions/crm"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }

const EXPIRY_OPTIONS = [
  { value: "15", label: "15 jours" },
  { value: "30", label: "30 jours" },
  { value: "45", label: "45 jours" },
  { value: "60", label: "60 jours" },
  { value: "90", label: "90 jours" },
  { value: "0", label: "Sans expiration" },
]

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
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "")
  const [newClientName, setNewClientName] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const clientProjects = projects.filter((p) => p.clientId === selectedClientId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const expiresAtDays = Number(fd.get("expiresAtDays")) || 0
    const depositPercent = Number(fd.get("depositPercent")) || 0

    startTransition(async () => {
      let clientId = selectedClientId

      if (mode === "new") {
        if (!newClientName.trim()) return
        const client = await createQuickClient(userId, { name: newClientName.trim() })
        clientId = client.id
      }

      const quote = await createQuote(userId, {
        clientId,
        projectId: (fd.get("projectId") as string) || undefined,
        depositPercent,
        expiresAtDays: expiresAtDays > 0 ? expiresAtDays : undefined,
      })
      setOpen(false)
      router.push(`/facturation/devis/${quote.id}`)
    })
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      setMode("existing")
      setNewClientName("")
      setSelectedClientId(clients[0]?.id ?? "")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        Nouveau devis
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau devis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Client */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <div className="flex rounded-md border border-input overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`flex-1 px-3 py-2 transition-colors ${mode === "existing" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"}`}
              >
                Existant
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 px-3 py-2 flex items-center justify-center gap-1.5 transition-colors ${mode === "new" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"}`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Nouveau client
              </button>
            </div>

            {mode === "existing" ? (
              <div className="relative">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type === "SELF" ? "Perso" : c.company ? `${c.name} — ${c.company}` : c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nom du client ou de l'entreprise"
                  required={mode === "new"}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Un client de type <span className="font-medium">Prospect</span> sera créé. Vous pourrez compléter son profil ensuite.
                </p>
              </div>
            )}
          </div>

          {/* Projet lié (seulement si client existant) */}
          {mode === "existing" && clientProjects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Projet associé</Label>
              <div className="relative">
                <select
                  name="projectId"
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Aucun —</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Expiration */}
            <div className="space-y-1.5">
              <Label>Validité</Label>
              <div className="relative">
                <select
                  name="expiresAtDays"
                  defaultValue="30"
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Acompte */}
            <div className="space-y-1.5">
              <Label>Acompte (%)</Label>
              <Input name="depositPercent" type="number" min="0" max="100" defaultValue="30" className="h-9" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending || (mode === "existing" && !selectedClientId) || (mode === "new" && !newClientName.trim())}
            >
              {isPending ? "Création..." : "Créer le devis"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
