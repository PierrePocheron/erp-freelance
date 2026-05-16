"use client"

import { useState } from "react"
import { UserPlus, FolderPlus, FileText, Receipt, Package } from "lucide-react"
import { CreateClientDialog } from "@/components/modules/crm/CreateClientDialog"
import { CreateProjectDialog } from "@/components/modules/projet/CreateProjectDialog"
import { CreateQuoteDialog } from "@/components/modules/facturation/CreateQuoteDialog"
import { CreateInvoiceDialog } from "@/components/modules/facturation/CreateInvoiceDialog"
import { CreateProductDialog } from "@/components/modules/facturation/CreateProductDialog"

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }
type Product = { id: string; name: string; description: string | null; unitPrice: number; unit: string; isActive: boolean; billingType: string; defaultTaxRate: number }
type Quote = { id: string; number: string; clientId: string; projectId: string | null; totalHT: number; depositPercent: number; status: string; client: { name: string; company: string | null } }

const btnClass =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"

const actions = [
  { key: "client",  icon: UserPlus,   label: "Nouveau client" },
  { key: "projet",  icon: FolderPlus, label: "Nouveau projet" },
  { key: "devis",   icon: FileText,   label: "Nouveau devis" },
  { key: "facture", icon: Receipt,    label: "Nouvelle facture" },
  { key: "produit", icon: Package,    label: "Nouveau produit" },
] as const

type ActionKey = typeof actions[number]["key"]

export function QuickActionsBar({
  userId,
  clients,
  projects,
  products = [],
  quotes = [],
  defaultConditions = "",
}: {
  userId: string
  clients: Client[]
  projects: Project[]
  products?: Product[]
  quotes?: Quote[]
  defaultConditions?: string
}) {
  const [openDialog, setOpenDialog] = useState<ActionKey | null>(null)

  function open(key: ActionKey) { setOpenDialog(key) }
  function close() { setOpenDialog(null) }

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Raccourcis</p>

        {actions.map(({ key, icon: Icon, label }) => (
          <button key={key} type="button" onClick={() => open(key)} className={btnClass}>
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </button>
        ))}
      </div>

      <CreateClientDialog
        userId={userId}
        open={openDialog === "client"}
        onOpenChange={(v) => { if (!v) close() }}
      />
      <CreateProjectDialog
        userId={userId}
        clients={clients}
        open={openDialog === "projet"}
        onOpenChange={(v) => { if (!v) close() }}
      />
      <CreateQuoteDialog
        userId={userId}
        clients={clients}
        projects={projects}
        products={products}
        defaultConditions={defaultConditions}
        open={openDialog === "devis"}
        onOpenChange={(v) => { if (!v) close() }}
      />
      <CreateInvoiceDialog
        userId={userId}
        clients={clients}
        projects={projects}
        quotes={quotes}
        open={openDialog === "facture"}
        onOpenChange={(v) => { if (!v) close() }}
      />
      <CreateProductDialog
        userId={userId}
        open={openDialog === "produit"}
        onOpenChange={(v) => { if (!v) close() }}
      />
    </div>
  )
}
