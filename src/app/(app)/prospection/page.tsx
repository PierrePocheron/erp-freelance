import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ProspectionTable } from "@/components/modules/prospection/ProspectionTable"
import { ProspectionStats } from "@/components/modules/prospection/ProspectionStats"
import { ProspectQuickAdd } from "@/components/modules/prospection/ProspectQuickAdd"
import { ImportCsvDialog } from "@/components/modules/prospection/ImportCsvDialog"
import { prospectionFromAddress } from "@/lib/prospection-email"
import { StartSessionDialog } from "@/components/modules/prospection/StartSessionDialog"
import { Mail, NotebookPen, Phone } from "lucide-react"

export default async function ProspectionPage() {
  const session = await auth()
  const userId = session!.user.id

  const [prospects, templates, pendingDrafts] = await Promise.all([
    prisma.client.findMany({
      // Inclut les gagnés convertis en CLIENT (prospectStatus WON) : ils
      // restent visibles dans le pipeline comme trophées + réversibles.
      where: {
        userId,
        OR: [
          { type: "PROSPECT" },
          { type: "CLIENT", prospectStatus: "WON" },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { interactions: true } },
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true, channel: true } },
      },
    }),
    prisma.emailTemplate.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, subject: true, body: true },
    }),
    // Badge de la file de brouillons : à relire (DRAFT) + relus non envoyés (READY)
    prisma.emailDraft.count({ where: { userId, status: { in: ["DRAFT", "READY"] } } }),
  ])

  const active       = prospects.filter((p) => !["WON", "LOST"].includes(p.prospectStatus))
  const toContact    = prospects.filter((p) => p.prospectStatus === "TO_CONTACT")
  const contacted    = prospects.filter((p) => p.prospectStatus === "CONTACTED")
  const replied      = prospects.filter((p) => p.prospectStatus === "REPLIED")
  const inDiscussion = prospects.filter((p) => p.prospectStatus === "IN_DISCUSSION")
  const won          = prospects.filter((p) => p.prospectStatus === "WON")
  const lost         = prospects.filter((p) => p.prospectStatus === "LOST")
  const withEmail    = prospects.filter((p) => p.email?.trim())
  const withPhone    = prospects.filter((p) => p.phone?.trim())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Prospection</h1>
          <p className="text-sm text-muted-foreground">
            {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} · démarchage, suivi et relances
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StartSessionDialog />
          <Link
            href="/prospection/brouillons"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Brouillons
            {pendingDrafts > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums">
                {pendingDrafts}
              </span>
            )}
          </Link>
          <Link
            href="/prospection/modeles"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Modèles de mails
          </Link>
          <Link
            href="/prospection/appels"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />
            Modèles d&apos;appel
          </Link>
          <ImportCsvDialog />
        </div>
      </div>

      {/* Stats — les cartes de statut filtrent le tableau instantanément
          (shallow routing via ?statut=, aucun rechargement). 9 cartes sur une
          ligne en desktop (lg), 4 en tablette, 2 en mobile. */}
      <ProspectionStats
        counts={{
          active: active.length,
          toContact: toContact.length,
          contacted: contacted.length,
          replied: replied.length,
          inDiscussion: inDiscussion.length,
          won: won.length,
          lost: lost.length,
          withEmail: withEmail.length,
          withPhone: withPhone.length,
        }}
      />

      <ProspectQuickAdd />

      <ProspectionTable
        prospects={prospects}
        userId={userId}
        templates={templates}
        emailFromConfigured={prospectionFromAddress() !== null}
      />
    </div>
  )
}

