"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Package, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createProduct } from "@/actions/facturation"
import { CreateQuoteDialog } from "@/components/modules/facturation/CreateQuoteDialog"
import { CreateInvoiceDialog } from "@/components/modules/facturation/CreateInvoiceDialog"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }
type Product = { id: string; name: string; description: string | null; unitPrice: number; unit: string; isActive: boolean; billingType: string; defaultTaxRate: number }

const UNIT_OPTIONS = [
  { value: "UNIT", label: "Unité" },
  { value: "HOUR", label: "Heure" },
  { value: "DAY", label: "Jour" },
  { value: "MONTH", label: "Mois" },
  { value: "FLAT", label: "Forfait" },
]

function CreateProductDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

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
      setOpen(false)
      router.push("/facturation/produits")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
        <Package className="h-4 w-4 text-muted-foreground" />
        Nouveau produit
      </DialogTrigger>
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
              <Input
                name="unitPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

export function QuickActionsBar({
  userId,
  clients,
  projects,
  products = [],
  defaultConditions = "",
}: {
  userId: string
  clients: Client[]
  projects: Project[]
  products?: Product[]
  defaultConditions?: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Raccourcis</p>
        <CreateQuoteDialog userId={userId} clients={clients} projects={projects} products={products} defaultConditions={defaultConditions} />
        <CreateInvoiceDialog userId={userId} clients={clients} projects={projects} />
        <CreateProductDialog userId={userId} />
        <a
          href="/facturation/devis"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Tous les devis →
        </a>
      </div>
    </div>
  )
}
