import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Briefcase, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProjectSkillManager } from "@/components/modules/competences/ProjectSkillManager"
import { SkillWorkButton } from "@/components/modules/competences/SkillWorkButton"
import { SKILL_STATUS_META, SKILL_TYPE_META, levelLabel } from "@/components/modules/competences/skill-config"

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const skill = await prisma.skill.findFirst({
    where: { id, userId },
    include: {
      parent: { select: { id: true, name: true } },
      projects: { include: { project: { select: { id: true, name: true } } } },
      jobApplications: { include: { application: { select: { id: true, companyName: true, position: true } } } },
      questions: { include: { question: { select: { id: true, question: true, status: true } } } },
    },
  })
  if (!skill) notFound()

  const allProjects = await prisma.project.findMany({
    where: { userId }, orderBy: { name: "asc" }, select: { id: true, name: true },
  })

  const st = SKILL_STATUS_META[skill.status]
  const typeMeta = SKILL_TYPE_META[skill.type]
  const links = skill.projects.map((ps) => ({
    projectId: ps.projectId,
    projectName: ps.project.name,
    version: ps.version,
    role: ps.role as "USED" | "TO_ACQUIRE",
  }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/competences" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Compétences
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xl" aria-hidden>{typeMeta.icon}</span>
            <h1 className="text-2xl font-bold tracking-tight">{skill.name}</h1>
            {skill.targetVersion && (
              <span className="text-xs font-mono text-muted-foreground rounded border border-border px-1.5 py-0.5">v{skill.targetVersion}</span>
            )}
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span>
          </div>
          <SkillWorkButton skillId={skill.id} skillName={skill.name} />
        </div>
        {skill.parent && (
          <p className="text-sm text-muted-foreground mt-1">
            dans <Link href={`/competences/${skill.parent.id}`} className="hover:underline">{skill.parent.name}</Link>
          </p>
        )}
      </div>

      {/* Infos clés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Mon niveau" value={levelLabel(skill.level)} sub={`${skill.level}/5`} />
        <InfoCard label="Type" value={typeMeta.label} />
        <InfoCard label="Années d'XP" value={skill.yearsExperience != null ? `${skill.yearsExperience}` : "—"} />
        <InfoCard label="Projets" value={String(links.length)} />
      </div>

      {skill.notes && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Notes / ressources</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{skill.notes}</p>
        </div>
      )}

      <ProjectSkillManager skillId={skill.id} links={links} allProjects={allProjects} />

      {skill.jobApplications.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Entretiens qui la demandent</h2>
          <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
            {skill.jobApplications.map((js) => (
              <Link key={js.application.id} href={`/entretiens/${js.application.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                <span className="font-medium truncate">{js.application.companyName}</span>
                {js.application.position && <span className="text-xs text-muted-foreground truncate">· {js.application.position}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {skill.questions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Questions associées</h2>
          <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
            {skill.questions.map((qs) => (
              <Link key={qs.question.id} href="/competences/questions" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", qs.question.status === "REVIEWED" ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
                <span className="truncate">{qs.question.question}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}{sub && <span className="text-xs font-normal text-muted-foreground"> · {sub}</span>}</p>
    </div>
  )
}
