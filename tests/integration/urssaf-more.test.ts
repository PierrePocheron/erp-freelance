import { describe, it, expect, vi } from "vitest"
import {
  suggestDeclarationLines,
  createUrssafDeclaration,
  updateUrssafDeclarationLines,
  markUrssafDeclared,
  markUrssafPaid,
  deleteUrssafDeclaration,
  ensureUrssafReminderTask,
  setInvoiceUrssafExcluded,
  setClientFiscalCategory,
} from "@/actions/urssaf"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { zonedDateKey, isZonedAllDay } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeInvoice, makeFiscalSource } from "./helpers/factories"

// Instants en milieu de mois, midi UTC : sans ambiguïté de fuseau vis-à-vis des
// bornes de période (minuit Paris).
const at = (iso: string) => new Date(`${iso}T12:00:00Z`)

async function asNewUser() {
  const user = await makeUser()
  setTestUser(user.id)
  return user
}

const declOf = (id: string) => prisma.urssafDeclaration.findUniqueOrThrow({ where: { id }, include: { lines: true } })

describe("suggestions d'assiette — revenus, pré-cochage, tri", () => {
  it("revenus AE reçus pré-cochés, attendus visibles non cochés ; encaissées d'abord puis ordre alphabétique", async () => {
    const user = await asNewUser()
    const client = await makeClient(user.id, { name: "Zeta Conseil", defaultFiscalCategory: "BIC_SALES" })
    const ae = await makeFiscalSource(user.id, { bucket: "AE_URSSAF" })

    const paidIn = await makeInvoice(user.id, client.id, { number: "FAC-B", status: "PAID", totalHT: 100 })
    await prisma.invoice.update({ where: { id: paidIn.id }, data: { paidAt: at("2026-05-10") } })
    // Émise dans la période, payée après : proposée mais non cochée.
    const paidAfter = await makeInvoice(user.id, client.id, { number: "FAC-A", status: "PAID", totalHT: 200 })
    await prisma.invoice.update({ where: { id: paidAfter.id }, data: { issuedAt: at("2026-06-10"), paidAt: at("2026-07-10") } })

    await prisma.revenue.create({
      data: { userId: user.id, type: "FREELANCE", label: "Revenu reçu", amount: 300, status: "RECEIVED", receivedAt: at("2026-04-20"), fiscalSourceId: ae.id, clientId: client.id },
    })
    await prisma.revenue.create({
      data: { userId: user.id, type: "FREELANCE", label: "Attendu", amount: 400, status: "PENDING", expectedAt: at("2026-06-25"), fiscalSourceId: ae.id },
    })
    // Hors période : ignoré.
    await prisma.revenue.create({
      data: { userId: user.id, type: "FREELANCE", label: "Trop tôt", amount: 999, status: "RECEIVED", receivedAt: at("2026-03-15"), fiscalSourceId: ae.id },
    })

    const lines = await suggestDeclarationLines("2026-T2")
    expect(lines.map((l) => [l.label, l.defaultIncluded, l.category])).toEqual([
      ["FAC-B — Zeta Conseil", true, "BIC_SALES"],
      ["Revenu reçu", true, "BIC_SALES"],
      ["Attendu", false, "BNC"],
      ["FAC-A — Zeta Conseil", false, "BIC_SALES"],
    ])
    const rev = lines.find((l) => l.label === "Attendu")!
    expect(rev).toMatchObject({ invoiceId: null, amount: 400, status: "PENDING" })
    expect(rev.revenueId).toBeTruthy()
  })

  it("un revenu déjà déclaré n'est plus proposé", async () => {
    const user = await asNewUser()
    const ae = await makeFiscalSource(user.id, { bucket: "AE_URSSAF" })
    const r = await prisma.revenue.create({
      data: { userId: user.id, type: "FREELANCE", label: "Presta", amount: 500, status: "RECEIVED", receivedAt: at("2026-05-10"), fiscalSourceId: ae.id },
    })
    await createUrssafDeclaration({ period: "2026-05", lines: [{ category: "BNC", revenueId: r.id, label: "Presta", amount: 500 }] })
    expect(await suggestDeclarationLines("2026-T2")).toEqual([])
  })
})

