import { describe, it, expect } from "vitest"
import { exportAllData } from "@/actions/export"
import { importData } from "@/actions/import-data"
import { prisma } from "@/lib/prisma"
import { BACKUP_MODELS } from "@/lib/backup-models"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject, makeCompany, makeInvoice } from "./helpers/factories"

// #7 : la sauvegarde ne couvrait que 25 modèles sur 67 alors que l'écran promet « l'intégralité
// de tes données ». Aller-retour complet : un compte rempli sur TOUS les modules → export →
// suppression du compte → restauration dans un compte neuf → chaque clé revient.

const NEW_KEYS = [
  "fiscalSources", "companyCategories", "calendarCategories", "expenseCategories", "emailTemplates",
  "callTemplates", "investmentPlatforms", "skills", "recurringInvoiceLines", "projectContacts",
  "projectEvents", "prospectEvents", "prospectNotes", "emailLogs", "emailDrafts", "interviewAnswers",
  "recurringRevenues", "revenues", "recurringExpenses", "expenses", "healthEvents",
  "healthConsultations", "healthReimbursements", "jobApplications", "jobApplicationEvents",
  "urssafDeclarations", "urssafDeclarationLines", "projectSkills", "jobApplicationSkills",
  "interviewQuestions", "questionSkills", "investmentEntries",
] as const

async function seedEverything(userId: string) {
  const d = new Date(2026, 5, 15)
  const client = await makeClient(userId, { name: "Client Fictif" })
  const company = await makeCompany(userId, { name: "Société Fictive" })
  const project = await makeProject(userId, client.id, "Projet Fictif")
  const invoice = await makeInvoice(userId, client.id, { status: "PAID", totalHT: 500 })
  const source = await prisma.fiscalSource.create({ data: { userId, name: "AE fictive", bucket: "AE_URSSAF" } })
  await prisma.companyCategory.create({ data: { userId, name: "Catégorie" } })
  await prisma.calendarCategory.create({ data: { userId, name: "Perso", color: "#000000" } })
  const expCat = await prisma.expenseCategory.create({ data: { userId, name: "Logiciels" } })
  const tpl = await prisma.emailTemplate.create({ data: { userId, name: "Premier contact", subject: "Bonjour", body: "…" } })
  await prisma.callTemplate.create({ data: { userId, name: "Script", script: "…" } })
  const platform = await prisma.investmentPlatform.create({ data: { userId, name: "Plateforme" } })
  const parent = await prisma.skill.create({ data: { userId, name: "Back-end" } })
  const skill = await prisma.skill.create({ data: { userId, name: "Go", parentId: parent.id } })
  const recInv = await prisma.recurringInvoice.create({ data: { userId, clientId: client.id, name: "Maintenance", nextGenerationDate: d } })
  await prisma.recurringInvoiceLine.create({ data: { recurringInvoiceId: recInv.id, description: "Forfait", unitPrice: 50, total: 50 } })
  await prisma.projectContact.create({ data: { projectId: project.id, clientId: client.id } })
  await prisma.projectEvent.create({ data: { projectId: project.id, title: "Kick-off", date: d } })
  await prisma.prospectEvent.create({ data: { clientId: client.id, kind: "EMAIL_SENT" } })
  await prisma.prospectNote.create({ data: { clientId: client.id, title: "Note" } })
  await prisma.emailLog.create({ data: { userId, to: "client@example.com", subject: "Facture", invoiceId: invoice.id, clientId: client.id } })
  await prisma.emailDraft.create({ data: { userId, clientId: client.id, subject: "Brouillon", body: "…", templateId: tpl.id } })
  await prisma.interviewAnswer.create({ data: { userId, question: "Pourquoi ?", answer: "Parce que." } })
  const recRev = await prisma.recurringRevenue.create({ data: { userId, type: "FREELANCE", label: "Mission", amount: 800, fiscalSourceId: source.id } })
  const revenue = await prisma.revenue.create({ data: { userId, type: "FREELANCE", label: "Mission juin", amount: 800, recurringRevenueId: recRev.id, fiscalSourceId: source.id, companyId: company.id } })
  const recExp = await prisma.recurringExpense.create({ data: { userId, label: "Abonnement", amount: 9.99, nextGenerationDate: d, categoryId: expCat.id } })
  await prisma.expense.create({ data: { userId, label: "Abonnement", amount: 9.99, date: d, categoryId: expCat.id, recurringExpenseId: recExp.id } })
  const hEvent = await prisma.healthEvent.create({ data: { userId, date: d, type: "OTHER", title: "Contrôle" } })
  const consult = await prisma.healthConsultation.create({ data: { userId, date: d, practitionerName: "Dr Fictif", title: "Consultation", healthEventId: hEvent.id } })
  await prisma.healthReimbursement.create({ data: { userId, amount: 20, source: "SECU", consultationId: consult.id } })
  const app = await prisma.jobApplication.create({ data: { userId, companyName: "Société Fictive", position: "Dev", companyId: company.id, contactId: client.id } })
  await prisma.jobApplicationEvent.create({ data: { userId, applicationId: app.id, date: d, title: "Entretien" } })
  const decl = await prisma.urssafDeclaration.create({ data: { userId, period: "2026-T2", periodStart: new Date(2026, 3, 1), periodEnd: new Date(2026, 5, 30) } })
  await prisma.urssafDeclarationLine.create({ data: { declarationId: decl.id, category: "BNC", label: "Mission", amount: 800, revenueId: revenue.id, invoiceId: invoice.id } })
  await prisma.projectSkill.create({ data: { projectId: project.id, skillId: skill.id } })
  await prisma.jobApplicationSkill.create({ data: { applicationId: app.id, skillId: skill.id } })
  const question = await prisma.interviewQuestion.create({ data: { userId, question: "Goroutine ?", applicationId: app.id } })
  await prisma.questionSkill.create({ data: { questionId: question.id, skillId: skill.id } })
  await prisma.investmentEntry.create({ data: { platformId: platform.id, date: d, capital: 1000 } })
}

