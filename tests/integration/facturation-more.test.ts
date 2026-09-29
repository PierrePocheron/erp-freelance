import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createQuoteWithLines,
  updateQuoteStatus,
  revertQuoteToDraft,
  updateQuoteSettings,
  updateQuoteNotes,
  deleteQuote,
  addQuoteLine,
  updateQuoteLine,
  deleteQuoteLine,
  signQuoteWithFile,
  createInvoice,
  createInvoiceFromQuote,
  createInvoiceFromRenewal,
  recordPayment,
  deletePayment,
  markLateInvoices,
  updateInvoiceStatus,
  issueInvoice,
  cancelInvoice,
  duplicateInvoiceAsDraft,
  updateInvoiceDueDate,
  updateInvoiceNotes,
  updateInvoiceConditions,
  updateInvoiceEmitter,
  deleteInvoice,
  addInvoiceLine,
  updateInvoiceLine,
  deleteInvoiceLine,
  createProduct,
  updateProduct,
  deleteProduct,
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  generateInvoiceFromRecurring,
  setRecurringInvoiceLines,
  resendQuoteEmail,
  sendQuoteEmail,
  sendInvoiceEmail,
  sendInvoiceReminder,
  importHistoricalInvoice,
  getMonthlyRevenue,
} from "@/actions/facturation"
import { createEmitter } from "@/actions/emitter"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { put } from "@vercel/blob"
import { zonedDateKey, isZonedAllDay, parseCivilDate, zonedInstant, daysLate } from "@/lib/dates"
import { setTestUser } from "./setup"
import {
  makeUser,
  makeClient,
  makeProject,
  makeQuote,
  makeInvoice,
  makeRenewalChain,
} from "./helpers/factories"

// Resend mocké à la frontière (aucun envoi réel) — même point d'injection que
// tests/integration/invoice-email.test.ts.
const send = vi.hoisted(() => vi.fn())
vi.mock("@/lib/resend", () => ({ getResend: () => ({ emails: { send } }) }))

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue({ data: { id: "msg-test" }, error: null })
})

const line = (description: string, quantity: number, unitPrice: number, taxRate = 0) => ({
  description, quantity, unitPrice, taxRate,
})

async function owner(clientOverrides: Record<string, unknown> = {}) {
  const user = await makeUser()
  const client = await makeClient(user.id, { name: "Client Fictif", ...clientOverrides })
  setTestUser(user.id)
  return { user, client }
}

async function intruder() {
  const other = await makeUser()
  setTestUser(other.id)
  return other
}

const inv = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id }, include: { lines: true, payments: true } })
const quo = (id: string) => prisma.quote.findUniqueOrThrow({ where: { id }, include: { lines: true } })

// ── Devis ─────────────────────────────────────────────────────────────────────

describe("devis — création et numérotation", () => {
  it("création de devis : numéro DEV-AAAA-001 par défaut, puis format/préfixe du profil ; validité", async () => {
    const { user, client } = await owner()
    const before = Date.now()
    const q1 = await createQuoteWithLines("ignored", { clientId: client.id, expiresAtDays: 30, depositPercent: 25, lines: [] })
    expect(q1.number).toMatch(/^DEV-\d{4}-001$/)
    expect(q1.userId).toBe(user.id)
    expect(q1.depositPercent).toBe(25)
    expect(q1.emitterProfileId).toBeNull()
    const days = (q1.expiresAt!.getTime() - before) / 86_400_000
    expect(days).toBeGreaterThan(29.99)
    expect(days).toBeLessThan(30.01)

    const q2 = await createQuoteWithLines("ignored", { clientId: client.id, lines: [] })
    expect(q2.number).toMatch(/^DEV-\d{4}-002$/)
    expect(q2.expiresAt).toBeNull()
    expect(q2.notes).toBeNull()

    await prisma.userProfile.create({ data: { userId: user.id, quotePrefix: "DQ", quoteNumberFormat: "PREFIX-YYYY-NN" } })
    const q3 = await createQuoteWithLines("ignored", { clientId: client.id, lines: [] })
    expect(q3.number).toMatch(/^DQ-\d{4}-01$/)
  })

  it("la création de devis refuse le contact ou le projet d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const vProject = await makeProject(victim.id, vClient.id)
    const other = await intruder()
    const own = await makeClient(other.id)

    await expect(createQuoteWithLines("ignored", { clientId: vClient.id, lines: [] })).rejects.toThrow(/Contact introuvable/)
    await expect(createQuoteWithLines("ignored", { clientId: own.id, projectId: vProject.id, lines: [] })).rejects.toThrow(/Projet introuvable/)
    expect(await prisma.quote.count()).toBe(0)
  })

  it("createQuoteWithLines : lignes détaillées, total calculé, émetteur mémorisé du client (dernière facture)", async () => {
    const { user, client } = await owner()
    await createEmitter({ name: "Émetteur A" }) // défaut
    const b = await createEmitter({ name: "Émetteur B" })
    const product = await createProduct("ignored", { name: "Forfait", unitPrice: 100 })
    const project = await makeProject(user.id, client.id)
    const past = await makeInvoice(user.id, client.id, { totalHT: 10 })
    await prisma.invoice.update({ where: { id: past.id }, data: { emitterProfileId: b.id } })

    const q = await createQuoteWithLines("ignored", {
      clientId: client.id,
      projectId: project.id,
      depositPercent: 30,
      expiresAtDays: 15,
      generalConditions: "CGV fictives",
      lines: [
        { ...line("Maquette", 2, 150, 20), detail: "2 écrans", billingType: "MONTHLY", productId: product.id },
        line("Intégration", 1, 400),
      ],
    })
    const saved = await quo(q.id)
    expect(saved.totalHT).toBe(700)
    expect(saved.emitterProfileId).toBe(b.id)
    expect(saved.projectId).toBe(project.id)
    expect(saved.generalConditions).toBe("CGV fictives")
    expect(saved.expiresAt).not.toBeNull()
    const maquette = saved.lines.find((l) => l.description === "Maquette")!
    expect(maquette).toMatchObject({ detail: "2 écrans", total: 300, taxRate: 20, billingType: "MONTHLY", productId: product.id })
    const integ = saved.lines.find((l) => l.description === "Intégration")!
    expect(integ).toMatchObject({ detail: null, billingType: "ONE_SHOT", productId: null })
  })

  it("createInvoice reprend l'émetteur du dernier DEVIS du client à défaut de facture", async () => {
    const { user, client } = await owner()
    await createEmitter({ name: "Défaut" })
    const b = await createEmitter({ name: "Spécifique" })
    const q = await makeQuote(user.id, client.id, { totalHT: 10 })
    await prisma.quote.update({ where: { id: q.id }, data: { emitterProfileId: b.id } })

    const invoice = await createInvoice("ignored", { clientId: client.id })
    expect(invoice.emitterProfileId).toBe(b.id)
  })
})

