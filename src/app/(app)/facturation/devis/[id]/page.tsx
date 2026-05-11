import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Download, Send, CheckCircle2, XCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LineItemsEditor } from "@/components/modules/facturation/LineItemsEditor"
import { updateQuoteStatus, deleteQuote, createInvoiceFromQuote, updateQuoteNotes } from "@/actions/facturation"
import { redirect } from "next/navigation"

const statusConfig = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  SENT: { label: "Envoyé", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ACCEPTED: { label: "Accepté", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  REJECTED: { label: "Refusé", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
}

export default async function DevisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const quote = await prisma.quote.findFirst({
    where: { id, userId },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
      lines: { orderBy: { id: "asc" } },
      invoices: { select: { id: true, number: true, type: true, status: true } },
    },
  })

  if (!quote) notFound()

  const status = statusConfig[quote.status as keyof typeof statusConfig]
  const isEditable = quote.status === "DRAFT"
  const depositAmount = quote.totalHT * (quote.depositPercent / 100)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back */}
      <Link href="/facturation/devis" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Devis
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold">{quote.number}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {quote.client.company ?? quote.client.name}
            {quote.project && <> · <Link href={`/projets/${quote.project.id}`} className="hover:text-primary">{quote.project.name}</Link></>}
          </p>
          <p className="text-xs text-muted-foreground">
            Créé le {new Date(quote.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {quote.sentAt && ` · Envoyé le ${new Date(quote.sentAt).toLocaleDateString("fr-FR")}`}
            {quote.acceptedAt && ` · Accepté le ${new Date(quote.acceptedAt).toLocaleDateString("fr-FR")}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/pdf/devis/${id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>

          {quote.status === "DRAFT" && (
            <form action={async () => { "use server"; await updateQuoteStatus(id, userId, "SENT") }}>
              <Button type="submit" size="sm" variant="outline">
                <Send className="h-3.5 w-3.5" />
                Marquer envoyé
              </Button>
            </form>
          )}

          {quote.status === "SENT" && (
            <>
              <form action={async () => { "use server"; await updateQuoteStatus(id, userId, "ACCEPTED") }}>
                <Button type="submit" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accepté
                </Button>
              </form>
              <form action={async () => { "use server"; await updateQuoteStatus(id, userId, "REJECTED") }}>
                <Button type="submit" size="sm" variant="destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  Refusé
                </Button>
              </form>
            </>
          )}

          {quote.status === "ACCEPTED" && (
            <div className="flex gap-2">
              {quote.depositPercent > 0 && !quote.invoices.some((i) => i.type === "DEPOSIT") && (
                <form action={async () => {
                  "use server"
                  const inv = await createInvoiceFromQuote(id, userId, "DEPOSIT")
                  redirect(`/facturation/factures/${inv.id}`)
                }}>
                  <Button type="submit" size="sm" variant="outline">
                    <FileText className="h-3.5 w-3.5" />
                    Facture acompte ({quote.depositPercent}%)
                  </Button>
                </form>
              )}
              {!quote.invoices.some((i) => i.type === "FINAL") && (
                <form action={async () => {
                  "use server"
                  const inv = await createInvoiceFromQuote(id, userId, "FINAL")
                  redirect(`/facturation/factures/${inv.id}`)
                }}>
                  <Button type="submit" size="sm" variant="outline">
                    <FileText className="h-3.5 w-3.5" />
                    Facture solde
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lignes */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Prestations</h2>
          {quote.depositPercent > 0 && (
            <span className="text-xs text-muted-foreground">
              Acompte {quote.depositPercent}% · {depositAmount.toLocaleString("fr-FR")} €
            </span>
          )}
        </div>
        <LineItemsEditor
          entityId={id}
          entityType="quote"
          lines={quote.lines}
          editable={isEditable}
        />
      </div>

      {/* Infos factures liées */}
      {quote.invoices.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h2 className="font-semibold text-sm">Factures générées</h2>
          <div className="space-y-1.5">
            {quote.invoices.map((inv) => (
              <Link key={inv.id} href={`/facturation/factures/${inv.id}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                <span className="font-mono text-xs text-muted-foreground">{inv.number}</span>
                <span>{inv.type === "DEPOSIT" ? "Acompte" : inv.type === "FINAL" ? "Solde" : inv.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ml-auto ${
                  inv.status === "PAID" ? "bg-emerald-500/15 text-emerald-600" :
                  inv.status === "SENT" ? "bg-blue-500/15 text-blue-600" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {inv.status === "PAID" ? "Payée" : inv.status === "SENT" ? "Envoyée" : "Brouillon"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes + Acompte */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Paramètres</h2>
        <form
          action={async (fd: FormData) => {
            "use server"
            await updateQuoteNotes(id, userId, (fd.get("notes") as string) || null, Number(fd.get("depositPercent")))
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Acompte (%)</label>
            <input name="depositPercent" type="number" min="0" max="100" defaultValue={quote.depositPercent} className="flex h-8 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes / conditions</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={quote.notes ?? ""}
              placeholder="Conditions de paiement, délais de livraison..."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
        </form>
      </div>

      {/* Danger */}
      {isEditable && (
        <div className="flex justify-end">
          <form action={async () => { "use server"; await deleteQuote(id, userId); redirect("/facturation/devis") }}>
            <Button type="submit" variant="destructive" size="sm">Supprimer ce devis</Button>
          </form>
        </div>
      )}
    </div>
  )
}
