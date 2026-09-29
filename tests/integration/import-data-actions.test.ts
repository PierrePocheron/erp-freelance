import { describe, it, expect, vi } from "vitest"
import { importData } from "@/actions/import-data"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeCompany, makeProject, makeQuote, makeInvoice } from "./helpers/factories"

// Restauration d'une sauvegarde JSON (importData) : toutes les sections, dédup
// (skipDuplicates), rattachements anti-IDOR, import partiel, entrées invalides.
// Complète export-import.test.ts (aller-retour facturation). Données FACTICES.

const d = (iso: string) => `2026-${iso}T00:00:00.000Z`

/** Sauvegarde couvrant chacune des sections restaurées. */
function fullBackup() {
  return {
    version: 1,
    data: {
      userProfile: { id: "up1", companyName: "Exemple Studio", siret: "00000000000000", city: "Lyon" },
      emitterProfiles: [{ id: "ep1", name: "Principal", companyName: "Exemple SAS", isDefault: true }],
      tags: [{ id: "tag1", name: "Web", color: "#000000" }],
      conditionsTemplates: [{ id: "ct1", name: "CGV", content: "Paiement à 30 jours", isDefault: true }],
      companies: [{ id: "co1", name: "Exemple SARL", city: "Lyon" }],
      companyTeams: [{ id: "team1", companyId: "co1", name: "Direction" }],
      clients: [{
        id: "cl1", type: "CLIENT", name: "Client Exemple", companyId: "co1", company: "Exemple SARL",
        teamId: "team1", email: "client@example.com", phone: "06 00 00 00 00", source: "WEBSITE",
        prospectStatus: "WON", createdAt: d("01-02"),
      }],
      interactions: [{ id: "in1", clientId: "cl1", date: d("01-10"), channel: "EMAIL", summary: "Premier échange" }],
      reminders: [{ id: "rem1", clientId: "cl1", dueDate: d("02-01"), note: "Relancer", isDone: true, doneAt: d("02-02") }],
      clientFiles: [{ id: "cf1", clientId: "cl1", name: "brief.pdf", fileUrl: "https://blob.test/brief.pdf", type: "BRIEF" }],
      products: [{ id: "pr1", name: "Forfait", unitPrice: 500, unit: "FLAT", billingType: "ONE_SHOT" }],
      projects: [
        { id: "pj1", clientId: "cl1", name: "Refonte", status: "ACTIVE", startDate: d("01-15"), tagIds: ["tag1"] },
        { id: "pj2", clientId: "cl1", name: "Tag perdu", status: "PAUSED", tagIds: ["tag-absent"] },
      ],
      milestones: [{ id: "ms1", projectId: "pj1", name: "Livraison", date: d("03-01"), status: "UPCOMING" }],
      taskTags: [{ id: "tt1", projectId: "pj1", name: "Front" }],
      tasks: [
        { id: "tk1", userId: "ancien-id", projectId: "pj1", milestoneId: "ms1", clientId: "cl1", title: "Maquette", status: "TODO", priority: "HIGH", dueDate: d("02-20"), taskTagIds: ["tt1"] },
        { id: "tk2", projectId: "pj1", parentTaskId: "tk1", title: "Sous-tâche", status: "DONE", priority: "LOW" },
        { id: "tk3", userId: "ancien-id", parentTaskId: "tk-absent", title: "Orpheline", status: "TODO", priority: "LOW" },
      ],
      timeEntries: [{ id: "te1", taskId: "tk1", startedAt: d("01-11"), endedAt: d("01-12"), duration: 3600 }],
      journalEntries: [{ id: "je1", projectId: "pj1", content: "Kickoff" }],
      deliverables: [{ id: "dl1", projectId: "pj1", name: "Maquettes", status: "DELIVERED", dueDate: d("02-28") }],
      usefulLinks: [{ id: "ul1", projectId: "pj1", label: "Maquettes", url: "https://maquettes.example.com", category: "DOCS" }],
      postDevs: [{ id: "pd1", projectId: "pj1", prodUrl: "https://exemple.example.com" }],
      renewals: [{ id: "rn1", postDevId: "pd1", type: "DOMAIN", name: "Domaine", expiresAt: "2027-01-01T00:00:00.000Z" }],
      quotes: [{ id: "qt1", clientId: "cl1", projectId: "pj1", emitterProfileId: "ep1", number: "DEV-2026-001", status: "ACCEPTED", depositPercent: 30, totalHT: 1000 }],
      quoteLines: [{ id: "ql1", quoteId: "qt1", description: "Conception", quantity: 2, unitPrice: 500, billingType: "ONE_SHOT", total: 1000 }],
      invoices: [{ id: "iv1", clientId: "cl1", quoteId: "qt1", number: "FAC-2026-001", type: "FINAL", status: "SENT", totalHT: 1000, dueDate: d("03-15") }],
      invoiceLines: [{ id: "il1", invoiceId: "iv1", description: "Conception", unitPrice: 1000, total: 1000 }],
      payments: [{ id: "pay1", invoiceId: "iv1", amount: 400, paidAt: d("02-15") }],
      recurringInvoices: [{ id: "ri1", clientId: "cl1", name: "Maintenance", frequency: "MONTHLY", nextGenerationDate: d("10-01") }],
      calendarEvents: [{ id: "ce1", title: "Point client", startDate: d("10-02"), sourceType: "MANUAL" }],
      projectIdeas: [{ id: "pi1", title: "App mobile" }],
    },
  }
}

