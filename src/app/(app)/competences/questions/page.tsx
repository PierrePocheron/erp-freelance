import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { QuestionsView } from "@/components/modules/competences/QuestionsView"

/** Hub des questions techniques (d'entretien / de culture) à retenir et revoir. */
export default async function QuestionsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [questions, applications, allSkills] = await Promise.all([
    prisma.interviewQuestion.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, question: true, answer: true, difficulty: true, status: true,
        application: { select: { id: true, companyName: true } },
        skills: { select: { skill: { select: { id: true, name: true } } } },
      },
    }),
    prisma.jobApplication.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, companyName: true, position: true } }),
    prisma.skill.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/competences" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Compétences
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Questions techniques</h1>
        <p className="text-sm text-muted-foreground">Les questions d&apos;entretien et de culture à retenir, classées par compétence.</p>
      </div>
      <QuestionsView
        questions={questions}
        applications={applications.map((a) => ({ id: a.id, label: `${a.companyName}${a.position ? ` — ${a.position}` : ""}` }))}
        skillSuggestions={allSkills.map((s) => s.name)}
      />
    </div>
  )
}
