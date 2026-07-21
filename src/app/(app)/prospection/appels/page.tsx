import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getCallTemplates } from "@/actions/prospection"
import { CallTemplatesView } from "@/components/modules/prospection/CallTemplatesView"

export default async function CallTemplatesPage() {
  const templates = await getCallTemplates()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/prospection"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Prospection
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Modèles d&apos;appel</h1>
        <p className="text-sm text-muted-foreground">
          {templates.length} script{templates.length !== 1 ? "s" : ""} · déroulés de démarchage téléphonique
        </p>
      </div>

      <CallTemplatesView templates={templates} />
    </div>
  )
}
