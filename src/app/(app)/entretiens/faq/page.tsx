import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { Metadata } from "next"
import { getInterviewAnswers } from "@/actions/entretien"
import { InterviewFaqView } from "@/components/modules/entretien/InterviewFaqView"

export const metadata: Metadata = { title: "FAQ & réponses-types — ERP Freelance" }

export default async function InterviewFaqPage() {
  const answers = await getInterviewAnswers()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/entretiens"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Entretiens
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">FAQ &amp; réponses-types</h1>
        <p className="text-sm text-muted-foreground">
          {answers.length} réponse{answers.length !== 1 ? "s" : ""} préparée{answers.length !== 1 ? "s" : ""} · vos questions fréquentes d&apos;entretien, cherchables par mot-clé
        </p>
      </div>

      <InterviewFaqView answers={answers} />
    </div>
  )
}
