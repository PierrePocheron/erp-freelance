"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function exportAllData(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  const userId = session.user.id

  const [
    userProfile,
    emitterProfiles,
    tags,
    conditionsTemplates,
    companies,
    companyTeams,
    clients,
    interactions,
    reminders,
    clientFiles,
    products,
    projectsRaw,
    milestones,
    taskTags,
    tasksRaw,
    timeEntries,
    journalEntries,
    deliverables,
    usefulLinks,
    postDevs,
    renewals,
    quotesRaw,
    invoicesRaw,
    recurringInvoices,
    calendarEvents,
    projectIdeas,
    extra,
  ] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.emitterProfile.findMany({ where: { userId } }),
    prisma.tag.findMany({ where: { userId } }),
    prisma.conditionsTemplate.findMany({ where: { userId } }),
    prisma.company.findMany({ where: { userId } }),
    prisma.companyTeam.findMany({ where: { company: { userId } } }),
    prisma.client.findMany({ where: { userId } }),
    prisma.interaction.findMany({ where: { client: { userId } } }),
    prisma.reminder.findMany({ where: { client: { userId } } }),
    prisma.clientFile.findMany({ where: { client: { userId } } }),
    prisma.product.findMany({ where: { userId } }),
    prisma.project.findMany({
      where: { userId },
      include: { tags: { select: { id: true } } },
    }),
    prisma.milestone.findMany({ where: { project: { userId } } }),
    prisma.taskTag.findMany({ where: { project: { userId } } }),
    prisma.task.findMany({
      where: { OR: [{ project: { userId } }, { userId }] },
      include: { taskTags: { select: { id: true } } },
    }),
    prisma.timeEntry.findMany({ where: { userId } }),
    prisma.journalEntry.findMany({ where: { project: { userId } } }),
    prisma.deliverable.findMany({ where: { project: { userId } } }),
    prisma.usefulLink.findMany({ where: { project: { userId } } }),
    prisma.postDev.findMany({ where: { project: { userId } } }),
    prisma.renewal.findMany({ where: { postDev: { project: { userId } } } }),
    prisma.quote.findMany({ where: { userId }, include: { lines: true } }),
    prisma.invoice.findMany({ where: { userId }, include: { lines: true, payments: true } }),
    prisma.recurringInvoice.findMany({ where: { userId } }),
    prisma.calendarEvent.findMany({ where: { userId } }),
    prisma.projectIdea.findMany({ where: { userId } }),
    exportExtraModels(userId),
  ])

  // Aplatir les relations imbriquées pour un format plat + transportable
  const projects = projectsRaw.map(({ tags: t, ...p }) => ({
    ...p,
    tagIds: t.map((x) => x.id),
  }))

  const tasks = tasksRaw.map(({ taskTags: tt, ...t }) => ({
    ...t,
    taskTagIds: tt.map((x) => x.id),
  }))

  const quotes = quotesRaw.map(({ lines: _lines, ...q }) => q)
  const quoteLines = quotesRaw.flatMap((q) => q.lines)
  const invoices = invoicesRaw.map(({ lines: _lines, payments: _payments, ...i }) => i)
  const invoiceLines = invoicesRaw.flatMap((i) => i.lines)
  const payments = invoicesRaw.flatMap((i) => i.payments)

  // Statistiques de l'export
  const stats = {
    contacts: clients.filter((c) => c.type !== "PROSPECT").length,
    prospects: clients.filter((c) => c.type === "PROSPECT").length,
    projects: projects.length,
    tasks: tasks.length,
    quotes: quotes.length,
    invoices: invoices.length,
    interactions: interactions.length,
    timeEntries: timeEntries.length,
  }

  const exportPayload = {
    version: "0.2.0", // 0.2.0 : sauvegarde complète (revenus, dépenses, santé, entretiens, compétences…)
    exportedAt: new Date().toISOString(),
    stats,
    data: {
      userProfile,
      emitterProfiles,
      tags,
      conditionsTemplates,
      companies,
      companyTeams,
      clients,
      interactions,
      reminders,
      clientFiles,
      products,
      projects,
      milestones,
      taskTags,
      tasks,
      timeEntries,
      journalEntries,
      deliverables,
      usefulLinks,
      postDevs,
      renewals,
      quotes,
      quoteLines,
      invoices,
      invoiceLines,
      payments,
      recurringInvoices,
      calendarEvents,
      projectIdeas,
      ...extra,
    },
  }

  return JSON.stringify(exportPayload, null, 2)
}