async function asNewUser() {
  const u = await makeUser()
  setTestUser(u.id)
  return u
}

describe("importData — entrées invalides", () => {
  it("sans session → refus, rien d'écrit", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const res = await importData(JSON.stringify(fullBackup()))
    expect(res).toEqual({ success: false, error: "Non authentifié", counts: {}, total: 0 })
    expect(await prisma.client.count()).toBe(0)
  })

  it("JSON illisible → erreur explicite", async () => {
    await asNewUser()
    expect(await importData("{ pas du json")).toEqual({ success: false, error: "Fichier JSON invalide", counts: {}, total: 0 })
  })

  it("sauvegarde vide ({ data: {} }) → succès, rien d'importé", async () => {
    const user = await asNewUser()
    expect(await importData(JSON.stringify({ data: {} }))).toEqual({ success: true, counts: {}, total: 0 })
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(0)
  })
})

describe("importData — sauvegarde complète", () => {
  it("restaure chaque section sous l'utilisateur courant, avec les liens", async () => {
    const user = await asNewUser()

    const res = await importData(JSON.stringify(fullBackup()))

    expect(res.success).toBe(true)
    expect(res.counts).toEqual({
      "Profil professionnel": 1, "Sociétés (émetteurs)": 1, Tags: 1, "Conditions générales": 1,
      Sociétés: 1, "Zones d'organigramme": 1, Contacts: 1, Interactions: 1, Rappels: 1,
      "Fichiers contacts": 1, Produits: 1, Projets: 2, Jalons: 1, "Tags de tâches": 1, Tâches: 3,
      "Sous-tâches": 2, "Entrées de temps": 1, "Journal de bord": 1, Livrables: 1, "Liens utiles": 1,
      "Post-Dev": 1, Renouvellements: 1, Devis: 1, "Lignes de devis": 1, Factures: 1,
      "Lignes de factures": 1, Paiements: 1, "Factures récurrentes": 1, Calendrier: 1, "Idées projets": 1,
    })
    expect(res.total).toBe(34)

    const uid = user.id
    expect(await prisma.userProfile.findUnique({ where: { userId: uid } })).toMatchObject({
      companyName: "Exemple Studio", country: "France", quotePrefix: "DEV", invoicePrefix: "FAC",
    })
    expect(await prisma.emitterProfile.findUnique({ where: { id: "ep1" } })).toMatchObject({ userId: uid, isDefault: true })
    expect(await prisma.conditionsTemplate.findUnique({ where: { id: "ct1" } })).toMatchObject({ userId: uid, isDefault: true })
    expect(await prisma.client.findUnique({ where: { id: "cl1" } })).toMatchObject({
      userId: uid, companyId: "co1", teamId: "team1", source: "WEBSITE", prospectStatus: "WON",
      createdAt: new Date(d("01-02")),
    })
    expect(await prisma.reminder.findUnique({ where: { id: "rem1" } })).toMatchObject({ isDone: true, doneAt: new Date(d("02-02")) })

    // M2M projet ↔ tag : un tag absent est ignoré sans casser l'import
    const pj1 = await prisma.project.findUnique({ where: { id: "pj1" }, include: { tags: true } })
    const pj2 = await prisma.project.findUnique({ where: { id: "pj2" }, include: { tags: true } })
    expect(pj1?.tags.map((t) => t.id)).toEqual(["tag1"])
    expect(pj2?.tags).toEqual([])

    // Tâches : propriétaire réécrit, sous-tâche rattachée, parent absent ignoré, tags de tâche liés
    const tasks = await prisma.task.findMany({ include: { taskTags: true }, orderBy: { id: "asc" } })
    expect(tasks.map((t) => [t.id, t.userId, t.projectId, t.milestoneId, t.clientId, t.parentTaskId])).toEqual([
      ["tk1", uid, "pj1", "ms1", "cl1", null],
      ["tk2", null, "pj1", null, null, "tk1"],
      ["tk3", uid, null, null, null, null],
    ])
    expect(tasks[0].taskTags.map((t) => t.id)).toEqual(["tt1"])

    expect(await prisma.timeEntry.findUnique({ where: { id: "te1" } })).toMatchObject({ userId: uid, duration: 3600 })
    expect(await prisma.renewal.findUnique({ where: { id: "rn1" } })).toMatchObject({ postDevId: "pd1", type: "DOMAIN" })
    expect(await prisma.quote.findUnique({ where: { id: "qt1" } })).toMatchObject({ userId: uid, emitterProfileId: "ep1", depositPercent: 30 })
    expect(await prisma.invoice.findUnique({ where: { id: "iv1" }, include: { payments: true, lines: true } })).toMatchObject({
      userId: uid, quoteId: "qt1", type: "FINAL", payments: [{ amount: 400 }], lines: [{ quantity: 1, taxRate: 0 }],
    })
    expect(await prisma.recurringInvoice.findUnique({ where: { id: "ri1" } })).toMatchObject({ userId: uid, isActive: true })
    expect(await prisma.calendarEvent.findUnique({ where: { id: "ce1" } })).toMatchObject({ userId: uid, allDay: false })
    expect(await prisma.projectIdea.findUnique({ where: { id: "pi1" } })).toMatchObject({ userId: uid, content: "" })
  })

  it("réimporter la même sauvegarde ne crée aucun doublon et met à jour le profil", async () => {
    const user = await asNewUser()
    await prisma.userProfile.create({ data: { userId: user.id, companyName: "Ancien nom", pdfAccentColor: "#ff0000" } })

    const backup = fullBackup()
    await importData(JSON.stringify(backup))
    const second = await importData(JSON.stringify(backup))
    expect(second.success).toBe(true)

    expect(await prisma.userProfile.findUnique({ where: { userId: user.id } })).toMatchObject({
      companyName: "Exemple Studio", pdfAccentColor: "#6366f1",
    })
    expect(await prisma.client.count()).toBe(1)
    expect(await prisma.project.count()).toBe(2)
    expect(await prisma.task.count()).toBe(3)
    expect(await prisma.interaction.count()).toBe(1)
    expect(await prisma.invoiceLine.count()).toBe(1)
    expect(await prisma.payment.count()).toBe(1)
    expect((await prisma.project.findUnique({ where: { id: "pj1" }, include: { tags: true } }))?.tags).toHaveLength(1)
  })
})

