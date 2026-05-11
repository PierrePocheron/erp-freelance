import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, Download, CheckCircle2, XCircle, FileText,
  Send, ChevronRight, Clock, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LineItemsEditor } from "@/components/modules/facturation/LineItemsEditor"
import {
  updateQuoteStatus,
  deleteQuote,
  createInvoiceFromQuote,
  updateQuoteSettings,
} from "@/actions/facturation"
import { redirect } from "next/navigation"
import { Input } from "@/components/ui/input"

// ── Statuts ───────────────────────────────────────────────────────────────────

const PIPELINE = [
  { status: "DRAFT", label: "Brouillon" },
  { status: "VALIDATED", label: "Validé" },
  { status: "SENT", label: "Envoyé" },
  { status: "ACCEPTED", label: "Accepté" },
] as const

const STATUS_INDEX: Record<string, number> = {
  DRAFT: 0,
  VALIDATED: 1,
  SENT: 2,
  ACCEPTED: 3,
  REJECTED: -1,
}

const statusBadge: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  VALIDATED: "bg-violet-500/15 text-violet-600 border-violet-500/20",
  SENT: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  ACCEPTED: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  REJECTED: "bg-red-500/15 text-red-600 border-red-500/20",
}

const statusLabel: Record<string, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validé",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

  const currentIdx = STATUS_INDEX[quote.status] ?? 0
  const isEditable = quote.status === "DRAFT"
  const isRejected = quote.status === "REJECTED"
  const depositAmount = quote.totalHT * (quote.depositPercent / 100)

  // Compute TTC server-side for display
  const linesWithTax = quote.lines
  const totalHT = linesWithTax.reduce((s, l) => s + l.total, 0)
  const totalTVA = linesWithTax.reduce((s, l) => s + l.total * (l.taxRate / 100), 0)
  const totalTTC = totalHT + totalTVA

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/facturation/devis" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Devis
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-lg font-bold">{quote.number}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge[quote.status] ?? ""}`}>
              {statusLabel[quote.status] ?? quote.status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {quote.client.company ?? quote.client.name}
            {quote.project && (
              <> · <Link href={`/projets/${quote.project.id}`} className="hover:text-primary">{quote.project.name}</Link></>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Créé le {new Date(quote.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {quote.validatedAt && ` · Validé le ${new Date(quote.validatedAt).toLocaleDateString("fr-FR")}`}
            {quote.sentAt && ` · Envoyé le ${new Date(quote.sentAt).toLocaleDateString("fr-FR")}`}
            {quote.acceptedAt && ` · Accepté le ${new Date(quote.acceptedAt).toLocaleDateString("fr-FR")}`}
          </p>
        </div>

        {/* Download PDF */}
        <a
          href={`/api/pdf/devis/${id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Imprimer PDF
        </a>
      </div>

      {/* Pipeline de statuts */}
      {!isRejected ? (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-1 flex-wrap">
            {PIPELINE.map((step, i) => {
              const isPast = currentIdx > i
              const isCurrent = currentIdx === i
              return (
                <div key={step.status} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isPast
                      ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"
                      : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isPast && <Check className="h-3 w-3" />}
                    {isCurrent && !isPast && <Clock className="h-3 w-3" />}
                    {step.label}
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions selon le statut */}
          <div className="mt-4 flex flex-wrap gap-2">
            {quote.status === "DRAFT" && (
              <form action={async () => {
                "use server"
                await updateQuoteStatus(id, userId, "VALIDATED")
              }}>
                <Button type="submit" size="sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valider le devis
                </Button>
              </form>
            )}

            {quote.status === "VALIDATED" && (
              <form action={async () => {
                "use server"
                await updateQuoteStatus(id, userId, "SENT")
              }}>
                <Button type="submit" size="sm">
                  <Send className="h-3.5 w-3.5" />
                  Marquer comme envoyé
                </Button>
              </form>
            )}

            {quote.status === "SENT" && (
              <>
                <form action={async () => {
                  "use server"
                  await updateQuoteStatus(id, userId, "ACCEPTED")
                }}>
                  <Button type="submit" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Accepté par le client
                  </Button>
                </form>
                <form action={async () => {
                  "use server"
                  await updateQuoteStatus(id, userId, "REJECTED")
                }}>
                  <Button type="submit" size="sm" variant="destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    Refusé
                  </Button>
                </form>
              </>
            )}

            {quote.status === "ACCEPTED" && (
              <div className="flex flex-wrap gap-2">
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
      ) : (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-600">Devis refusé</p>
            <p className="text-xs text-muted-foreground">Ce devis a été refusé par le client.</p>
          </div>
        </div>
      )}

      {/* Lignes de prestation */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Prestations</h2>
          {quote.depositPercent > 0 && (
            <span className="text-xs text-muted-foreground">
              Acompte {quote.depositPercent}% · {depositAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
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

      {/* Résumé financier (si TVA) */}
      {totalTVA > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <h2 className="font-semibold text-sm mb-3">Récapitulatif</h2>
          <div className="space-y-1.5 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span>{totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total TVA</span>
              <span>{totalTVA.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between font-bold border-t border-border pt-1.5">
              <span>Total TTC</span>
              <span className="text-primary text-base">{totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          </div>
        </div>
      )}

      {/* Factures générées */}
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

      {/* Paramètres */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Paramètres</h2>
        <form
          action={async (fd: FormData) => {
            "use server"
            await updateQuoteSettings(id, userId, {
              depositPercent: Number(fd.get("depositPercent")) || 0,
              expiresAt: (fd.get("expiresAt") as string) || null,
              notes: (fd.get("notes") as string) || null,
            })
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Acompte (%)</label>
              <Input name="depositPercent" type="number" min="0" max="100" defaultValue={quote.depositPercent} className="h-8 w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date d'expiration</label>
              <Input
                name="expiresAt"
                type="date"
                defaultValue={quote.expiresAt ? new Date(quote.expiresAt).toISOString().split("T")[0] : ""}
                className="h-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes internes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={quote.notes ?? ""}
              placeholder="Notes visibles uniquement par vous"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
        </form>
      </div>

      {/* Conditions générales */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Conditions générales</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Apparaissent en bas du document PDF</p>
        </div>
        <form
          action={async (fd: FormData) => {
            "use server"
            await updateQuoteSettings(id, userId, {
              generalConditions: (fd.get("generalConditions") as string) || null,
            })
          }}
          className="space-y-3"
        >
          <textarea
            name="generalConditions"
            rows={5}
            defaultValue={quote.generalConditions ?? ""}
            placeholder="Ex : Paiement à 30 jours. En cas de retard, une pénalité de 1,5% par mois sera appliquée. Tout litige relève de la compétence du tribunal de commerce de Paris..."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <Button type="submit" size="sm" variant="outline">Enregistrer les conditions</Button>
        </form>
      </div>

      {/* Danger */}
      {isEditable && (
        <div className="flex justify-end">
          <form action={async () => {
            "use server"
            await deleteQuote(id, userId)
            redirect("/facturation/devis")
          }}>
            <Button type="submit" variant="destructive" size="sm">Supprimer ce devis</Button>
          </form>
        </div>
      )}
    </div>
  )
}
