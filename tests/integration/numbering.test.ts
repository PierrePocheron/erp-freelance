import { describe, it, expect } from "vitest"
import { createInvoice } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// La numérotation s'appuie sur count(startsWith scopePrefix)+1. Sans profil,
// les valeurs par défaut s'appliquent : préfixe FAC, format PREFIX-YYYY-NNN.
// On ne fige pas l'année (horloge réelle) → on teste la séquence et le scoping.

describe("numérotation des factures", () => {
  it("incrémente la séquence sur des numéros consécutifs zero-paddés", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const a = await createInvoice("ignored", { clientId: client.id })
    const b = await createInvoice("ignored", { clientId: client.id })
    const c = await createInvoice("ignored", { clientId: client.id })

    expect(a.number).toMatch(/^FAC-\d{4}-001$/)
    expect(b.number).toMatch(/^FAC-\d{4}-002$/)
    expect(c.number).toMatch(/^FAC-\d{4}-003$/)
  })

  it("ne compte que les numéros du même scope (préfixe/année)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    // Une facture hors-scope (autre préfixe) ne doit pas décaler la séquence.
    await prisma.invoice.create({
      data: { userId: user.id, clientId: client.id, number: "OLD-2000-042", type: "STANDALONE" },
    })

    const first = await createInvoice("ignored", { clientId: client.id })
    expect(first.number).toMatch(/-001$/)
  })

  it("isole la séquence par utilisateur (multi-tenant)", async () => {
    const userA = await makeUser()
    const clientA = await makeClient(userA.id)
    const userB = await makeUser()
    const clientB = await makeClient(userB.id)

    setTestUser(userA.id)
    await createInvoice("ignored", { clientId: clientA.id })
    const a2 = await createInvoice("ignored", { clientId: clientA.id })
    expect(a2.number).toMatch(/-002$/)

    // B repart à 001 malgré les factures de A.
    setTestUser(userB.id)
    const b1 = await createInvoice("ignored", { clientId: clientB.id })
    expect(b1.number).toMatch(/-001$/)
  })

  it("respecte le format du profil (PREFIX-YYMM-NN) quand il existe", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    await prisma.userProfile.create({
      data: { userId: user.id, invoicePrefix: "F", invoiceNumberFormat: "PREFIX-YYMM-NN" },
    })
    setTestUser(user.id)

    const inv = await createInvoice("ignored", { clientId: client.id })
    // F-AAMM-01 : préfixe court + 2 chiffres
    expect(inv.number).toMatch(/^F-\d{4}-01$/)
  })
})