describe("importData — import partiel", () => {
  it("une section en échec (donnée invalide) annule TOUT l'import (transaction, #35)", async () => {
    const user = await asNewUser()
    const res = await importData(JSON.stringify({
      data: {
        tags: [{ id: "tagP", name: "Conservé" }],
        clients: [{ id: "clP", type: "CLIENT", name: "Conservé" }],
        // (une référence de contact inconnue est désormais simplement ignorée : on casse
        // la section avec un statut hors enum)
        projects: [{ id: "pjP", name: "Cassé", status: "STATUT_INCONNU" }],
        projectIdeas: [{ id: "piP", title: "Jamais atteinte" }],
      },
    }))

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(res.total).toBe(0)
    expect(res.counts).toEqual({})
    // Transaction unique : rien de ce qui précède l'erreur n'est conservé
    expect(await prisma.tag.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.project.count()).toBe(0)
    expect(await prisma.projectIdea.count()).toBe(0)
  })
})

// ── Isolation entre utilisateurs ─────────────────────────────────────────────

/** Données d'un autre compte, référencées par id dans une sauvegarde forgée. */
async function seedVictim() {
  const owner = await makeUser()
  const company = await makeCompany(owner.id)
  const team = await prisma.companyTeam.create({ data: { companyId: company.id, name: "Équipe" } })
  const client = await makeClient(owner.id, { name: "Client victime", companyId: company.id })
  const project = await makeProject(owner.id, client.id, "Projet victime")
  const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "Jalon", date: new Date(d("05-01")) } })
  const task = await prisma.task.create({ data: { userId: owner.id, projectId: project.id, title: "Tâche victime" } })
  const postDev = await prisma.postDev.create({ data: { projectId: project.id } })
  const quote = await makeQuote(owner.id, client.id, { number: "DEV-V-1" })
  const invoice = await makeInvoice(owner.id, client.id, { number: "FAC-V-1" })
  const emitter = await prisma.emitterProfile.create({ data: { userId: owner.id, name: "Émetteur victime", companyName: "Victime SAS" } })
  return { owner, company, team, client, project, milestone, task, postDev, quote, invoice, emitter }
}

