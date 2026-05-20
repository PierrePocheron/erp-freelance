"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Package, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createProduct } from "@/actions/facturation"

const UNIT_OPTIONS = [
  { value: "UNIT", label: "Unité" },
  { value: "HOUR", label: "Heure" },
  { value: "DAY", label: "Jour" },
  { value: "MONTH", label: "Mois" },
  { value: "FLAT", label: "Forfait" },
]

export function CreateProductDialog({
  userId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  userId: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen

  function handleOpenChange(v: boolean) {
    if (!isControlled) setInternalOpen(v)
    controlledOnOpenChange?.(v)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await createProduct(userId, {
        name: fd.get("name") as string,
        description: (fd.get("description") as string) || undefined,
        unitPrice: parseFloat(fd.get("unitPrice") as string) || 0,
        unit: (fd.get("unit") as string) || "UNIT",
        billingType: (fd.get("billingType") as string) || "ONE_SHOT",
        defaultTaxRate: parseFloat(fd.get("defaultTaxRate") as string) || 0,
      })
      handleOpenChange(false)
      router.push("/facturation/produits")
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
          <Package className="h-4 w-4 text-muted-foreground" />
          Nouveau produit
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouveau produit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nom *</Label>
            <Input name="name" required placeholder="Ex: Développement web" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input name="description" placeholder="Description courte" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prix HT (€)</Label>
              <Input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Unité</Label>
              <div className="relative">
                <select
                  name="unit"
                  defaultValue="UNIT"
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>TVA par défaut</Label>
              <div className="relative">
                <select
                  name="defaultTaxRate"
                  defaultValue="0"
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="0">0%</option>
                  <option value="2.1">2,1%</option>
                  <option value="5.5">5,5%</option>
                  <option value="8.5">8,5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Facturation</Label>
              <div className="relative">
                <select
                  name="billingType"
                  defaultValue="ONE_SHOT"
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ONE_SHOT">Unique</option>
                  <option value="MONTHLY">Mensuel</option>
                  <option value="QUARTERLY">Trimestriel</option>
                  <option value="YEARLY">Annuel</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
