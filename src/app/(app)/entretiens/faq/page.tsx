import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getInterviewAnswers } from "@/actions/entretien"
import { InterviewFaqView } from "@/components/modules/entretien/InterviewFaqView"

export const metadata: Metadata = { title: "Réponses & modèles — ERP Freelance" }

export default async function InterviewFaqPage() {
  const session = await auth()
  const userId = session!.user.id
  const [answers, applications] = await Promise.all([
    getInterviewAnswers(),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, companyName: true, position: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/entretiens"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Entretiens
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Réponses &amp; modèles</h1>
        <p className="text-sm text-muted-foreground">
          {answers.length} fiche{answers.length !== 1 ? "s" : ""} · réponses-types, FAQ et lettres de motivation d&apos;entretien, cherchables par mot-clé
        </p>
      </div>

      <InterviewFaqView answers={answers} applications={applications} />
    </div>
  )
}
