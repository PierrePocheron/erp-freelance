"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
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

type Client = { id: string; name: string; company: string | null; type: string }

export function CreateProjectDialog({
  userId,
  clients,
}: {
  userId: string
  clients: Client[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const project = await createProject(userId, formData)
      setOpen(false)
      router.push(`/projets/${project.id}`)
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
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom du projet *</Label>
            <Input id="name" name="name" placeholder="Mon site e-commerce" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client *</Label>
            <select
              id="clientId"
              name="clientId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === "SELF" ? "Perso" : c.company ? `${c.name} (${c.company})` : c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Courte description..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Début</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fin estimée</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estimatedHours">Heures estimées</Label>
            <Input
              id="estimatedHours"
              name="estimatedHours"
              type="number"
              min="0"
              step="0.5"
              placeholder="20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer le projet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