async function victimFootprint(v: Awaited<ReturnType<typeof seedVictim>>) {
  return {
    teams: await prisma.companyTeam.count({ where: { companyId: v.company.id } }),
    interactions: await prisma.interaction.count({ where: { clientId: v.client.id } }),
    reminders: await prisma.reminder.count({ where: { clientId: v.client.id } }),
    files: await prisma.clientFile.count({ where: { clientId: v.client.id } }),
    milestones: await prisma.milestone.count({ where: { projectId: v.project.id } }),
    taskTags: await prisma.taskTag.count({ where: { projectId: v.project.id } }),
    tasks: await prisma.task.count({ where: { projectId: v.project.id } }),
    time: await prisma.timeEntry.count({ where: { taskId: v.task.id } }),
    journal: await prisma.journalEntry.count({ where: { projectId: v.project.id } }),
    deliverables: await prisma.deliverable.count({ where: { projectId: v.project.id } }),
    links: await prisma.usefulLink.count({ where: { projectId: v.project.id } }),
    renewals: await prisma.renewal.count({ where: { postDevId: v.postDev.id } }),
    quoteLines: await prisma.quoteLine.count({ where: { quoteId: v.quote.id } }),
    invoiceLines: await prisma.invoiceLine.count({ where: { invoiceId: v.invoice.id } }),
    payments: await prisma.payment.count({ where: { invoiceId: v.invoice.id } }),
  }
}

