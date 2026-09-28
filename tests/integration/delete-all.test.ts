import { describe, it, expect, vi } from "vitest"
import { deleteAllUserData } from "@/actions/settings"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeCompany, makeProject, makeInvoice, makeQuote, makeFiscalSource } from "./helpers/factories"

// « Supprimer toutes mes données » : le test le plus rentable du dépôt par ligne
// écrite. Il attrape deux fautes d'un coup — un modèle oublié (les données
// survivent au « tout supprimer ») et un `deleteMany` mal scopé (les données du
// voisin partent avec).

// L'action termine par redirect() : Next lève NEXT_REDIRECT, ce n'est pas une erreur.
function isRedirect(e: unknown) {
  return e instanceof Error && e.message.includes("NEXT_REDIRECT")
}

async function seedEverything(userId: string) {
  const client = await makeClient(userId, { name: "Client" })
  const company = await makeCompany(userId)
  const project = await makeProject(userId, client.id, "Projet")
  const source = await makeFiscalSource(userId)
  const invoice = await makeInvoice(userId, client.id, { status: "SENT", totalHT: 100, lines: [{ description: "L", quantity: 1, unitPrice: 100, taxRate: 0 }] })
  await makeQuote(userId, client.id, { lines: [{ description: "L", quantity: 1, unitPrice: 50, taxRate: 0 }] })
  await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 100, paidAt: new Date() } })
  await prisma.task.create({ data: { userId, projectId: project.id, title: "Tâche" } })
  await prisma.milestone.create({ data: { projectId: project.id, name: "Jalon", date: new Date() } })
  await prisma.interaction.create({ data: { clientId: client.id, date: new Date(), channel: "EMAIL", summary: "Échange" } })
  await prisma.expense.create({ data: { userId, label: "Dépense", amount: 10, date: new Date() } })
  await prisma.expenseCategory.create({ data: { userId, name: `cat-${userId}` } })
  await prisma.revenue.create({ data: { userId, type: "OTHER", label: "Revenu", amount: 20, status: "RECEIVED", fiscalSourceId: source.id } })
  await prisma.healthEvent.create({ data: { userId, type: "OTHER", date: new Date(), title: "Ostéo" } })
  await prisma.jobApplication.create({ data: { userId, companyName: "Algo", position: "Dev" } })
  await prisma.skill.create({ data: { userId, name: `Go-${userId}` } })
  await prisma.investmentPlatform.create({ data: { userId, name: `Plateforme-${userId}`, type: "CROWDLENDING" } })
  await prisma.emailTemplate.create({ data: { userId, name: `modele-${userId}`, subject: "S", body: "B" } })
  await prisma.pushSubscription.create({ data: { userId, endpoint: `https://push.test/${userId}`, p256dh: "k", auth: "a" } })
  await prisma.companyTeam.create({ data: { companyId: company.id, name: "Direction" } })
  await prisma.projectEvent.create({ data: { projectId: project.id, kind: "NOTE", date: new Date(), title: "Note" } })
  return { client, project }
}

async function snapshot(userId: string) {
  return {
    clients: await prisma.client.count({ where: { userId } }),
    companies: await prisma.company.count({ where: { userId } }),
    companyTeams: await prisma.companyTeam.count({ where: { company: { userId } } }),
    projects: await prisma.project.count({ where: { userId } }),
    projectEvents: await prisma.projectEvent.count({ where: { project: { userId } } }),
    invoices: await prisma.invoice.count({ where: { userId } }),
    quotes: await prisma.quote.count({ where: { userId } }),
    payments: await prisma.payment.count({ where: { invoice: { userId } } }),
    tasks: await prisma.task.count({ where: { OR: [{ userId }, { project: { userId } }] } }),
    milestones: await prisma.milestone.count({ where: { project: { userId } } }),
    interactions: await prisma.interaction.count({ where: { client: { userId } } }),
    expenses: await prisma.expense.count({ where: { userId } }),
    expenseCategories: await prisma.expenseCategory.count({ where: { userId } }),
    revenues: await prisma.revenue.count({ where: { userId } }),
    fiscalSources: await prisma.fiscalSource.count({ where: { userId } }),
    healthEvents: await prisma.healthEvent.count({ where: { userId } }),
    jobApplications: await prisma.jobApplication.count({ where: { userId } }),
    skills: await prisma.skill.count({ where: { userId } }),
    investmentPlatforms: await prisma.investmentPlatform.count({ where: { userId } }),
    emailTemplates: await prisma.emailTemplate.count({ where: { userId } }),
    pushSubscriptions: await prisma.pushSubscription.count({ where: { userId } }),
  }
}

describe("suppression de toutes les données", () => {
  it("efface tout le compte courant, sans toucher au compte voisin", async () => {
    const a = await makeUser()
    const b = await makeUser()
    await seedEverything(a.id)
    await seedEverything(b.id)

    const beforeB = await snapshot(b.id)
    expect(Object.values(beforeB).every((n) => n > 0)).toBe(true)

    setTestUser(a.id)
    await deleteAllUserData("ignored").catch((e) => { if (!isRedirect(e)) throw e })

    const afterA = await snapshot(a.id)
    for (const [key, count] of Object.entries(afterA)) {
      expect(`${key}=${count}`).toBe(`${key}=0`) // message lisible : dit QUEL modèle a survécu
    }
    expect(await snapshot(b.id)).toEqual(beforeB)
  })
})