describe("devis — lignes et verrouillage", () => {
  it("ajout, modification, suppression de ligne recalculent le total HT", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, { lines: [{ description: "Base", quantity: 1, unitPrice: 100 }] })

    await addQuoteLine(q.id, "ignored", { description: "Option", quantity: 3, unitPrice: 50, detail: "détail" })
    let saved = await quo(q.id)
    expect(saved.totalHT).toBe(250)
    const option = saved.lines.find((l) => l.description === "Option")!
    expect(option).toMatchObject({ total: 150, taxRate: 0, detail: "détail", productId: null })

    await updateQuoteLine(option.id, { description: "Option+", quantity: 2, unitPrice: 75, taxRate: 20 })
    saved = await quo(q.id)
    expect(saved.totalHT).toBe(250)
    expect(saved.lines.find((l) => l.id === option.id)).toMatchObject({ description: "Option+", total: 150, taxRate: 20, detail: null })

    await deleteQuoteLine(option.id)
    saved = await quo(q.id)
    expect(saved.lines).toHaveLength(1)
    expect(saved.totalHT).toBe(100)
  })

  it("un devis sorti du brouillon refuse toute modification (lignes, réglages, notes)", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, { status: "VALIDATED", lines: [{ description: "Base", quantity: 1, unitPrice: 100 }] })
    const lineId = q.lines[0].id

    await expect(addQuoteLine(q.id, "ignored", line("X", 1, 1))).rejects.toThrow(/verrouillé/)
    await expect(updateQuoteLine(lineId, line("X", 9, 9))).rejects.toThrow(/verrouillé/)
    await expect(deleteQuoteLine(lineId)).rejects.toThrow(/verrouillé/)
    await expect(updateQuoteSettings(q.id, "ignored", { notes: "x" })).rejects.toThrow(/verrouillé/)
    await expect(updateQuoteNotes(q.id, "ignored", "x")).rejects.toThrow(/verrouillé/)

    const saved = await quo(q.id)
    expect(saved.lines).toHaveLength(1)
    expect(saved.lines[0].total).toBe(100)
    expect(saved.notes).toBeNull()
  })

  it("lignes et réglages d'un devis d'un autre compte : refusés, rien ne bouge", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const q = await makeQuote(victim.id, vClient.id, { lines: [{ description: "Base", quantity: 1, unitPrice: 100 }] })
    await intruder()

    await expect(addQuoteLine(q.id, "ignored", line("X", 1, 1))).rejects.toThrow(/Devis introuvable/)
    await expect(updateQuoteLine(q.lines[0].id, line("X", 9, 9))).rejects.toThrow(/Non autorisé/)
    await expect(deleteQuoteLine(q.lines[0].id)).rejects.toThrow(/Non autorisé/)
    await expect(updateQuoteSettings(q.id, "ignored", { depositPercent: 99 })).rejects.toThrow(/Devis introuvable/)
    await expect(updateQuoteNotes(q.id, "ignored", "pwn")).rejects.toThrow(/Devis introuvable/)
    await expect(revertQuoteToDraft(q.id, "ignored")).rejects.toThrow(/Devis introuvable/)
    await expect(updateQuoteStatus(q.id, "ignored", "ACCEPTED")).rejects.toThrow()
    await expect(signQuoteWithFile(q.id, "ignored", "https://evil.test/x.pdf")).rejects.toThrow()
    await expect(deleteQuote(q.id, "ignored")).rejects.toThrow()

    const saved = await quo(q.id)
    expect(saved).toMatchObject({ status: "DRAFT", totalHT: 100, depositPercent: 0, notes: null, signedFileUrl: null })
    expect(saved.lines).toHaveLength(1)
  })

  it("updateQuoteSettings : échéance à minuit Paris, champs partiels, effacement", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, { generalConditions: "CGV v1" })

    await updateQuoteSettings(q.id, "ignored", { expiresAt: "2026-10-31", depositPercent: 40, notes: "à relire" })
    let saved = await quo(q.id)
    expect(zonedDateKey(saved.expiresAt!)).toBe("2026-10-31")
    expect(isZonedAllDay(saved.expiresAt!)).toBe(true)
    expect(saved.depositPercent).toBe(40)
    expect(saved.notes).toBe("à relire")
    expect(saved.generalConditions).toBe("CGV v1") // non fourni → intact

    await updateQuoteSettings(q.id, "ignored", { expiresAt: null, generalConditions: null })
    saved = await quo(q.id)
    expect(saved.expiresAt).toBeNull()
    expect(saved.generalConditions).toBeNull()
    expect(saved.depositPercent).toBe(40)

    await updateQuoteNotes(q.id, "ignored", "v2")
    expect((await quo(q.id))).toMatchObject({ notes: "v2", depositPercent: 40 })
    await updateQuoteNotes(q.id, "ignored", null, 10)
    expect((await quo(q.id))).toMatchObject({ notes: null, depositPercent: 10 })
  })
})