describe("importData — isolation (sauvegarde forgée)", () => {
  it("les enfants pointant vers les données d'autrui sont écartés ou détachés", async () => {
    const v = await seedVictim()
    const before = await victimFootprint(v)
    const attacker = await asNewUser()

    const res = await importData(JSON.stringify({
      data: {
        companyTeams: [{ id: "x-team", companyId: v.company.id, name: "Intrus" }],
        clients: [{ id: "x-cl", type: "CLIENT", name: "Mien", teamId: v.team.id }],
        interactions: [{ id: "x-in", clientId: v.client.id, date: d("01-01"), channel: "EMAIL", summary: "intrus" }],
        reminders: [{ id: "x-rem", clientId: v.client.id, dueDate: d("01-01") }],
        clientFiles: [{ id: "x-cf", clientId: v.client.id, name: "x", fileUrl: "https://blob.test/x", type: "OTHER" }],
        milestones: [{ id: "x-ms", projectId: v.project.id, name: "x", date: d("01-01") }],
        taskTags: [{ id: "x-tt", projectId: v.project.id, name: "x" }],
        tasks: [{ id: "x-tk", projectId: v.project.id, clientId: v.client.id, milestoneId: v.milestone.id, title: "Greffe", status: "TODO", priority: "LOW" }],
        timeEntries: [{ id: "x-te", taskId: v.task.id, startedAt: d("01-01") }],
        journalEntries: [{ id: "x-je", projectId: v.project.id, content: "x" }],
        deliverables: [{ id: "x-dl", projectId: v.project.id, name: "x", status: "TO_DELIVER" }],
        usefulLinks: [{ id: "x-ul", projectId: v.project.id, label: "x", url: "https://x.example.com", category: "OTHER" }],
        postDevs: [{ id: "x-pd", projectId: v.project.id }],
        renewals: [{ id: "x-rn", postDevId: v.postDev.id, type: "OTHER", name: "x", expiresAt: d("12-01") }],
        quoteLines: [{ id: "x-ql", quoteId: v.quote.id, description: "x", unitPrice: 1, billingType: "ONE_SHOT", total: 1 }],
        invoiceLines: [{ id: "x-il", invoiceId: v.invoice.id, description: "x", unitPrice: 1, total: 1 }],
        payments: [{ id: "x-pay", invoiceId: v.invoice.id, amount: 1 }],
      },
    }))

    expect(res.success).toBe(true)
    // Seuls le contact et la tâche (détachée) sont importés
    expect(res.counts).toEqual({ Contacts: 1, Tâches: 1 })
    expect(await victimFootprint(v)).toEqual(before)
    expect(await prisma.client.findUnique({ where: { id: "x-cl" } })).toMatchObject({ userId: attacker.id, teamId: null })
    expect(await prisma.task.findUnique({ where: { id: "x-tk" } })).toMatchObject({
      projectId: null, clientId: null, milestoneId: null, userId: null,
    })
    expect(await prisma.postDev.count()).toBe(1)
  })

  it("un id déjà pris par autrui n'écrase pas sa donnée (skipDuplicates)", async () => {
    const v = await seedVictim()
    await asNewUser()

    const res = await importData(JSON.stringify({
      data: { clients: [{ id: v.client.id, type: "CLIENT", name: "Écrasé ?", email: "pirate@example.com" }] },
    }))

    expect(res.success).toBe(true)
    expect(await prisma.client.findUnique({ where: { id: v.client.id } })).toMatchObject({
      userId: v.owner.id, name: "Client victime", email: null,
    })
  })

  // Régression corrigée le 29/09/2026 (src/actions/import-data.ts:297-303) — la passe M2M projets↔tags fait
  // `prisma.project.update({ where: { id: project.id } })` SANS filtre userId :
  // une sauvegarde forgée qui reprend l'id d'un projet d'autrui (ignoré par
  // skipDuplicates à la création) greffe ses propres tags sur ce projet étranger.
  it("ne greffe pas de tags sur le projet d'un autre utilisateur", async () => {
    const v = await seedVictim()
    const attacker = await asNewUser()
    const mine = await makeClient(attacker.id)

    await importData(JSON.stringify({
      data: {
        tags: [{ id: "x-tag", name: "Intrus" }],
        projects: [{ id: v.project.id, clientId: mine.id, name: "x", tagIds: ["x-tag"] }],
      },
    }))

    const victimProject = await prisma.project.findUnique({ where: { id: v.project.id }, include: { tags: true } })
    expect(victimProject?.tags).toEqual([])
  })

  // Régression corrigée le 29/09/2026 (src/actions/import-data.ts:373-389) — passes 2 (parentTaskId) et 3
  // (taskTags) des tâches : `prisma.task.update({ where: { id: task.id } })`
  // sans filtre de propriétaire → une sauvegarde forgée re-parente (ou tague)
  // une tâche d'autrui sous l'une des siennes.
  it("ne re-parente pas la tâche d'un autre utilisateur", async () => {
    const v = await seedVictim()
    await asNewUser()

    await importData(JSON.stringify({
      data: {
        tasks: [
          { id: "x-parent", userId: "x", title: "Parent intrus", status: "TODO", priority: "LOW" },
          { id: v.task.id, parentTaskId: "x-parent", title: "x", status: "TODO", priority: "LOW" },
        ],
      },
    }))

    expect((await prisma.task.findUnique({ where: { id: v.task.id } }))?.parentTaskId).toBeNull()
  })

  // Régression corrigée le 29/09/2026 (src/actions/import-data.ts:192, 284, 504-505, 542-544, 596) — les FK
  // « parents » des entités racines (client.companyId, project.clientId,
  // quote.clientId/projectId/emitterProfileId, invoice.clientId/…,
  // recurringInvoice.clientId) ne sont PAS vérifiées contre userId, contrairement
  // aux enfants. Un devis importé peut ainsi pointer vers le profil émetteur
  // d'autrui : son PDF afficherait la raison sociale / l'IBAN de la victime.
  it("ne rattache pas un devis importé au profil émetteur ni au contact d'autrui", async () => {
    const v = await seedVictim()
    await asNewUser()

    const res = await importData(JSON.stringify({
      data: {
        clients: [{ id: "x-cl", type: "CLIENT", name: "Mien", companyId: v.company.id }],
        quotes: [{ id: "x-qt", clientId: v.client.id, emitterProfileId: v.emitter.id, number: "DEV-X-1", status: "DRAFT" }],
      },
    }))

    // Attendu : rattachements étrangers détachés (ou lignes rejetées)
    expect(res.success).toBe(true)
    expect((await prisma.client.findUnique({ where: { id: "x-cl" } }))?.companyId).toBeNull()
    const q = await prisma.quote.findUnique({ where: { id: "x-qt" } })
    expect(q?.emitterProfileId ?? null).toBeNull()
    expect(q?.clientId).not.toBe(v.client.id)
  })
})