// Modèles ajoutés en 0.2.0 (#7) — l'export ne couvrait que 25 modèles sur 67 alors que l'écran
// annonce « l'intégralité de tes données ». Clés = celles de src/lib/backup-models.ts.
async function exportExtraModels(userId: string) {
  const own = { userId }
  const [
    fiscalSources, companyCategories, calendarCategories, expenseCategories,
    emailTemplates, callTemplates, investmentPlatforms, skills,
    recurringInvoiceLines, projectContacts, projectEvents, prospectEvents, prospectNotes,
    emailLogs, emailDrafts, interviewAnswers, recurringRevenues, revenues,
    recurringExpenses, expenses, healthEvents, healthConsultations, healthReimbursements,
    jobApplications, jobApplicationEvents, urssafDeclarations, urssafDeclarationLines,
    projectSkills, jobApplicationSkills, interviewQuestions, questionSkills, investmentEntries,
  ] = await Promise.all([
    prisma.fiscalSource.findMany({ where: own }),
    prisma.companyCategory.findMany({ where: own }),
    prisma.calendarCategory.findMany({ where: own }),
    prisma.expenseCategory.findMany({ where: own }),
    prisma.emailTemplate.findMany({ where: own }),
    prisma.callTemplate.findMany({ where: own }),
    prisma.investmentPlatform.findMany({ where: own }),
    prisma.skill.findMany({ where: own }),
    prisma.recurringInvoiceLine.findMany({ where: { recurringInvoice: own } }),
    prisma.projectContact.findMany({ where: { project: own } }),
    prisma.projectEvent.findMany({ where: { project: own } }),
    prisma.prospectEvent.findMany({ where: { client: own } }),
    prisma.prospectNote.findMany({ where: { client: own } }),
    prisma.emailLog.findMany({ where: own }),
    prisma.emailDraft.findMany({ where: own }),
    prisma.interviewAnswer.findMany({ where: own }),
    prisma.recurringRevenue.findMany({ where: own }),
    prisma.revenue.findMany({ where: own }),
    prisma.recurringExpense.findMany({ where: own }),
    prisma.expense.findMany({ where: own }),
    prisma.healthEvent.findMany({ where: own }),
    prisma.healthConsultation.findMany({ where: own }),
    prisma.healthReimbursement.findMany({ where: own }),
    prisma.jobApplication.findMany({ where: own }),
    prisma.jobApplicationEvent.findMany({ where: own }),
    prisma.urssafDeclaration.findMany({ where: own }),
    prisma.urssafDeclarationLine.findMany({ where: { declaration: own } }),
    prisma.projectSkill.findMany({ where: { project: own } }),
    prisma.jobApplicationSkill.findMany({ where: { application: own } }),
    prisma.interviewQuestion.findMany({ where: own }),
    prisma.questionSkill.findMany({ where: { question: own } }),
    prisma.investmentEntry.findMany({ where: { platform: own } }),
  ])
  return {
    fiscalSources, companyCategories, calendarCategories, expenseCategories,
    emailTemplates, callTemplates, investmentPlatforms, skills,
    recurringInvoiceLines, projectContacts, projectEvents, prospectEvents, prospectNotes,
    emailLogs, emailDrafts, interviewAnswers, recurringRevenues, revenues,
    recurringExpenses, expenses, healthEvents, healthConsultations, healthReimbursements,
    jobApplications, jobApplicationEvents, urssafDeclarations, urssafDeclarationLines,
    projectSkills, jobApplicationSkills, interviewQuestions, questionSkills, investmentEntries,
  }
}