describe("devis — statuts", () => {
  it("updateQuoteStatus horodate VALIDATED / SENT / ACCEPTED ; revertQuoteToDraft seulement depuis VALIDATED", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id)

    await updateQuoteStatus(q.id, "ignored", "VALIDATED")
    expect((await quo(q.id)).validatedAt).not.toBeNull()

    await revertQuoteToDraft(q.id, "ignored")
    let saved = await quo(q.id)
    expect(saved.status).toBe("DRAFT")
    expect(saved.validatedAt).toBeNull()

    await updateQuoteStatus(q.id, "ignored", "SENT")
    await expect(revertQuoteToDraft(q.id, "ignored")).rejects.toThrow(/validé non envoyé/)
    expect((await quo(q.id)).sentAt).not.toBeNull()

    await updateQuoteStatus(q.id, "ignored", "ACCEPTED")
    saved = await quo(q.id)
    expect(saved.status).toBe("ACCEPTED")
    expect(saved.acceptedAt).not.toBeNull()

    await signQuoteWithFile(q.id, "ignored", "https://blob.test/devis-signe.pdf")
    expect(await quo(q.id)).toMatchObject({ status: "SIGNED", signedFileUrl: "https://blob.test/devis-signe.pdf" })

    await deleteQuote(q.id, "ignored")
    expect(await prisma.quote.findUnique({ where: { id: q.id } })).toBeNull()
  })
})

// ── Factures ──────────────────────────────────────────────────────────────────

describe("factures — création et édition du brouillon", () => {
  it("createInvoice : échéance à minuit Paris, type, notes, acompte déduit", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, { totalHT: 1000 })
    const invoice = await createInvoice("ignored", {
      clientId: client.id, quoteId: q.id, type: "FINAL", dueDate: "2026-10-31", notes: "Merci", depositDeducted: 300,
    })
    const saved = await inv(invoice.id)
    expect(saved).toMatchObject({ type: "FINAL", status: "DRAFT", notes: "Merci", depositDeducted: 300, quoteId: q.id })
    expect(zonedDateKey(saved.dueDate!)).toBe("2026-10-31")
    expect(isZonedAllDay(saved.dueDate!)).toBe(true)

    const bare = await createInvoice("ignored", { clientId: client.id })
    expect(bare).toMatchObject({ type: "STANDALONE", dueDate: null, notes: null, depositDeducted: 0, quoteId: null })
  })

  it("createInvoice refuse un devis d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const vQuote = await makeQuote(victim.id, vClient.id)
    const other = await intruder()
    const own = await makeClient(other.id)
    await expect(createInvoice("ignored", { clientId: own.id, quoteId: vQuote.id })).rejects.toThrow(/Devis introuvable/)
    expect(await prisma.invoice.count()).toBe(0)
  })

  it("échéance, notes, conditions et lignes d'un brouillon : modifiables, total recalculé", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { lines: [{ description: "Base", quantity: 1, unitPrice: 500 }] })

    await updateInvoiceDueDate(i.id, "ignored", "2026-11-15")
    await updateInvoiceNotes(i.id, "ignored", "Paiement à 30 jours")
    await updateInvoiceConditions(i.id, "ignored", "CGV fictives")
    let saved = await inv(i.id)
    expect(zonedDateKey(saved.dueDate!)).toBe("2026-11-15")
    expect(saved).toMatchObject({ notes: "Paiement à 30 jours", generalConditions: "CGV fictives" })

    await updateInvoiceDueDate(i.id, "ignored", null)
    expect((await inv(i.id)).dueDate).toBeNull()

    const emitter = await createEmitter({ name: "Émetteur fictif" })
    const foreignEmitter = await prisma.emitterProfile.create({ data: { userId: (await makeUser()).id, name: "Autre" } })
    await updateInvoiceEmitter(i.id, emitter.id)
    await expect(updateInvoiceEmitter(i.id, foreignEmitter.id)).rejects.toThrow(/Profil émetteur introuvable/)
    expect((await inv(i.id)).emitterProfileId).toBe(emitter.id)
    await updateInvoiceEmitter(i.id, null)
    expect((await inv(i.id)).emitterProfileId).toBeNull()

    await addInvoiceLine(i.id, "ignored", { description: "Hébergement", quantity: 12, unitPrice: 10, detail: "annuel", taxRate: 20 })
    saved = await inv(i.id)
    expect(saved.totalHT).toBe(620)
    const heb = saved.lines.find((l) => l.description === "Hébergement")!
    expect(heb).toMatchObject({ detail: "annuel", taxRate: 20, total: 120 })

    await updateInvoiceLine(heb.id, { description: "Hébergement", quantity: 6, unitPrice: 10 })
    saved = await inv(i.id)
    expect(saved.totalHT).toBe(560)
    expect(saved.lines.find((l) => l.id === heb.id)).toMatchObject({ total: 60, taxRate: 0, detail: null })

    await deleteInvoiceLine(heb.id)
    saved = await inv(i.id)
    expect(saved.lines).toHaveLength(1)
    expect(saved.totalHT).toBe(500)
  })

  it("une facture émise est figée : échéance, notes, lignes refusées ; rien ne bouge", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { status: "ISSUED", lines: [{ description: "Base", quantity: 1, unitPrice: 500 }] })
    const lineId = i.lines[0].id

    await expect(updateInvoiceDueDate(i.id, "ignored", "2026-12-01")).rejects.toThrow(/verrouillée/)
    await expect(updateInvoiceNotes(i.id, "ignored", "x")).rejects.toThrow(/verrouillée/)
    await expect(updateInvoiceLine(lineId, line("X", 10, 10))).rejects.toThrow(/verrouillée/)
    await expect(deleteInvoiceLine(lineId)).rejects.toThrow(/verrouillée/)

    const saved = await inv(i.id)
    expect(saved).toMatchObject({ dueDate: null, notes: null, totalHT: 500 })
    expect(saved.lines).toHaveLength(1)
  })

  it("brouillon, lignes et statut d'une facture d'un autre compte : refusés", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const i = await makeInvoice(victim.id, vClient.id, { lines: [{ description: "Base", quantity: 1, unitPrice: 500 }] })
    await intruder()

    await expect(updateInvoiceDueDate(i.id, "ignored", "2026-12-01")).rejects.toThrow(/Facture introuvable/)
    await expect(updateInvoiceNotes(i.id, "ignored", "x")).rejects.toThrow(/Facture introuvable/)
    await expect(addInvoiceLine(i.id, "ignored", line("X", 1, 1))).rejects.toThrow(/Facture introuvable/)
    await expect(updateInvoiceLine(i.lines[0].id, line("X", 1, 1))).rejects.toThrow(/Non autorisé/)
    await expect(deleteInvoiceLine(i.lines[0].id)).rejects.toThrow(/Non autorisé/)
    await expect(updateInvoiceStatus(i.id, "ignored", "PAID")).rejects.toThrow()
    await expect(duplicateInvoiceAsDraft(i.id, "ignored")).rejects.toThrow(/Facture introuvable/)

    const saved = await inv(i.id)
    expect(saved).toMatchObject({ status: "DRAFT", totalHT: 500, dueDate: null, notes: null, paidAt: null })
    expect(saved.lines).toHaveLength(1)
    expect(await prisma.invoice.count()).toBe(1)
  })
})

