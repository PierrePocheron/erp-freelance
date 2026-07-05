import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Download, Send, CheckCircle2, FileCheck2, Ban, Copy, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LineItemsEditor } from "@/components/modules/facturation/LineItemsEditor"
import { DeleteConfirmButton } from "@/components/modules/facturation/DeleteConfirmButton"
import { InvoicePaymentSection } from "@/components/modules/facturation/InvoicePaymentSection"
import { InvoiceConditionsForm } from "@/components/modules/facturation/InvoiceConditionsForm"
import { EmitterSelect } from "@/components/modules/facturation/EmitterSelect"
import { updateInvoiceStatus, deleteInvoice, updateInvoiceDueDate, updateInvoiceNotes, updateInvoiceEmitter, sendInvoiceEmail, sendInvoiceReminder, issueInvoice, cancelInvoice, duplicateInvoiceAsDraft } from "@/actions/facturation"
import { setInvoiceUrssafExcluded } from "@/actions/urssaf"
import { periodLabel } from "@/lib/urssaf"
import { redirect } from "next/navigation"
import { Input } from "@/components/ui/input"

const statusConfig = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  ISSUED: { label: "Émise", cls: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  SENT: { label: "Envoyée", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  PAID: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  LATE: { label: "En retard", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
  CANCELLED: { label: "Annulée", cls: "bg-muted text-muted-foreground border-border line-through" },
}

const typeLabels: Record<string, string> = {
  DEPOSIT: "Acompte",
  FINAL: "Solde",
  RECURRING: "Récurrent",
  STANDALONE: "Standard",
}

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
      quote: { select: { id: true, number: true } },
      lines: { orderBy: { id: "asc" } },
      emailLogs: { orderBy: { sentAt: "desc" }, take: 3 },
      payments: { orderBy: { paidAt: "asc" } },
      urssafLine: { include: { declaration: { select: { period: true, status: true } } } },
    },
  })

  if (!invoice) notFound()

  const [conditionsTemplates, emitters] = await Promise.all([
    prisma.conditionsTemplate.findMany({
      where: { userId },
      select: { id: true, name: true, content: true },
      orderBy: { name: "asc" },
    }),
    prisma.emitterProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, companyName: true },
    }),
  ])

  const status = statusConfig[invoice.status as keyof typeof statusConfig]
  const isEditable = invoice.status === "DRAFT"
  const netAmount = invoice.totalHT - invoice.depositDeducted

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/facturation/factures" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Factures
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-lg font-bold">{invoice.number}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">{typeLabels[invoice.type] ?? invoice.type}</span>
            {invoice.urssafLine && (
              <span className="text-xs text-violet-600 dark:text-violet-400 border border-violet-500/30 bg-violet-500/10 rounded-full px-2 py-0.5">
                Déclarée {periodLabel(invoice.urssafLine.declaration.period).split(" · ")[0]}
              </span>
            )}
            {invoice.urssafExcluded && (
              <span className="text-xs text-muted-foreground border border-border bg-muted rounded-full px-2 py-0.5">
                Hors URSSAF
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {invoice.client.company ?? invoice.client.name}
            {invoice.project && <> · <Link href={`/projets/${invoice.project.id}`} className="hover:text-primary">{invoice.project.name}</Link></>}
            {invoice.quote && <> · Devis <Link href={`/facturation/devis/${invoice.quote.id}`} className="hover:text-primary font-mono">{invoice.quote.number}</Link></>}
          </p>
          <p className="text-xs text-muted-foreground">
            Créée le {new Date(invoice.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à {new Date(invoice.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            {invoice.sentAt && ` · Envoyée le ${new Date(invoice.sentAt).toLocaleDateString("fr-FR")}`}
            {invoice.paidAt && ` · Payée le ${new Date(invoice.paidAt).toLocaleDateString("fr-FR")}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/pdf/facture/${id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>

          {invoice.status === "DRAFT" && (
            <form action={async () => { "use server"; await issueInvoice(id, userId) }}>
              <Button type="submit" size="sm">
                <FileCheck2 className="h-3.5 w-3.5" />
                Émettre la facture
              </Button>
            </form>
          )}

          {invoice.status === "ISSUED" && (
            <form action={async () => { "use server"; await updateInvoiceStatus(id, userId, "SENT") }}>
              <Button type="submit" size="sm" variant="outline">
                <Send className="h-3.5 w-3.5" />
                Marquer envoyée
              </Button>
            </form>
          )}

          {invoice.status === "ISSUED" && invoice.client.email && (
            <form action={async () => { "use server"; await sendInvoiceEmail(id, userId) }}>
              <Button type="submit" size="sm">
                <Send className="h-3.5 w-3.5" />
                Envoyer par email
              </Button>
            </form>
          )}

          {(invoice.status === "SENT" || invoice.status === "LATE") && invoice.client.email && (
            <form action={async () => { "use server"; await sendInvoiceReminder(id, userId) }}>
              <Button type="submit" size="sm" variant="outline">
                <Send className="h-3.5 w-3.5" />
                {invoice.status === "LATE" ? "Relancer" : "Rappel email"}
              </Button>
            </form>
          )}

          {(invoice.status === "SENT" || invoice.status === "LATE") && (
            <form action={async () => { "use server"; await updateInvoiceStatus(id, userId, "PAID") }}>
              <Button type="submit" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marquer payée
              </Button>
            </form>
          )}

          {(invoice.status === "ISSUED" || invoice.status === "SENT" || invoice.status === "LATE") && (
            <form action={async () => { "use server"; await cancelInvoice(id, userId) }}>
              <Button type="submit" size="sm" variant="outline" className="text-destructive hover:text-destructive">
                <Ban className="h-3.5 w-3.5" />
                Annuler
              </Button>
            </form>
          )}

          {invoice.status === "CANCELLED" && (
            <form action={async () => { "use server"; const d = await duplicateInvoiceAsDraft(id, userId); redirect(`/facturation/factures/${d.id}`) }}>
              <Button type="submit" size="sm" variant="outline">
                <Copy className="h-3.5 w-3.5" />
                Dupliquer en brouillon
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Montant */}
      {invoice.depositDeducted > 0 && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total HT</span>
            <span>{invoice.totalHT.toLocaleString("fr-FR")} €</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Acompte déduit</span>
            <span>- {invoice.depositDeducted.toLocaleString("fr-FR")} €</span>
          </div>
          <div className="flex justify-between font-bold border-t border-border pt-1">
            <span>Net à payer</span>
            <span>{netAmount.toLocaleString("fr-FR")} €</span>
          </div>
        </div>
      )}

      {/* Lignes */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Prestations</h2>
        </div>
        <LineItemsEditor
          entityId={id}
          entityType="invoice"
          lines={invoice.lines}
          editable={isEditable}
        />
      </div>

      {/* Récapitulatif TVA */}
      {(() => {
        const totalTVA = invoice.lines.reduce((s, l) => s + l.total * (l.taxRate / 100), 0)
        const totalTTC = invoice.totalHT + totalTVA
        if (totalTVA <= 0) return null
        return (
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h2 className="font-semibold text-sm mb-3">Récapitulatif</h2>
            <div className="space-y-1.5 text-sm max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT</span>
                <span>{invoice.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total TVA</span>
                <span>{totalTVA.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
              {invoice.depositDeducted > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Acompte déduit</span>
                  <span>- {invoice.depositDeducted.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-1.5">
                <span>Total TTC</span>
                <span className="text-primary text-base">{(totalTTC - invoice.depositDeducted).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Société émettrice */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Société émettrice</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identité affichée sur le PDF. {isEditable ? "Modifiable tant que la facture est en brouillon." : "Figée — annulez la facture pour la changer."}
          </p>
        </div>
        <EmitterSelect
          emitters={emitters}
          currentId={invoice.emitterProfileId}
          editable={isEditable}
          action={async (emitterProfileId: string | null) => {
            "use server"
            await updateInvoiceEmitter(id, emitterProfileId)
          }}
        />
      </div>

      {/* Paramètres */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Paramètres</h2>
        {isEditable ? (
          <form
            action={async (fd: FormData) => {
              "use server"
              await updateInvoiceDueDate(id, userId, (fd.get("dueDate") as string) || null)
              await updateInvoiceNotes(id, userId, (fd.get("notes") as string) || null)
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{"Date d'échéance"}</label>
              <Input
                name="dueDate"
                type="date"
                defaultValue={invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : ""}
                className="h-8 w-48"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Notes / mentions légales</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={invoice.notes ?? ""}
                placeholder="Conditions de paiement, RIB..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
          </form>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">Échéance :</span>
              <span>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—"}</span>
            </div>
            {invoice.notes && <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>}
            <p className="text-xs text-muted-foreground italic">Facture figée — annulez-la pour la corriger.</p>
          </div>
        )}
      </div>

      {/* Conditions générales */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Conditions générales</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Apparaissent en bas du PDF (reconduction, nom de domaine…)</p>
        </div>
        {isEditable ? (
          <InvoiceConditionsForm
            invoiceId={id}
            userId={userId}
            defaultValue={invoice.generalConditions ?? ""}
            templates={conditionsTemplates}
          />
        ) : invoice.generalConditions ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.generalConditions}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucune condition renseignée.</p>
        )}
      </div>

      {/* Fiscalité URSSAF */}
      {invoice.status !== "CANCELLED" && (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Fiscalité URSSAF</h2>
          </div>
          {invoice.urssafLine ? (
            <p className="text-sm text-muted-foreground">
              Déclarée dans la période{" "}
              <Link href="/impots" className="text-primary hover:underline font-medium">
                {periodLabel(invoice.urssafLine.declaration.period)}
              </Link>
              {invoice.urssafLine.declaration.status === "PAID" && " — cotisations payées ✓"}
            </p>
          ) : invoice.urssafExcluded ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Exclue des déclarations URSSAF (hors auto-entreprise) — terminée dès le paiement reçu.
              </p>
              <form action={async () => { "use server"; await setInvoiceUrssafExcluded(id, false) }}>
                <Button type="submit" size="sm" variant="outline">Réintégrer à l&apos;URSSAF</Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {invoice.status === "PAID"
                  ? "Payée — sera proposée dans la prochaine déclaration URSSAF."
                  : "Sera à déclarer à l'URSSAF une fois payée, selon la date d'encaissement."}
              </p>
              <form action={async () => { "use server"; await setInvoiceUrssafExcluded(id, true) }}>
                <Button type="submit" size="sm" variant="outline">Exclure de l&apos;URSSAF</Button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Paiements */}
      <InvoicePaymentSection
        invoiceId={id}
        userId={userId}
        netAmount={netAmount}
        payments={invoice.payments}
        isPaid={invoice.status === "PAID"}
      />

      {/* Logs email */}
      {invoice.emailLogs.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h2 className="font-semibold text-sm">Emails envoyés</h2>
          <div className="space-y-1.5">
            {invoice.emailLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="text-xs">{new Date(log.sentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span>→ {log.to}</span>
                <span className="text-xs">{log.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger */}
      {isEditable && (
        <div className="flex justify-end">
          <DeleteConfirmButton
            label="Supprimer cette facture"
            confirmTitle="Supprimer la facture ?"
            confirmMessage={`La facture ${invoice.number} sera supprimée définitivement. Cette action est irréversible.`}
            action={async () => {
              "use server"
              await deleteInvoice(id, userId)
              redirect("/facturation/factures")
            }}
          />
        </div>
      )}
    </div>
  )
}
