import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendInvoiceEmail } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeInvoice } from "./helpers/factories"

// Le document doit partir en PIÈCE JOINTE : les mails annonçaient « ci-joint »
// mais ne portaient qu'un lien vers /api/pdf/…, route protégée par session — le
// client recevait « Unauthorized ». Resend est mocké à la frontière (@/lib/resend).

const send = vi.hoisted(() => vi.fn())
vi.mock("@/lib/resend", () => ({ getResend: () => ({ emails: { send } }) }))

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue({ data: { id: "msg-1" }, error: null })
})

describe("envoi d'une facture par email", () => {
  it("joint le PDF de la facture au message", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id, { name: "Globex", email: "compta@example.test" })
    const invoice = await makeInvoice(user.id, client.id, {
      number: "FAC-2026-777", status: "ISSUED", totalHT: 1000,
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 0 }],
    })
    setTestUser(user.id)

    await sendInvoiceEmail(invoice.id, "ignored")

    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.to).toBe("compta@example.test")
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments[0].filename).toBe("FAC-2026-777.pdf")
    // Un vrai PDF rendu, pas un buffer vide
    expect(payload.attachments[0].content.subarray(0, 4).toString()).toBe("%PDF")
    // Plus aucun lien vers la route authentifiée
    expect(payload.html).not.toContain("/api/pdf/")
  })

  it("refuse un second envoi de la même facture (le double clic n'envoie pas deux fois)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id, { name: "Globex", email: "compta@example.test" })
    const invoice = await makeInvoice(user.id, client.id, {
      number: "FAC-2026-778", status: "ISSUED", totalHT: 500,
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 500, taxRate: 0 }],
    })
    setTestUser(user.id)

    await sendInvoiceEmail(invoice.id, "ignored")
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("SENT")

    await expect(sendInvoiceEmail(invoice.id, "ignored")).rejects.toThrow(/déjà envoyée|introuvable/i)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("refuse la facture d'un autre compte (anti-IDOR)", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id, { name: "Privé", email: "prive@example.test" })
    const invoice = await makeInvoice(victim.id, victimClient.id, { number: "FAC-2026-779", status: "ISSUED", totalHT: 100 })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    await expect(sendInvoiceEmail(invoice.id, "ignored")).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
  })
})