describe("sauvegarde complète — aller-retour (#7)", () => {
  it("chaque module revient à l'identique dans un compte neuf, rattaché à ce compte", async () => {
    const a = await makeUser()
    setTestUser(a.id)
    await seedEverything(a.id)
    const backup = JSON.parse(await exportAllData())

    // Toutes les clés de l'inventaire sont présentes dans l'export
    for (const key of Object.keys(BACKUP_MODELS)) expect(backup.data, `clé ${key}`).toHaveProperty(key)
    for (const key of NEW_KEYS) expect(backup.data[key].length, `export ${key}`).toBeGreaterThan(0)

    // Le compte d'origine disparaît (restauration sur une installation neuve)
    await prisma.user.delete({ where: { id: a.id } })
    const b = await makeUser()
    setTestUser(b.id)
    const res = await importData(JSON.stringify(backup))
    expect(res.error).toBeUndefined()
    expect(res.success).toBe(true)

    const again = JSON.parse(await exportAllData())
    for (const key of NEW_KEYS) expect(again.data[key].length, `restauré ${key}`).toBe(backup.data[key].length)

    // Références et arborescence conservées, tout est au nom du nouveau compte
    const go = await prisma.skill.findFirstOrThrow({ where: { userId: b.id, name: "Go" } })
    expect(go.parentId).not.toBeNull()
    expect(await prisma.revenue.count({ where: { userId: b.id, fiscalSourceId: { not: null }, recurringRevenueId: { not: null } } })).toBe(1)
    expect(await prisma.expense.count({ where: { userId: b.id, recurringExpenseId: { not: null } } })).toBe(1)
  })

  it("une référence vers le compte d'un autre est coupée (contact) ou la ligne écartée (obligatoire)", async () => {
    const victim = await makeUser()
    const theirClient = await makeClient(victim.id)
    const user = await makeUser()
    setTestUser(user.id)
    const res = await importData(JSON.stringify({
      data: {
        revenues: [{ id: "rev-x", type: "OTHER", label: "R", amount: 1, clientId: theirClient.id }],
        prospectNotes: [{ id: "note-x", clientId: theirClient.id, title: "Intrusion" }],
      },
    }))
    expect(res.success).toBe(true)
    expect((await prisma.revenue.findUniqueOrThrow({ where: { id: "rev-x" } })).clientId).toBeNull()
    expect(await prisma.prospectNote.count({ where: { id: "note-x" } })).toBe(0)
  })
})
