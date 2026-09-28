import { describe, it, expect } from "vitest"
import {
  suggestDeclarationLines,
  createUrssafDeclaration,
  updateUrssafDeclarationLines,
  markUrssafPaid,
  setInvoiceUrssafExcluded,
} from "@/actions/urssaf"
import { prisma } from "@/lib/prisma"
import { zonedDateKey } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeInvoice, makeFiscalSource } from "./helpers/factories"

// Assiette URSSAF : c'est le NET encaissé qui se déclare, une seule fois, et
// seulement ce qui relève de l'auto-entreprise. Aucune de ces règles n'était
// couverte par un test alors qu'une erreur s'y paie en cotisations.

// Dates construites par composantes (jamais `new Date("2026-05-10")`, qui est
// minuit UTC) pour rester dans les bornes du trimestre quel que soit le fuseau.
const T2 = { may10: new Date(2026, 4, 10), jun20: new Date(2026, 5, 20), may15: new Date(2026, 4, 15) }

describe("assiette URSSAF proposée", () => {
  it("déclare le NET : la facture de solde déduit l'acompte déjà facturé", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id, { name: "Globex" })
    setTestUser(user.id)

    const acompte = await makeInvoice(user.id, client.id, { type: "DEPOSIT", status: "PAID", totalHT: 300 })
    await prisma.invoice.update({ where: { id: acompte.id }, data: { paidAt: T2.may10 } })
    const solde = await makeInvoice(user.id, client.id, { type: "FINAL", status: "PAID", totalHT: 1000, depositDeducted: 300 })
    await prisma.invoice.update({ where: { id: solde.id }, data: { paidAt: T2.jun20 } })

    const lines = await suggestDeclarationLines("2026-T2")

    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.amount).sort((a, b) => a - b)).toEqual([300, 700])
    // 1 000 € encaissés au total, jamais 1 300 : l'acompte ne compte qu'une fois.
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(1000)
    expect(lines.every((l) => l.defaultIncluded)).toBe(true)
  })

  it("propose une facture émise non encaissée, sans la pré-cocher", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "SENT", totalHT: 500 })
    await prisma.invoice.update({ where: { id: inv.id }, data: { sentAt: T2.may15 } })

    const lines = await suggestDeclarationLines("2026-T2")

    expect(lines).toHaveLength(1)
    expect(lines[0].amount).toBe(500)
    expect(lines[0].defaultIncluded).toBe(false)
  })

  it("exclut brouillon, annulée, exclue à la main, déjà déclarée, autre bucket et autre compte", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const mk = async (status: string, totalHT: number) => {
      const inv = await makeInvoice(user.id, client.id, { status, totalHT })
      await prisma.invoice.update({ where: { id: inv.id }, data: { paidAt: T2.may15 } })
      return inv
    }
    await mk("DRAFT", 100)
    await mk("CANCELLED", 200)
    const exclue = await mk("PAID", 300)
    await setInvoiceUrssafExcluded(exclue.id, true)
    const dejaDeclaree = await mk("PAID", 400)
    await createUrssafDeclaration({
      period: "2026-T1",
      lines: [{ category: "BNC", invoiceId: dejaDeclaree.id, label: "déjà", amount: 400 }],
    })
    await mk("PAID", 500) // la seule attendue

    const nonImposable = await makeFiscalSource(user.id, { bucket: "NON_IMPOSABLE" })
    const ae = await makeFiscalSource(user.id, { bucket: "AE_URSSAF" })
    await prisma.revenue.create({
      data: { userId: user.id, type: "STUDY", label: "Étude", amount: 600, status: "RECEIVED", receivedAt: T2.may15, fiscalSourceId: nonImposable.id },
    })
    await prisma.revenue.create({
      data: { userId: user.id, type: "FREELANCE", label: "Presta", amount: 700, status: "RECEIVED", receivedAt: T2.may15, fiscalSourceId: ae.id },
    })

    const autre = await makeUser()
    const autreClient = await makeClient(autre.id)
    const invAutre = await makeInvoice(autre.id, autreClient.id, { status: "PAID", totalHT: 900 })
    await prisma.invoice.update({ where: { id: invAutre.id }, data: { paidAt: T2.may15 } })

    const lines = await suggestDeclarationLines("2026-T2")

    expect(lines.map((l) => l.amount).sort((a, b) => a - b)).toEqual([500, 700])
  })

  it("reprend la catégorie fiscale par défaut du client", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id, { defaultFiscalCategory: "BIC_SERVICES" })
    setTestUser(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "PAID", totalHT: 800 })
    await prisma.invoice.update({ where: { id: inv.id }, data: { paidAt: T2.may15 } })

    const lines = await suggestDeclarationLines("2026-T2")
    expect(lines[0].category).toBe("BIC_SERVICES")
  })
})

