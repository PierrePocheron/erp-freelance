"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Building2 } from "lucide-react"
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
import { createCompany } from "@/actions/crm"

export function CreateCompanyDialog({
  userId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  userId: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleOpenChange(v: boolean) {
    if (!isControlled) setInternalOpen(v)
    controlledOnOpenChange?.(v)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const company = await createCompany({
        name: (fd.get("name") as string).trim(),
        siret: (fd.get("siret") as string) || undefined,
        vatNumber: (fd.get("vatNumber") as string) || undefined,
        email: (fd.get("email") as string) || undefined,
        phone: (fd.get("phone") as string) || undefined,
        website: (fd.get("website") as string) || undefined,
        address: (fd.get("address") as string) || undefined,
        postalCode: (fd.get("postalCode") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        country: (fd.get("country") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      })
      handleOpenChange(false)
      router.push(`/societes/${company.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouvelle société
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md flex flex-col p-0 gap-0 max-h-[90vh]">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Nouvelle société
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-4 pb-4 space-y-4 flex-1 pt-1">
            {/* Nom */}
            <div className="space-y-1.5">
              <Label htmlFor="co-name">Nom *</Label>
              <Input id="co-name" name="name" placeholder="Acme Corp" required autoFocus />
            </div>

            {/* SIRET / TVA */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="co-siret">SIRET</Label>
                <Input id="co-siret" name="siret" placeholder="123 456 789 00012" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-vat">N° TVA</Label>
                <Input id="co-vat" name="vatNumber" placeholder="FR 12 345678900" />
              </div>
            </div>

            {/* Email / Téléphone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="co-email">Email</Label>
                <Input id="co-email" name="email" type="email" placeholder="contact@acme.fr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-phone">Téléphone</Label>
                <Input id="co-phone" name="phone" placeholder="+33 1 …" />
              </div>
            </div>

            {/* Site web */}
            <div className="space-y-1.5">
              <Label htmlFor="co-website">Site web</Label>
              <Input id="co-website" name="website" placeholder="https://acme.fr" />
            </div>

            {/* Adresse */}
            <div className="space-y-1.5">
              <Label htmlFor="co-address">Adresse</Label>
              <Input id="co-address" name="address" placeholder="12 rue de la Paix" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="co-postal">Code postal</Label>
                <Input id="co-postal" name="postalCode" placeholder="75001" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-city">Ville</Label>
                <Input id="co-city" name="city" placeholder="Paris" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="co-country">Pays</Label>
              <Input id="co-country" name="country" defaultValue="France" placeholder="France" />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="co-notes">Notes</Label>
              <textarea
                id="co-notes"
                name="notes"
                rows={3}
                placeholder="Informations complémentaires..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer la société"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