describe("cycle de vie d'une déclaration", () => {
  it("modification des lignes en brouillon : remplace, re-ventile, notes conservées ou effacées", async () => {
    await asNewUser()
    const { id } = await createUrssafDeclaration({
      period: "2026-T2", notes: "brouillon", lines: [{ category: "BNC", label: "Ancienne", amount: 100 }],
    })

    expect(await updateUrssafDeclarationLines(id!, [
      { category: "BNC", label: "  Presta A ", amount: 1000 },
      { category: "BIC_SERVICES", label: "Presta B", amount: 250 },
      { category: "BIC_SALES", label: "Vente", amount: 80 },
      { category: "BIC_SALES", label: "Vente 2", amount: 20 },
    ])).toEqual({})
    let decl = await declOf(id!)
    expect(decl).toMatchObject({ amountBNC: 1000, amountBICServices: 250, amountBICSales: 100, notes: "brouillon" })
    expect(decl.lines.map((l) => l.label).sort()).toEqual(["Presta A", "Presta B", "Vente", "Vente 2"])

    await updateUrssafDeclarationLines(id!, [], null)
    decl = await declOf(id!)
    expect(decl).toMatchObject({ amountBNC: 0, amountBICServices: 0, amountBICSales: 0, notes: null })
    expect(decl.lines).toHaveLength(0)

    expect((await updateUrssafDeclarationLines("inexistante", [])).error).toMatch(/introuvable/)
  })

  it("déclarée puis payée : statuts, dates, total prélevé, rappel de la période soldé (et lui seul)", async () => {
    const user = await asNewUser()
    const { id } = await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", label: "F", amount: 1000 }] })
    const reminder = await prisma.task.create({ data: { userId: user.id, title: "Déclarer T2", urssafPeriod: "2026-T2" } })
    const otherPeriod = await prisma.task.create({ data: { userId: user.id, title: "Déclarer T3", urssafPeriod: "2026-T3" } })
    const neighbour = await makeUser()
    const neighbourTask = await prisma.task.create({ data: { userId: neighbour.id, title: "T2 voisin", urssafPeriod: "2026-T2" } })

    const declaredAt = at("2026-07-20")
    expect(await markUrssafDeclared(id!, declaredAt)).toEqual({})
    let decl = await declOf(id!)
    expect(decl.status).toBe("DECLARED")
    expect(decl.declaredAt!.getTime()).toBe(declaredAt.getTime())
    const done = await prisma.task.findUniqueOrThrow({ where: { id: reminder.id } })
    expect(done.status).toBe("DONE")
    expect(done.completedAt).not.toBeNull()
    expect((await prisma.task.findUniqueOrThrow({ where: { id: otherPeriod.id } })).status).toBe("TODO")
    expect((await prisma.task.findUniqueOrThrow({ where: { id: neighbourTask.id } })).status).toBe("TODO")

    expect(await markUrssafPaid(id!, { paidAt: at("2026-08-05"), cotisations: 212, cfp: 2, versementLiberatoire: 22 })).toEqual({})
    decl = await declOf(id!)
    expect(decl).toMatchObject({ status: "PAID", cotisations: 212, cfp: 2, versementLiberatoire: 22, totalPaid: 236 })
    expect(decl.declaredAt!.getTime()).toBe(declaredAt.getTime()) // déclarée avant : date conservée
    expect(zonedDateKey(decl.paidAt!)).toBe("2026-08-05")
  })

  it("payée sans avoir été marquée déclarée : la date de déclaration reprend celle du paiement", async () => {
    const user = await asNewUser()
    const { id } = await createUrssafDeclaration({ period: "2026-06", lines: [] })
    const reminder = await prisma.task.create({ data: { userId: user.id, title: "Déclarer juin", urssafPeriod: "2026-06" } })
    const paidAt = at("2026-07-25")
    await markUrssafPaid(id!, { paidAt, cotisations: 0, cfp: 0, versementLiberatoire: 0 })
    const decl = await declOf(id!)
    expect(decl.declaredAt!.getTime()).toBe(paidAt.getTime())
    expect(decl.totalPaid).toBe(0)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe("DONE")
  })

  it("suppression : les factures liées redeviennent déclarables ; déclaration d'autrui intouchable", async () => {
    const user = await asNewUser()
    const client = await makeClient(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "PAID", totalHT: 500 })
    await prisma.invoice.update({ where: { id: inv.id }, data: { paidAt: at("2026-05-10") } })
    const { id } = await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", invoiceId: inv.id, label: "F", amount: 500 }] })
    expect(await suggestDeclarationLines("2026-T2")).toHaveLength(0)

    await asNewUser()
    expect((await deleteUrssafDeclaration(id!)).error).toMatch(/introuvable/)
    expect((await markUrssafDeclared(id!, new Date())).error).toMatch(/introuvable/)
    expect((await declOf(id!)).status).toBe("DRAFT")

    setTestUser(user.id)
    expect(await deleteUrssafDeclaration(id!)).toEqual({})
    expect(await prisma.urssafDeclaration.count()).toBe(0)
    expect(await prisma.urssafDeclarationLine.count()).toBe(0)
    const again = await suggestDeclarationLines("2026-T2")
    expect(again.map((l) => l.invoiceId)).toEqual([inv.id])
  })

  // Régression corrigée le 29/09/2026 (src/actions/urssaf.ts:158-163 et :192-197) — les invoiceId/revenueId des
  // lignes ne sont pas contrôlés : un compte peut rattacher la facture d'un AUTRE
  // compte à sa déclaration. Le lien étant unique, la facture disparaît alors des
  // suggestions de son propriétaire, qui ne peut plus la déclarer ni l'exclure.
  it("une déclaration refuse une facture d'un autre compte", async () => {
    const victim = await asNewUser()
    const vClient = await makeClient(victim.id)
    const vInv = await makeInvoice(victim.id, vClient.id, { status: "PAID", totalHT: 800 })
    await prisma.invoice.update({ where: { id: vInv.id }, data: { paidAt: at("2026-05-10") } })

    await asNewUser()
    await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", invoiceId: vInv.id, label: "x", amount: 800 }] }).catch(() => ({}))
    expect(await prisma.urssafDeclarationLine.count({ where: { invoiceId: vInv.id } })).toBe(0)

    setTestUser(victim.id)
    expect((await suggestDeclarationLines("2026-T2")).map((l) => l.invoiceId)).toEqual([vInv.id])
  })

  // Régression corrigée le 29/09/2026 (src/actions/urssaf.ts:216) — markUrssafDeclared ne regarde pas le statut :
  // rappelée sur une déclaration déjà PAYÉE, elle la fait régresser en DECLARED.
  it("marquer « déclarée » une déclaration payée ne la fait pas régresser", async () => {
    await asNewUser()
    const { id } = await createUrssafDeclaration({ period: "2026-T2", lines: [] })
    await markUrssafPaid(id!, { paidAt: at("2026-08-05"), cotisations: 10, cfp: 0, versementLiberatoire: 0 })
    await markUrssafDeclared(id!, at("2026-08-06")).catch(() => ({}))
    expect((await declOf(id!)).status).toBe("PAID")
  })
})