describe("factures — statuts et émission", () => {
  it("updateInvoiceStatus horodate les transitions autorisées (émise → envoyée → payée)", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { totalHT: 100, status: "ISSUED" })
    for (const [status, field] of [["SENT", "sentAt"], ["PAID", "paidAt"]] as const) {
      await updateInvoiceStatus(i.id, "ignored", status)
      const saved = await inv(i.id)
      expect(saved.status).toBe(status)
      expect(saved[field]).not.toBeNull()
    }
  })

  it("updateInvoiceStatus refuse l'émission/annulation (actions dédiées) et un brouillon", async () => {
    const { user, client } = await owner()
    const draft = await makeInvoice(user.id, client.id, { totalHT: 100 })
    for (const status of ["ISSUED", "CANCELLED", "DRAFT"]) {
      await expect(updateInvoiceStatus(draft.id, "ignored", status)).rejects.toThrow()
    }
    await expect(updateInvoiceStatus(draft.id, "ignored", "PAID")).rejects.toThrow()
    expect((await inv(draft.id)).status).toBe("DRAFT")
  })

  it("émission : un échec Blob n'empêche pas l'émission (pdfUrl reste null) ; le numéro est assaini dans le chemin", async () => {
    const { user, client } = await owner()
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const a = await makeInvoice(user.id, client.id, { number: "FAC/2026 01", totalHT: 100 })
      await issueInvoice(a.id, "ignored")
      const savedA = await inv(a.id)
      expect(savedA.status).toBe("ISSUED")
      expect(vi.mocked(put)).toHaveBeenLastCalledWith(
        `factures/${user.id}/FAC-2026-01.pdf`,
        expect.anything(),
        expect.objectContaining({ access: "public", addRandomSuffix: true }),
      )

      vi.mocked(put).mockRejectedValueOnce(new Error("blob indisponible"))
      const b = await makeInvoice(user.id, client.id, { totalHT: 100 })
      await issueInvoice(b.id, "ignored")
      const savedB = await inv(b.id)
      expect(savedB.status).toBe("ISSUED")
      expect(savedB.issuedAt).not.toBeNull()
      expect(savedB.pdfUrl).toBeNull()
      expect(errSpy).toHaveBeenCalled()
    } finally {
      errSpy.mockRestore()
    }
  })

  it("annuler puis dupliquer : la facture annulée reste dans la séquence, le brouillon prend le numéro suivant", async () => {
    const { user, client } = await owner()
    const first = await createInvoice("ignored", { clientId: client.id })
    await addInvoiceLine(first.id, "ignored", line("Mission", 1, 800))
    await issueInvoice(first.id, "ignored")
    await cancelInvoice(first.id, "ignored")
    const dup = await duplicateInvoiceAsDraft(first.id, "ignored")

    const cancelled = await inv(first.id)
    expect(cancelled.status).toBe("CANCELLED")
    expect(cancelled.number).toBe(first.number)
    const draft = await inv(dup.id)
    expect(draft.status).toBe("DRAFT")
    expect(draft.totalHT).toBe(800)
    expect(Number(draft.number.slice(-3))).toBe(Number(first.number.slice(-3)) + 1)
    expect(await prisma.invoice.count({ where: { userId: user.id } })).toBe(2)
  })

  it("deleteInvoice : supprime son propre brouillon, pas celui d'un autre compte", async () => {
    const { user, client } = await owner()
    const mine = await makeInvoice(user.id, client.id)
    await deleteInvoice(mine.id, "ignored")
    expect(await prisma.invoice.findUnique({ where: { id: mine.id } })).toBeNull()

    const kept = await makeInvoice(user.id, client.id)
    await intruder()
    await expect(deleteInvoice(kept.id, "ignored")).rejects.toThrow()
    expect(await prisma.invoice.findUnique({ where: { id: kept.id } })).not.toBeNull()
  })

  // Régression corrigée le 29/09/2026 (src/actions/facturation.ts:760-762) — deleteInvoice ne vérifie pas le
  // statut. L'UI ne propose la suppression qu'en brouillon, mais l'action serveur
  // est un endpoint public : une facture ÉMISE (ou annulée) peut être supprimée
  // définitivement, ce qui ouvre un trou dans la séquence légale de numérotation.
  it("deleteInvoice refuse une facture émise (séquence légale)", async () => {
    const { user, client } = await owner()
    const issued = await makeInvoice(user.id, client.id, { status: "ISSUED", totalHT: 100 })
    await expect(deleteInvoice(issued.id, "ignored")).rejects.toThrow()
    expect(await prisma.invoice.findUnique({ where: { id: issued.id } })).not.toBeNull()
  })

  // Régression corrigée le 29/09/2026 (src/actions/facturation.ts:604-611) — updateInvoiceStatus accepte
  // n'importe quelle transition : repasser une facture émise en DRAFT la rend de
  // nouveau éditable (lignes, montants), contournant le verrou d'émission.
  it("une facture émise ne peut pas repasser en brouillon via updateInvoiceStatus", async () => {
    const { user, client } = await owner()
    const issued = await makeInvoice(user.id, client.id, { status: "ISSUED", totalHT: 100 })
    await expect(updateInvoiceStatus(issued.id, "ignored", "DRAFT")).rejects.toThrow()
    await expect(addInvoiceLine(issued.id, "ignored", line("Ajout", 1, 999))).rejects.toThrow(/verrouillée/)
  })
})

// ── Devis → factures (acompte / intermédiaire / solde) ──────────────────────────

