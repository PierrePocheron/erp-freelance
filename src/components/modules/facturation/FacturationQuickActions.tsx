"use client"

import { useState } from "react"
import { FileText, Receipt } from "lucide-react"
import { CreateQuoteDialog } from "./CreateQuoteDialog"
import { CreateInvoiceDialog } from "./CreateInvoiceDialog"

type Client  = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string | null }

export function FacturationQuickActions({
  userId,
  clients,
  projects,
}: {
  userId: string
  clients: Client[]
  projects: Project[]
}) {
  const [quoteOpen,   setQuoteOpen]   = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setQuoteOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        + Devis
      </button>

      <button
        type="button"
        onClick={() => setInvoiceOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Receipt className="h-3.5 w-3.5" />
        + Facture
      </button>

      <CreateQuoteDialog
        userId={userId}
        clients={clients}
        projects={projects}
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
      />

      <CreateInvoiceDialog
        userId={userId}
        clients={clients}
        projects={projects}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
      />
    </div>
  )
}
