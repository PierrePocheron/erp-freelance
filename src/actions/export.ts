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
  ] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.emitterProfile.findMany({ where: { userId } }),
    prisma.tag.findMany({ where: { userId } }),
    prisma.conditionsTemplate.findMany({ where: { userId } }),
    prisma.company.findMany({ where: { userId } }),
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
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    stats,
    data: {
      userProfile,
      emitterProfiles,
      tags,
      conditionsTemplates,
      companies,
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
    },
  }

  return JSON.stringify(exportPayload, null, 2)
}