describe("devis → factures", () => {
  it("acompte, acompte intermédiaire puis solde : le solde déduit la somme des acomptes non annulés et se solde au net", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, {
      number: "DEV-TEST-001",
      depositPercent: 30,
      lines: [
        { description: "Conception", quantity: 1, unitPrice: 600 },
        { description: "Développement", quantity: 2, unitPrice: 200 },
      ],
    })
    const dep1 = await createInvoiceFromQuote(q.id, "ignored", "DEPOSIT")
    const dep2 = await createInvoiceFromQuote(q.id, "ignored", "DEPOSIT")
    const dep3 = await createInvoiceFromQuote(q.id, "ignored", "DEPOSIT")
    await prisma.invoice.update({ where: { id: dep3.id }, data: { status: "CANCELLED" } })

    const d1 = await inv(dep1.id)
    expect(d1).toMatchObject({ type: "DEPOSIT", totalHT: 300, depositDeducted: 0 })
    expect(d1.lines).toHaveLength(1)
    expect(d1.lines[0]).toMatchObject({ description: "Acompte 30 % sur devis DEV-TEST-001", total: 300, quantity: 1 })

    const fin = await createInvoiceFromQuote(q.id, "ignored", "FINAL")
    const f = await inv(fin.id)
    expect(f).toMatchObject({ type: "FINAL", totalHT: 1000, depositDeducted: 600 })
    expect(f.lines.map((l) => l.description).sort()).toEqual(["Conception", "Développement"])

    await prisma.invoice.update({ where: { id: fin.id }, data: { status: "SENT" } })
    await recordPayment(fin.id, "ignored", { amount: 399.995, paidAt: "2026-06-10" })
    expect((await inv(fin.id)).status).toBe("PAID") // tolérance d'un centime sur le net (400)
    expect((await inv(dep2.id)).status).toBe("DRAFT")
  })

  it("acompte sans pourcentage, facture récurrente depuis un devis ; devis d'un autre compte refusé", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, {
      number: "DEV-TEST-002",
      generalConditions: "CGV devis",
      lines: [{ description: "Maintenance", quantity: 1, unitPrice: 90, taxRate: 20 }],
    })
    const dep = await inv((await createInvoiceFromQuote(q.id, "ignored", "DEPOSIT")).id)
    expect(dep.lines[0]).toMatchObject({ description: "Acompte sur devis DEV-TEST-002", total: 0, taxRate: 20 })

    const rec = await inv((await createInvoiceFromQuote(q.id, "ignored", "RECURRING")).id)
    // Intermédiaire = brouillon à compléter, pas le total du devis (#14)
    expect(rec).toMatchObject({ type: "RECURRING", totalHT: 0, depositDeducted: 0, generalConditions: "CGV devis" })
    expect(rec.lines).toHaveLength(1)
    expect(rec.lines[0].description).toMatch(/à compléter/)

    // Le solde déduit l'intermédiaire complété
    await prisma.invoice.update({ where: { id: rec.id }, data: { totalHT: 30 } })
    const fin = await inv((await createInvoiceFromQuote(q.id, "ignored", "FINAL")).id)
    expect(fin.depositDeducted).toBe(30)
    await prisma.invoice.delete({ where: { id: fin.id } })

    await intruder()
    await expect(createInvoiceFromQuote(q.id, "ignored", "FINAL")).rejects.toThrow(/Devis introuvable/)
    expect(await prisma.invoice.count({ where: { quoteId: q.id } })).toBe(2)
  })

  it("createInvoiceFromRenewal refuse le renouvellement d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const { renewal } = await makeRenewalChain(victim.id, vClient.id)
    await intruder()
    await expect(createInvoiceFromRenewal(renewal.id, "ignored")).rejects.toThrow(/Renouvellement introuvable/)
    expect(await prisma.invoice.count()).toBe(0)
  })
})

// ── Paiements ─────────────────────────────────────────────────────────────────

describe("paiements", () => {
  it("paiement partiel puis complément : PAID à la date du dernier versement ; suppression → retour SENT", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { status: "SENT", totalHT: 1000 })

    await recordPayment(i.id, "ignored", { amount: 300, paidAt: "2026-05-02", note: "virement 1" })
    let saved = await inv(i.id)
    expect(saved.status).toBe("SENT")
    expect(saved.paidAt).toBeNull()
    expect(saved.payments[0]).toMatchObject({ amount: 300, note: "virement 1" })

    await recordPayment(i.id, "ignored", { amount: 700, paidAt: "2026-05-20" })
    saved = await inv(i.id)
    expect(saved.status).toBe("PAID")
    expect(zonedDateKey(saved.paidAt!)).toBe("2026-05-20")

    // Paiement supplémentaire (trop-perçu) : pas de nouvelle bascule, paidAt inchangé.
    await recordPayment(i.id, "ignored", { amount: 50, paidAt: "2026-06-01" })
    expect(zonedDateKey((await inv(i.id)).paidAt!)).toBe("2026-05-20")

    // Supprimer le trop-perçu : toujours couverte → reste PAID.
    const extra = await prisma.payment.findFirstOrThrow({ where: { invoiceId: i.id, amount: 50 } })
    await deletePayment(extra.id, i.id, "ignored")
    expect((await inv(i.id)).status).toBe("PAID")

    // Supprimer le complément : plus couverte → SENT, paidAt effacé.
    const second = await prisma.payment.findFirstOrThrow({ where: { invoiceId: i.id, amount: 700 } })
    await deletePayment(second.id, i.id, "ignored")
    saved = await inv(i.id)
    expect(saved.status).toBe("SENT")
    expect(saved.paidAt).toBeNull()
    expect(saved.payments).toHaveLength(1)
  })

  it("paiement / suppression de paiement sur la facture d'un autre compte : sans effet", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const i = await makeInvoice(victim.id, vClient.id, { status: "SENT", totalHT: 100 })
    const p = await prisma.payment.create({ data: { invoiceId: i.id, amount: 40, paidAt: new Date("2026-05-01T12:00:00Z") } })
    await intruder()

    await recordPayment(i.id, "ignored", { amount: 100, paidAt: "2026-05-02" })
    await deletePayment(p.id, i.id, "ignored")

    const saved = await inv(i.id)
    expect(saved.status).toBe("SENT")
    expect(saved.payments.map((x) => x.id)).toEqual([p.id])
  })

  // Régression corrigée le 29/09/2026 (src/actions/facturation.ts:519-547) — recordPayment n'examine pas le
  // statut : un paiement saisi sur une facture ANNULÉE la ressuscite en PAID
  // (comptée dans le CA encaissé et pré-cochée dans l'assiette URSSAF).
  it("un paiement sur une facture annulée ne la fait pas passer PAID", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { status: "CANCELLED", totalHT: 100 })
    await recordPayment(i.id, "ignored", { amount: 100, paidAt: "2026-05-02" }).catch(() => {})
    expect((await inv(i.id)).status).toBe("CANCELLED")
  })
})

