import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ApplicationDetailView } from "@/components/modules/entretien/ApplicationDetailView"
import { EntretienSkillsManager } from "@/components/modules/competences/EntretienSkillsManager"
import { EntretienQuestionsManager } from "@/components/modules/competences/EntretienQuestionsManager"
import { SetBreadcrumbLabel } from "@/components/layout/BreadcrumbContext"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return { title: "Candidature — ERP Freelance" }
  const app = await prisma.jobApplication.findFirst({
    where: { id, userId: session.user.id },
    select: { position: true, companyName: true },
  })
  if (!app) return { title: "Candidature introuvable" }
  return { title: `${app.position} @ ${app.companyName} — ERP Freelance` }
}

export default async function EntretienDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const [app, contacts, companies, allSkills] = await Promise.all([
    prisma.jobApplication.findFirst({
      where: { id, userId },
      include: {
        contact: {
          select: {
            id: true, name: true, email: true, phone: true,
            company: true, linkedinUrl: true, notes: true,
          },
        },
        company: { select: { id: true, name: true, city: true, website: true } },
        events: {
          orderBy: { date: "asc" },
          include: { contact: { select: { id: true, name: true, linkedinUrl: true } } },
        },
        usedAnswers: {
          select: { id: true, question: true, answer: true, category: true },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        },
        requiredSkills: { include: { skill: { select: { id: true, name: true } } } },
        questions: {
          orderBy: { createdAt: "desc" },
          select: { id: true, question: true, answer: true, difficulty: true, status: true, skills: { select: { skill: { select: { id: true, name: true } } } } },
        },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      select: { id: true, name: true, email: true, phone: true, company: true, companyId: true, linkedinUrl: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.company.findMany({
      where: { userId, OR: [
        { companyType: { in: ["ESN", "RECRUTEMENT", "CLIENT"] } },
        { companyType: null },
      ]},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.skill.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])

  if (!app) notFound()

  return (
    <>
      <SetBreadcrumbLabel value={id} label={app.companyName} />
      <ApplicationDetailView app={app} contacts={contacts} companies={companies} />
      <div className="mt-6 space-y-4 rounded-xl border border-border/50 bg-card p-4">
        <EntretienSkillsManager
          applicationId={app.id}
          linkedSkills={app.requiredSkills.map((rs) => rs.skill)}
          allSkills={allSkills}
        />
        <div className="border-t border-border/40" />
        <EntretienQuestionsManager
          applicationId={app.id}
          applicationLabel={`${app.companyName}${app.position ? ` — ${app.position}` : ""}`}
          questions={app.questions}
          skillSuggestions={allSkills.map((s) => s.name)}
        />
      </div>
    </>
  )
}
