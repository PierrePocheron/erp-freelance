"use client"

import { useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, UserPlus, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProject } from "@/actions/projet"
import { createQuickClient } from "@/actions/crm"

type Client = { id: string; name: string; company: string | null; type: string }

function clientLabel(c: Client) {
  if (c.type === "SELF" || c.type === "PERSONAL") return c.name
  return c.company ? `${c.name} — ${c.company}` : c.name
}

export function CreateProjectDialog({
  userId,
  clients: initialClients,
  defaultClientId,
}: {
  userId: string
  clients: Client[]
  defaultClientId?: string
}) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState(initialClients)
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId ?? initialClients[0]?.id ?? "")
  const [showNewClient, setShowNewClient] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isCreatingClient, startCreatingClient] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("clientId", selectedClientId)
    startTransition(async () => {
      const project = await createProject(userId, formData)
      setOpen(false)
      router.push(`/projets/${project.id}`)
    })
  }

  function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startCreatingClient(async () => {
      const client = await createQuickClient(userId, {
        name: fd.get("clientName") as string,
        company: (fd.get("clientCompany") as string) || undefined,
        email: (fd.get("clientEmail") as string) || undefined,
      })
      setClients((prev) => [...prev, { id: client.id, name: client.name, company: client.company, type: client.type }])
      setSelectedClientId(client.id)
      setShowNewClient(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        Nouveau projet
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{showNewClient ? "Nouveau client" : "Nouveau projet"}</DialogTitle>
        </DialogHeader>

        {/* Formulaire création client — caché mais conservé dans le DOM pour ne pas perdre les données du formulaire projet */}
        <form onSubmit={handleCreateClient} className={showNewClient ? "space-y-4 pt-2" : "hidden"}>
          <button
            type="button"
            onClick={() => setShowNewClient(false)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Nom *</Label>
            <Input id="clientName" name="clientName" placeholder="Jean Dupont" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientCompany">Société</Label>
            <Input id="clientCompany" name="clientCompany" placeholder="Acme Inc." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientEmail">Email</Label>
            <Input id="clientEmail" name="clientEmail" type="email" placeholder="jean@acme.fr" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowNewClient(false)}>Annuler</Button>
            <Button type="submit" disabled={isCreatingClient}>
              {isCreatingClient ? "Création..." : "Créer le client"}
            </Button>
          </div>
        </form>

        {/* Formulaire création projet — caché via CSS, pas démonté */}
        <form onSubmit={handleSubmit} className={showNewClient ? "hidden" : "space-y-4 pt-2"}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom du projet *</Label>
            <Input id="name" name="name" placeholder="Mon site e-commerce" required />
          </div>

          <div className="space-y-1.5">
            <Label>Client *</Label>
            <div className="flex gap-2">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{clientLabel(c)}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewClient(true)}
                title="Nouveau client"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Courte description..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Début</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fin estimée</Label>
              <Input id="endDate" name="endDate" type="date" min={startDate || undefined} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estimatedHours">Heures estimées</Label>
            <Input id="estimatedHours" name="estimatedHours" type="number" min="0" step="0.5" placeholder="20" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending || !selectedClientId}>
              {isPending ? "Création..." : "Créer le projet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
