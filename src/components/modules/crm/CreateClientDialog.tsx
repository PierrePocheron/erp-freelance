"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/actions/crm"

export function CreateClientDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const client = await createClient(userId, {
        name: fd.get("name") as string,
        company: (fd.get("company") as string) || undefined,
        email: (fd.get("email") as string) || undefined,
        phone: (fd.get("phone") as string) || undefined,
        type: (fd.get("type") as string) || undefined,
        source: (fd.get("source") as string) || undefined,
        temperature: (fd.get("temperature") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      })
      setOpen(false)
      router.push(`/crm/${client.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        Nouveau contact
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Nom *</Label>
              <Input name="name" placeholder="Jean Dupont" required />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Société</Label>
              <Input name="company" placeholder="Acme Inc." />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="jean@acme.fr" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input name="phone" placeholder="+33 6 00 00 00 00" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select name="type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="PROSPECT">Prospect</option>
                <option value="CLIENT">Client</option>
                <option value="SELF">Perso</option>
                <option value="INACTIVE">Inactif</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <select name="source" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="OTHER">Autre</option>
                <option value="WORD_OF_MOUTH">Bouche à oreille</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="WEBSITE">Site web</option>
                <option value="INBOUND">Entrant</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Température</Label>
              <select name="temperature" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="COLD">Froid</option>
                <option value="WARM">Tiède</option>
                <option value="HOT">Chaud</option>
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Notes internes..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer le contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