describe("déclaration URSSAF", () => {
  it("ventile par catégorie, pose les bornes et l'échéance, refuse un doublon de période", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const res = await createUrssafDeclaration({
      period: "2026-T2",
      lines: [
        { category: "BNC", label: "F1", amount: 1000 },
        { category: "BNC", label: "F2", amount: 234.5 },
        { category: "BIC_SERVICES", label: "F3", amount: 500 },
      ],
    })
    expect(res.id).toBeTruthy()

    const decl = await prisma.urssafDeclaration.findUniqueOrThrow({
      where: { id: res.id! }, include: { lines: true },
    })
    expect(decl.amountBNC).toBe(1234.5)
    expect(decl.amountBICServices).toBe(500)
    expect(decl.amountBICSales).toBe(0)
    expect(decl.status).toBe("DRAFT")
    expect(decl.lines).toHaveLength(3)
    // Dates lues en heure de PARIS : `getMonth()/getDate()` suivent le fuseau du
    // process, donc renverraient le 31 mars sur une machine en UTC (la CI, et la
    // production). C'est exactement le décalage que ces bornes corrigent.
    expect(zonedDateKey(decl.periodStart)).toBe("2026-04-01")
    expect(zonedDateKey(decl.periodEnd)).toBe("2026-06-30")
    expect(zonedDateKey(decl.dueDate!)).toBe("2026-07-31")

    const doublon = await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", label: "X", amount: 1 }] })
    expect(doublon.error).toMatch(/existe déjà/i)
    expect(await prisma.urssafDeclaration.count({ where: { userId: user.id } })).toBe(1)
  })

  it("une facture déclarée ne peut plus l'être ailleurs (lien 1-1)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "PAID", totalHT: 1000 })
    await prisma.invoice.update({ where: { id: inv.id }, data: { paidAt: T2.may15 } })

    await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", invoiceId: inv.id, label: "F", amount: 1000 }] })

    // Elle disparaît des suggestions du trimestre suivant : pas de double déclaration.
    const inv2 = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { urssafLine: true } })
    expect(inv2.urssafLine).not.toBeNull()
  })

  it("ne modifie plus les lignes d'une déclaration sortie du brouillon", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const res = await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", label: "F1", amount: 100 }] })
    await prisma.urssafDeclaration.update({ where: { id: res.id! }, data: { status: "DECLARED" } })

    const out = await updateUrssafDeclarationLines(res.id!, [{ category: "BNC", label: "F2", amount: 999 }])

    expect(out.error).toBeTruthy()
    const decl = await prisma.urssafDeclaration.findUniqueOrThrow({ where: { id: res.id! }, include: { lines: true } })
    expect(decl.lines).toHaveLength(1)
    expect(decl.lines[0].amount).toBe(100)
  })

  it("refuse la déclaration d'un autre compte (anti-IDOR)", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    const res = await createUrssafDeclaration({ period: "2026-T2", lines: [{ category: "BNC", label: "F1", amount: 100 }] })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    const upd = await updateUrssafDeclarationLines(res.id!, [{ category: "BNC", label: "pwned", amount: 1 }])
    expect(upd.error).toBeTruthy()
    const paid = await markUrssafPaid(res.id!, { paidAt: new Date(2026, 6, 20), cotisations: 42, cfp: 1, versementLiberatoire: 0 })
    expect(paid.error).toBeTruthy()

    const decl = await prisma.urssafDeclaration.findUniqueOrThrow({ where: { id: res.id! }, include: { lines: true } })
    expect(decl.lines[0].label).toBe("F1")
    expect(decl.status).toBe("DRAFT")
  })
})
