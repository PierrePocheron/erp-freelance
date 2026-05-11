import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProduct, updateProduct, deleteProduct } from "@/actions/facturation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Trash2 } from "lucide-react"

const unitLabels: Record<string, string> = {
  HOUR: "Heure",
  DAY: "Jour",
  MONTH: "Mois",
  YEAR: "An",
  UNIT: "Unité",
}

export default async function ProduitsPage() {
  const session = await auth()
  const userId = session!.user.id

  const products = await prisma.product.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Catalogue produits</h2>
        <p className="text-sm text-muted-foreground">Prestations et tarifs réutilisables dans vos devis et factures</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Formulaire */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 sticky top-6">
            <h3 className="font-semibold text-sm">Nouveau produit</h3>
            <form
              action={async (fd: FormData) => {
                "use server"
                await createProduct(userId, {
                  name: fd.get("name") as string,
                  description: (fd.get("description") as string) || undefined,
                  unitPrice: Number(fd.get("unitPrice")),
                  unit: (fd.get("unit") as string) || "UNIT",
                })
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nom *</label>
                <Input name="name" required placeholder="Développement web" className="h-8" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Description</label>
                <Input name="description" placeholder="Courte description" className="h-8" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Prix *</label>
                  <Input name="unitPrice" type="number" min="0" step="0.01" required placeholder="500" className="h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Unité</label>
                  <select name="unit" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="UNIT">Unité</option>
                    <option value="HOUR">Heure</option>
                    <option value="DAY">Jour</option>
                    <option value="MONTH">Mois</option>
                    <option value="YEAR">An</option>
                  </select>
                </div>
              </div>
              <Button type="submit" size="sm" className="w-full">Ajouter</Button>
            </form>
          </div>
        </div>

        {/* Liste */}
        <div className="lg:col-span-2">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucun produit défini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="group rounded-xl border border-border/50 bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold">{p.unitPrice.toLocaleString("fr-FR")} €</p>
                        <p className="text-xs text-muted-foreground">/ {unitLabels[p.unit] ?? p.unit}</p>
                      </div>
                      <form action={async () => { "use server"; await deleteProduct(p.id, userId) }}>
                        <button type="submit" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Toggle actif */}
                  <form action={async () => { "use server"; await updateProduct(p.id, userId, { isActive: !p.isActive }) }} className="inline-flex">
                    <button type="submit" className={`text-xs rounded-full px-2 py-0.5 border ${p.isActive ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                      {p.isActive ? "Actif" : "Inactif"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
