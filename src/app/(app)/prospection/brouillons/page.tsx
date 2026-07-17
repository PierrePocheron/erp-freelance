import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { prospectionFromAddress } from "@/lib/prospection-email"
import { EmailDraftsView } from "@/components/modules/prospection/EmailDraftsView"

/**
 * File de brouillons : relecture/édition un par un, marquage « relu »
 * explicite, envoi uniquement des relus après confirmation récapitulative.
 * Les CANCELLED sont masqués ; les SENT des 7 derniers jours restent visibles
 * dans une section repliée (vérifier ce qui vient de partir).
 */
export default async function EmailDraftsPage() {
  const session = await auth()
  const userId = session!.user.id

  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const drafts = await prisma.emailDraft.findMany({
    where: {
      userId,
      OR: [
        { status: { in: ["DRAFT", "READY"] } },
        { status: "SENT", sentAt: { gte: sevenDaysAgo } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true, company: true, email: true } },
      template: { select: { name: true } },
    },
  })

  const pending = drafts.filter((d) => d.status !== "SENT").length

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/prospection"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Prospection
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Brouillons d&apos;emails</h1>
        <p className="text-sm text-muted-foreground">
          {pending} brouillon{pending !== 1 ? "s" : ""} en file · relecture puis envoi 100 % contrôlés — rien ne part sans votre confirmation
        </p>
      </div>

      <EmailDraftsView drafts={drafts} emailFromConfigured={prospectionFromAddress() !== null} />
    </div>
  )
}