// ── Emails (Resend mocké) ─────────────────────────────────────────────────────

describe("emails de devis", () => {
  it("sendQuoteEmail : PDF joint, validité en date de Paris, devis passé SENT", async () => {
    const { user, client } = await owner({ email: "client@exemple.test", name: "Client <Fictif>" })
    await prisma.user.update({ where: { id: user.id }, data: { name: "Freelance Test" } })
    const q = await makeQuote(user.id, client.id, { number: "DEV-2026-042", totalHT: 1234.5 })
    await prisma.quote.update({ where: { id: q.id }, data: { expiresAt: parseCivilDate("2026-10-31") } })

    await sendQuoteEmail(q.id, "ignored")

    const payload = send.mock.calls[0][0]
    expect(payload).toMatchObject({ to: "client@exemple.test", subject: "Devis DEV-2026-042" })
    expect(payload.attachments[0].filename).toBe("DEV-2026-042.pdf")
    expect(payload.html).toContain("31/10/2026")
    expect(payload.html).toContain("Client &lt;Fictif&gt;")
    expect(payload.html).toMatch(/1\s234,50\s€/)
    const saved = await quo(q.id)
    expect(saved.status).toBe("SENT")
    expect(saved.sentAt).not.toBeNull()
  })

  it("sendQuoteEmail : sans email client ou en échec Resend → erreur, statut inchangé ; devis d'autrui refusé", async () => {
    const { user, client } = await owner()
    const noMail = await makeQuote(user.id, client.id)
    await expect(sendQuoteEmail(noMail.id, "ignored")).rejects.toThrow(/pas d'adresse email/)

    const withMail = await makeClient(user.id, { email: "ok@exemple.test" })
    const q = await makeQuote(user.id, withMail.id)
    send.mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    await expect(sendQuoteEmail(q.id, "ignored")).rejects.toThrow(/Échec de l'envoi/)
    expect((await quo(q.id)).status).toBe("DRAFT")

    await intruder()
    await expect(sendQuoteEmail(q.id, "ignored")).rejects.toThrow(/Devis introuvable/)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("resendQuoteEmail : relance seulement un devis envoyé", async () => {
    const { user, client } = await owner({ email: "client@exemple.test" })
    const draft = await makeQuote(user.id, client.id)
    await expect(resendQuoteEmail(draft.id, "ignored")).rejects.toThrow(/Devis introuvable/)

    const sent = await makeQuote(user.id, client.id, { number: "DEV-2026-050", status: "SENT", totalHT: 500 })
    await resendQuoteEmail(sent.id, "ignored")
    const payload = send.mock.calls[0][0]
    expect(payload.subject).toBe("Rappel — Devis DEV-2026-050")
    expect(payload.attachments[0].filename).toBe("DEV-2026-050.pdf")
    expect(payload.html).not.toContain("valable jusqu'au")

    const noMailClient = await makeClient(user.id)
    const sentNoMail = await makeQuote(user.id, noMailClient.id, { status: "SENT" })
    await expect(resendQuoteEmail(sentNoMail.id, "ignored")).rejects.toThrow(/pas d'adresse email/)

    send.mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    await expect(resendQuoteEmail(sent.id, "ignored")).rejects.toThrow(/Échec de l'envoi/)

    await intruder()
    await expect(resendQuoteEmail(sent.id, "ignored")).rejects.toThrow(/Devis introuvable/)
    expect(send).toHaveBeenCalledTimes(2)
  })
})

describe("emails de facture", () => {
  it("sendInvoiceEmail : journalise l'envoi ; sans email / échec Resend → erreur sans journal ni changement", async () => {
    const { user, client } = await owner({ email: "compta@exemple.test" })
    const i = await makeInvoice(user.id, client.id, { number: "FAC-2026-100", status: "ISSUED", totalHT: 200 })
    await sendInvoiceEmail(i.id, "ignored")
    const log = await prisma.emailLog.findFirstOrThrow({ where: { invoiceId: i.id } })
    expect(log).toMatchObject({ userId: user.id, to: "compta@exemple.test", subject: "Facture FAC-2026-100", resendMessageId: "msg-test" })
    const sent = await inv(i.id)
    expect(sent.status).toBe("SENT")
    expect(sent.sentAt).not.toBeNull()

    const noMailClient = await makeClient(user.id)
    const j = await makeInvoice(user.id, noMailClient.id, { status: "ISSUED", totalHT: 10 })
    await expect(sendInvoiceEmail(j.id, "ignored")).rejects.toThrow(/pas d'email/)

    const k = await makeInvoice(user.id, client.id, { status: "ISSUED", totalHT: 10 })
    send.mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    await expect(sendInvoiceEmail(k.id, "ignored")).rejects.toThrow(/Échec de l'envoi/)
    expect((await inv(k.id)).status).toBe("ISSUED")
    expect(await prisma.emailLog.count({ where: { invoiceId: k.id } })).toBe(0)
  })

  it("relance d'une facture en retard : sujet « en retard », net après acompte, jours de retard, journal", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-07-15T10:00:00Z"))
    try {
      const { user, client } = await owner({ email: "compta@exemple.test" })
      const i = await makeInvoice(user.id, client.id, { number: "FAC-2026-200", status: "SENT", totalHT: 1500, depositDeducted: 500 })
      const due = parseCivilDate("2026-07-10")
      await prisma.invoice.update({ where: { id: i.id }, data: { dueDate: due } })

      await markLateInvoices("ignored")
      expect((await inv(i.id)).status).toBe("LATE")

      await sendInvoiceReminder(i.id, "ignored")
      const payload = send.mock.calls[0][0]
      expect(payload.subject).toBe("Relance — Facture FAC-2026-200 en retard")
      expect(payload.attachments[0].filename).toBe("FAC-2026-200.pdf")
      expect(payload.html).toMatch(/1\s000,00\s€/)
      expect(payload.html).toContain(`en retard de <strong>${daysLate(due)} jour(s)</strong>`)
      const log = await prisma.emailLog.findFirstOrThrow({ where: { invoiceId: i.id } })
      expect(log.subject).toBe("Relance — Facture FAC-2026-200 en retard")
      expect((await inv(i.id)).status).toBe("LATE") // la relance ne change pas le statut
    } finally {
      vi.useRealTimers()
    }
  })

  it("rappel d'une facture envoyée non échue ; refus pour émise, sans email, échec Resend, autre compte", async () => {
    const { user, client } = await owner({ email: "compta@exemple.test" })
    const sent = await makeInvoice(user.id, client.id, { number: "FAC-2026-300", status: "SENT", totalHT: 250 })
    await sendInvoiceReminder(sent.id, "ignored")
    expect(send.mock.calls[0][0].subject).toBe("Rappel — Facture FAC-2026-300")
    expect(send.mock.calls[0][0].html).toContain("toujours en attente de règlement")

    const issued = await makeInvoice(user.id, client.id, { status: "ISSUED", totalHT: 10 })
    await expect(sendInvoiceReminder(issued.id, "ignored")).rejects.toThrow(/Facture introuvable/)

    const noMail = await makeInvoice(user.id, (await makeClient(user.id)).id, { status: "LATE", totalHT: 10 })
    await expect(sendInvoiceReminder(noMail.id, "ignored")).rejects.toThrow(/pas d'adresse email/)

    send.mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    await expect(sendInvoiceReminder(sent.id, "ignored")).rejects.toThrow(/Échec de l'envoi/)
    expect(await prisma.emailLog.count({ where: { invoiceId: sent.id } })).toBe(1)

    await intruder()
    await expect(sendInvoiceReminder(sent.id, "ignored")).rejects.toThrow(/Facture introuvable/)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("limite d'envoi : au-delà de 10 mails par minute, la relance est refusée sans appeler Resend", async () => {
    const { user, client } = await owner({ email: "compta@exemple.test" })
    const i = await makeInvoice(user.id, client.id, { status: "SENT", totalHT: 100 })
    for (let n = 0; n < 10; n++) await sendInvoiceReminder(i.id, "ignored")
    await expect(sendInvoiceReminder(i.id, "ignored")).rejects.toThrow(/Trop de requêtes/)
    expect(send).toHaveBeenCalledTimes(10)
    expect(await prisma.emailLog.count({ where: { invoiceId: i.id } })).toBe(10)
  })
})

// ── Produits ──────────────────────────────────────────────────────────────────

describe("produits", () => {
  it("création avec valeurs par défaut, mise à jour partielle en liste blanche, suppression", async () => {
    const { user } = await owner()
    const p = await createProduct("ignored", { name: "Journée de dev", unitPrice: 450 })
    expect(p).toMatchObject({ userId: user.id, unit: "UNIT", billingType: "ONE_SHOT", defaultTaxRate: 0, description: null, isActive: true })

    const full = await createProduct("ignored", {
      name: "Hébergement", description: "Mutualisé", unitPrice: 10, unit: "MONTH", billingType: "MONTHLY", defaultTaxRate: 20,
    })
    expect(full).toMatchObject({ unit: "MONTH", billingType: "MONTHLY", defaultTaxRate: 20, description: "Mutualisé" })

    const other = await makeUser()
    // Champs hors liste blanche (userId, id) ignorés : pas de transfert de propriété.
    await updateProduct(p.id, "ignored", { unitPrice: 500, isActive: false, userId: other.id, id: "pwned" } as never)
    let saved = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    expect(saved).toMatchObject({ userId: user.id, name: "Journée de dev", unitPrice: 500, isActive: false })

    await updateProduct(p.id, "ignored", { name: "Jour", description: "x", unit: "DAY", billingType: "YEARLY", defaultTaxRate: 10 })
    saved = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    expect(saved).toMatchObject({ name: "Jour", description: "x", unit: "DAY", billingType: "YEARLY", defaultTaxRate: 10, unitPrice: 500 })

    await deleteProduct(p.id, "ignored")
    expect(await prisma.product.findUnique({ where: { id: p.id } })).toBeNull()
  })

  it("produit d'un autre compte : ni modifiable ni supprimable", async () => {
    const victim = await makeUser()
    const p = await prisma.product.create({ data: { userId: victim.id, name: "Offre", unitPrice: 100 } })
    await intruder()
    await expect(updateProduct(p.id, "ignored", { unitPrice: 1 })).rejects.toThrow()
    await expect(deleteProduct(p.id, "ignored")).rejects.toThrow()
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ unitPrice: 100 })
  })
})

// ── Factures récurrentes ──────────────────────────────────────────────────────

describe("modèles de factures récurrentes", () => {
  it("mise à jour partielle puis suppression ; modèle d'un autre compte intouchable", async () => {
    const { user, client } = await owner()
    const project = await makeProject(user.id, client.id)
    const rec = await createRecurringInvoice("ignored", {
      clientId: client.id, projectId: project.id, name: "Maintenance", frequency: "MONTHLY", nextGenerationDate: "2026-07-01",
    })

    await updateRecurringInvoice(rec.id, "ignored", { name: "Maintenance+", frequency: "QUARTERLY", isActive: false, projectId: null })
    let saved = await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: rec.id } })
    expect(saved).toMatchObject({ name: "Maintenance+", frequency: "QUARTERLY", isActive: false, projectId: null })
    expect(zonedDateKey(saved.nextGenerationDate)).toBe("2026-07-01")

    await updateRecurringInvoice(rec.id, "ignored", { nextGenerationDate: "2026-09-01T12:00:00Z" })
    saved = await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: rec.id } })
    expect(zonedDateKey(saved.nextGenerationDate)).toBe("2026-09-01")
    expect(saved.name).toBe("Maintenance+")

    await intruder()
    await expect(updateRecurringInvoice(rec.id, "ignored", { name: "pwn" })).rejects.toThrow()
    await expect(deleteRecurringInvoice(rec.id, "ignored")).rejects.toThrow()
    await expect(generateInvoiceFromRecurring(rec.id, "ignored")).rejects.toThrow(/Modèle introuvable/)
    expect((await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: rec.id } })).name).toBe("Maintenance+")
    expect(await prisma.invoice.count()).toBe(0)

    setTestUser(user.id)
    await deleteRecurringInvoice(rec.id, "ignored")
    expect(await prisma.recurringInvoice.findUnique({ where: { id: rec.id } })).toBeNull()
  })

  it("un modèle sans ligne génère une facture à 0 € ; vider les lignes remet le total à 0", async () => {
    const { client } = await owner()
    const rec = await createRecurringInvoice("ignored", {
      clientId: client.id, name: "Vide", frequency: "YEARLY", nextGenerationDate: "2026-01-15T12:00:00Z",
    })
    await setRecurringInvoiceLines(rec.id, "ignored", [line("Licence", 1, 120)])
    await setRecurringInvoiceLines(rec.id, "ignored", [])
    expect((await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: rec.id } })).totalHT).toBe(0)

    const gen = await generateInvoiceFromRecurring(rec.id, "ignored")
    const saved = await inv(gen.id)
    expect(saved).toMatchObject({ totalHT: 0, type: "RECURRING", status: "DRAFT" })
    expect(saved.lines).toHaveLength(0)
    expect(zonedDateKey((await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: rec.id } })).nextGenerationDate)).toBe("2027-01-15")
  })

  // Régression corrigée le 29/09/2026 (src/actions/facturation.ts:928 et :1341) — createRecurringInvoice et
  // importHistoricalInvoice ne passent pas par assertDocumentRefsOwned : le
  // contact d'un AUTRE compte est accepté (même IDOR que celui corrigé sur
  // createInvoice/createQuote ; la fiche du contact s'affiche ensuite chez l'intrus).
  it("modèle récurrent et import historique refusent le contact d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id, { name: "Contact privé" })
    await intruder()
    await expect(
      createRecurringInvoice("ignored", { clientId: vClient.id, name: "x", frequency: "MONTHLY", nextGenerationDate: "2026-07-01" }),
    ).rejects.toThrow(/introuvable/)
    const res = await importHistoricalInvoice("ignored", {
      clientId: vClient.id, date: "2026-01-10", description: "x", amountHT: 100, taxRate: 0, isPaid: false,
    }).catch((e: Error) => ({ error: e.message }))
    expect(res.error).toBeTruthy()
    expect(await prisma.invoice.count()).toBe(0)
  })
})

