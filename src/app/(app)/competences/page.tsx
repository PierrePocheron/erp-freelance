import Link from "next/link"
import { HelpCircle } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SkillsView } from "@/components/modules/competences/SkillsView"

/**
 * Connaissances & compétences : arbre des compétences (techniques / soft),
 * reliées aux projets, entretiens et questions techniques.
 */
export default async function CompetencesPage() {
  const session = await auth()
  const userId = session!.user.id

  const skills = await prisma.skill.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, type: true, level: true, targetVersion: true,
      status: true, yearsExperience: true, notes: true, parentId: true,
      _count: { select: { projects: true, questions: true, jobApplications: true, children: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connaissances &amp; compétences</h1>
          <p className="text-sm text-muted-foreground">
            Vos compétences techniques et soft skills, reliées à vos projets et entretiens — organisées en arbre par catégorie.
          </p>
        </div>
        <Link href="/competences/questions"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-input px-3 h-9 text-sm hover:bg-muted transition-colors">
          <HelpCircle className="h-4 w-4" /> Questions techniques
        </Link>
      </div>
      <SkillsView skills={skills} />
    </div>
  )
}
