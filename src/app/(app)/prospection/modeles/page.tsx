import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getOrCreateDefaultEmailTemplates } from "@/actions/prospection"
import { EmailTemplatesView } from "@/components/modules/prospection/EmailTemplatesView"

export default async function EmailTemplatesPage() {
  // Provisionne 3 modèles de départ au premier passage
  const templates = await getOrCreateDefaultEmailTemplates()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/prospection"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Prospection
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Modèles de mails</h1>
        <p className="text-sm text-muted-foreground">
          {templates.length} modèle{templates.length !== 1 ? "s" : ""} · variables personnalisées par prospect
        </p>
      </div>

      <EmailTemplatesView templates={templates} />
    </div>
  )
}