describe("rappel de déclaration (ensureUrssafReminderTask)", () => {
  it("crée une seule tâche pour la période échue, datée au 1er jour déclarable (minuit Paris)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(at("2026-07-15"))
    try {
      const user = await asNewUser()
      await ensureUrssafReminderTask("ignored", "QUARTERLY")
      await ensureUrssafReminderTask("ignored", "QUARTERLY")
      const tasks = await prisma.task.findMany({ where: { userId: user.id } })
      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toMatchObject({ urssafPeriod: "2026-T2", priority: "MEDIUM", status: "TODO" })
      expect(tasks[0].title).toContain("T2 2026")
      expect(zonedDateKey(tasks[0].dueDate!)).toBe("2026-07-01")
      expect(isZonedAllDay(tasks[0].dueDate!)).toBe(true)

      await ensureUrssafReminderTask("ignored", "MONTHLY")
      const monthly = await prisma.task.findFirstOrThrow({ where: { userId: user.id, urssafPeriod: "2026-06" } })
      expect(zonedDateKey(monthly.dueDate!)).toBe("2026-07-01")
    } finally {
      vi.useRealTimers()
    }
  })

  it("déclaration déjà saisie : solde la tâche ouverte, n'en crée pas si elle n'existe pas", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(at("2026-07-15"))
    try {
      const user = await asNewUser()
      const task = await prisma.task.create({ data: { userId: user.id, title: "Déclarer", urssafPeriod: "2026-T2" } })
      await createUrssafDeclaration({ period: "2026-T2", lines: [] })
      await ensureUrssafReminderTask("ignored", "QUARTERLY")
      expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("DONE")

      await createUrssafDeclaration({ period: "2026-06", lines: [] })
      await ensureUrssafReminderTask("ignored", "MONTHLY")
      expect(await prisma.task.count({ where: { userId: user.id } })).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("l'identité vient de la session : l'argument est ignoré, sans session → erreur", async () => {
    const victim = await makeUser()
    const caller = await asNewUser()
    await ensureUrssafReminderTask(victim.id, "QUARTERLY")
    expect(await prisma.task.count({ where: { userId: victim.id } })).toBe(0)
    expect(await prisma.task.count({ where: { userId: caller.id } })).toBe(1)

    vi.mocked(auth).mockResolvedValueOnce(null as never)
    await expect(ensureUrssafReminderTask(victim.id, "QUARTERLY")).rejects.toThrow(/Non authentifié/)
  })
})

describe("drapeaux fiscaux", () => {
  it("exclusion d'une facture : bascule dans les deux sens, refusée si déjà déclarée ou d'un autre compte", async () => {
    const user = await asNewUser()
    const client = await makeClient(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "PAID", totalHT: 100 })

    expect(await setInvoiceUrssafExcluded(inv.id, true)).toEqual({})
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).urssafExcluded).toBe(true)
    await setInvoiceUrssafExcluded(inv.id, false)
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).urssafExcluded).toBe(false)

    await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", invoiceId: inv.id, label: "F", amount: 100 }] })
    expect((await setInvoiceUrssafExcluded(inv.id, true)).error).toMatch(/liée à une déclaration/)
    // Ré-inclure une facture déclarée reste permis (no-op).
    expect(await setInvoiceUrssafExcluded(inv.id, false)).toEqual({})

    await asNewUser()
    expect((await setInvoiceUrssafExcluded(inv.id, true)).error).toMatch(/introuvable/)
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).urssafExcluded).toBe(false)
  })

  it("catégorie fiscale par défaut d'un contact : posée, effacée ; contact d'autrui refusé", async () => {
    const user = await asNewUser()
    const client = await makeClient(user.id)
    expect(await setClientFiscalCategory(client.id, "BIC_SERVICES")).toEqual({})
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).defaultFiscalCategory).toBe("BIC_SERVICES")
    await setClientFiscalCategory(client.id, null)
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).defaultFiscalCategory).toBeNull()

    await asNewUser()
    expect((await setClientFiscalCategory(client.id, "BNC")).error).toMatch(/introuvable/)
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).defaultFiscalCategory).toBeNull()
  })
})