// ── Import historique / CA mensuel ──────────────────────────────────────────────

describe("importHistoricalInvoice — cas limites", () => {
  it("paiement au montant saisi et à la date saisie ; notes et projet conservés", async () => {
    const { user, client } = await owner()
    const project = await makeProject(user.id, client.id)
    const res = await importHistoricalInvoice("ignored", {
      clientId: client.id, projectId: project.id, customNumber: "  EXT-2025-9  ", date: "2025-03-01",
      description: "Mission passée", amountHT: 1000, taxRate: 20, isPaid: true, paidAt: "2025-04-15", paidAmount: 1150, notes: "import",
    })
    const saved = await inv(res.id!)
    expect(saved).toMatchObject({ number: "EXT-2025-9", status: "PAID", projectId: project.id, notes: "import", totalHT: 1000 })
    expect(saved.payments[0].amount).toBe(1150)
    expect(zonedDateKey(saved.payments[0].paidAt)).toBe("2025-04-15")
    expect(zonedDateKey(saved.paidAt!)).toBe("2025-04-15")
  })
})

describe("getMonthlyRevenue", () => {
  it("somme le NET des factures payées par mois de l'année, hors autres statuts, années et comptes", async () => {
    const { user, client } = await owner()
    const paid = async (totalHT: number, depositDeducted: number, paidAt: string, status = "PAID") => {
      const i = await makeInvoice(user.id, client.id, { totalHT, depositDeducted, status })
      await prisma.invoice.update({ where: { id: i.id }, data: { paidAt: new Date(paidAt) } })
    }
    await paid(1000, 300, "2026-03-15T12:00:00Z")
    await paid(200, 0, "2026-03-20T12:00:00Z")
    await paid(500, 0, "2026-12-31T12:00:00Z")
    await paid(999, 0, "2025-12-15T12:00:00Z") // autre année
    await paid(999, 0, "2026-04-15T12:00:00Z", "SENT") // non payée
    const other = await makeUser()
    const oc = await makeClient(other.id)
    const foreign = await makeInvoice(other.id, oc.id, { totalHT: 999, status: "PAID" })
    await prisma.invoice.update({ where: { id: foreign.id }, data: { paidAt: new Date("2026-03-15T12:00:00Z") } })

    const months = await getMonthlyRevenue(2026)
    expect(months).toHaveLength(12)
    expect(months[2]).toBe(900)
    expect(months[11]).toBe(500)
    expect(months[3]).toBe(0)
    expect(months.reduce((s, v) => s + v, 0)).toBe(1400)
  })

  it("sans session : douze zéros", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    expect(await getMonthlyRevenue(2026)).toEqual(Array(12).fill(0))
  })

  // Régression corrigée le 29/09/2026 (src/actions/facturation.ts:1386-1396) — bornes d'année et mois lus
  // dans le fuseau du PROCESS (UTC en prod) : un paiement du 1er février à 00 h 30
  // (Paris) est compté en janvier, celui du 1er janvier à 00 h 30 tombe dans
  // l'année précédente. Il faudrait raisonner avec zonedParts/zonedMidnight.
  it("le mois du CA suit le jour civil de Paris", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { totalHT: 100, status: "PAID" })
    await prisma.invoice.update({ where: { id: i.id }, data: { paidAt: zonedInstant(2026, 2, 1, 0, 30) } })
    const j = await makeInvoice(user.id, client.id, { totalHT: 10, status: "PAID" })
    await prisma.invoice.update({ where: { id: j.id }, data: { paidAt: zonedInstant(2026, 1, 1, 0, 30) } })
    const months = await getMonthlyRevenue(2026)
    expect(months[1]).toBe(100)
    expect(months[0]).toBe(10)
  })
})
