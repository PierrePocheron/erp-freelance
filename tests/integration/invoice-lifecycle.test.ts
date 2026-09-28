import { describe, it, expect, vi } from "vitest"
import {
  issueInvoice,
  cancelInvoice,
  duplicateInvoiceAsDraft,
  addInvoiceLine,
  updateInvoiceConditions,
  markLateInvoices,
} from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeInvoice } from "./helpers/factories"

describe("cycle de vie d'une facture", () => {
  it("émission : DRAFT → ISSUED, fige le PDF (pdfUrl) et date d'émission", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const inv = await makeInvoice(user.id, client.id, {
      lines: [{ description: "Dev", quantity: 1, unitPrice: 1000, taxRate: 20 }],
    })
    setTestUser(user.id)

    await issueInvoice(inv.id, "ignored")

    const after = await prisma.invoice.findUnique({ where: { id: inv.id } })
    expect(after?.status).toBe("ISSUED")
    expect(after?.issuedAt).not.toBeNull()
    expect(after?.pdfUrl).toMatch(/^https:\/\/blob\.test\//) // put() mocké
  })

  it("une facture émise est verrouillée : on ne peut plus ajouter de ligne", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "ISSUED" })
    setTestUser(user.id)

    await expect(
      addInvoiceLine(inv.id, "ignored", { description: "X", quantity: 1, unitPrice: 50 })
    ).rejects.toThrow(/verrouillée/i)
  })

  it("on ne peut émettre qu'un brouillon", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "ISSUED" })
    setTestUser(user.id)

    await expect(issueInvoice(inv.id, "ignored")).rejects.toThrow(/brouillon/i)
  })

  it("annulation : une facture émise passe en CANCELLED (numéro conservé)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const inv = await makeInvoice(user.id, client.id, { status: "ISSUED" })
    setTestUser(user.id)

    await cancelInvoice(inv.id, "ignored")

    const after = await prisma.invoice.findUnique({ where: { id: inv.id } })
    expect(after?.status).toBe("CANCELLED")
    expect(after?.cancelledAt).not.toBeNull()
    expect(after?.number).toBe(inv.number) // numéro légal non réutilisé
  })

  it("on ne peut pas annuler un brouillon ni une facture déjà annulée", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const draft = await makeInvoice(user.id, client.id, { status: "DRAFT" })
    const cancelled = await makeInvoice(user.id, client.id, { status: "CANCELLED" })
    setTestUser(user.id)

    await expect(cancelInvoice(draft.id, "ignored")).rejects.toThrow(/ne peut pas être annulée/i)
    await expect(cancelInvoice(cancelled.id, "ignored")).rejects.toThrow(/ne peut pas être annulée/i)
  })

  it("duplication : recrée un brouillon éditable avec un nouveau numéro et les mêmes lignes", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const source = await makeInvoice(user.id, client.id, {
      status: "CANCELLED",
      type: "FINAL",
      depositDeducted: 200,
      lines: [
        { description: "Ligne A", quantity: 2, unitPrice: 100, taxRate: 20 },
        { description: "Ligne B", quantity: 1, unitPrice: 300, taxRate: 0 },
      ],
    })
    setTestUser(user.id)

    const draft = await duplicateInvoiceAsDraft(source.id, "ignored")
    const full = await prisma.invoice.findUnique({ where: { id: draft.id }, include: { lines: true } })

    expect(full?.status).toBe("DRAFT")
    expect(full?.number).not.toBe(source.number)
    expect(full?.totalHT).toBe(source.totalHT)
    expect(full?.depositDeducted).toBe(200)
    expect(full?.lines).toHaveLength(2)
    // Le brouillon dupliqué est de nouveau éditable.
    await expect(updateInvoiceConditions(draft.id, "ignored", "CGV maj")).resolves.not.toThrow()
  })

  it("la duplication conserve l'émetteur et les conditions générales", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)
    const emitter = await prisma.emitterProfile.create({
      data: { userId: user.id, name: "Agence Démo", isDefault: true },
      select: { id: true },
    })
    const source = await prisma.invoice.create({
      data: {
        userId: user.id, clientId: client.id, emitterProfileId: emitter.id,
        number: "FAC-2026-900", type: "FINAL", status: "CANCELLED",
        totalHT: 1000, depositDeducted: 0, generalConditions: "CGV maison",
        lines: { create: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 0, total: 1000 }] },
      },
      select: { id: true },
    })

    await duplicateInvoiceAsDraft(source.id, "ignored")

    // Sans ces deux champs, le PDF ré-émis retombait sur le profil utilisateur
    // (mauvais SIRET/IBAN) et la facture quittait le récapitulatif fiscal, qui
    // exige un émetteur rattaché à une source fiscale.
    const dup = await prisma.invoice.findFirstOrThrow({
      where: { userId: user.id, status: "DRAFT" },
      select: { emitterProfileId: true, generalConditions: true },
    })
    expect(dup.emitterProfileId).toBe(emitter.id)
    expect(dup.generalConditions).toBe("CGV maison")
  })

  it("markLateInvoices ne bascule que les factures ENVOYÉES et échues", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 6, 15, 10, 0, 0)) // 15 juillet 2026
    try {
      const user = await makeUser()
      const client = await makeClient(user.id)
      setTestUser(user.id)

      const mk = (status: string, dueDate: Date | null) =>
        makeInvoice(user.id, client.id, { status, totalHT: 100 }).then((inv) =>
          prisma.invoice.update({ where: { id: inv.id }, data: { dueDate }, select: { id: true } }),
        )
      const echue      = await mk("SENT", new Date(2026, 6, 14))
      const aVenir     = await mk("SENT", new Date(2026, 6, 16))
      const sansEcheance = await mk("SENT", null)
      const emise      = await mk("ISSUED", new Date(2026, 6, 1))
      const payee      = await mk("PAID", new Date(2026, 6, 1))

      const autre = await makeUser()
      const autreClient = await makeClient(autre.id)
      const inv = await makeInvoice(autre.id, autreClient.id, { status: "SENT", totalHT: 100 })
      await prisma.invoice.update({ where: { id: inv.id }, data: { dueDate: new Date(2026, 6, 1) } })

      await markLateInvoices("ignored")

      const statut = async (id: string) =>
        (await prisma.invoice.findUniqueOrThrow({ where: { id } })).status
      expect(await statut(echue.id)).toBe("LATE")
      expect(await statut(aVenir.id)).toBe("SENT")
      expect(await statut(sansEcheance.id)).toBe("SENT")
      // Documente un trou connu : une facture émise mais jamais envoyée n'est
      // jamais marquée en retard.
      expect(await statut(emise.id)).toBe("ISSUED")
      expect(await statut(payee.id)).toBe("PAID")
      // Le compte voisin n'est pas touché.
      expect(await statut(inv.id)).toBe("SENT")
    } finally {
      vi.useRealTimers()
    }
  })
})
