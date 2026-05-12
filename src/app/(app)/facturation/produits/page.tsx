import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProduct } from "@/actions/facturation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package } from "lucide-react"
import { ProductCard } from "@/components/modules/facturation/ProductCard"

export default async function ProduitsPage() {
  const session = await auth()
  const userId = session!.user.id

  const products = await prisma.product.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  }) as unknown as Array<{
    id: string; name: string; description: string | null; unitPrice: number;
    unit: string; isActive: boolean; billingType: string; defaultTaxRate: number;
  }>

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
                  billingType: (fd.get("billingType") as string) || "ONE_SHOT",
                  defaultTaxRate: Number(fd.get("defaultTaxRate")) || 0,
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
                    <option value="FLAT">Forfait</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">TVA par défaut</label>
                  <select name="defaultTaxRate" defaultValue="0" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="0">0%</option>
                    <option value="2.1">2,1%</option>
                    <option value="5.5">5,5%</option>
                    <option value="8.5">8,5%</option>
                    <option value="10">10%</option>
                    <option value="20">20%</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Facturation</label>
                  <select name="billingType" defaultValue="ONE_SHOT" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="ONE_SHOT">Unique</option>
                    <option value="MONTHLY">Mensuel</option>
                    <option value="QUARTERLY">Trimestriel</option>
                    <option value="YEARLY">Annuel</option>
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
                <ProductCard key={p.id} product={p} userId={userId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
