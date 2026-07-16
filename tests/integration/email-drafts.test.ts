import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateEmailDrafts,
  updateEmailDraft,
  setEmailDraftReady,
  setEmailDraftBack,
  cancelEmailDraft,
  deleteEmailDraft,
  sendReadyDrafts,
} from "@/actions/email-drafts"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// File de brouillons : génération, relecture (READY explicite), envoi contrôlé.
// Resend est mocké à la frontière (@/lib/resend) — aucun email réel ne part.

const batchSend = vi.hoisted(() => vi.fn())
vi.mock("@/lib/resend", () => ({
  getResend: () => ({ batch: { send: batchSend } }),
}))

// Adresse d'envoi vérifiée (hors sandbox resend.dev) — requise par sendReadyDrafts.
process.env.RESEND_FROM_EMAIL = "pierre@pedro-dev.fr"

beforeEach(() => {
  batchSend.mockReset()
  batchSend.mockImplementation(async (emails: { to: string }[]) => ({
    data: { data: emails.map((_, i) => ({ id: `msg-${i}` })) },
    error: null,
  }))
})

async function makeTemplate(userId: string, overrides: Partial<{ subject: string; body: string }> = {}) {
  return prisma.emailTemplate.create({
    data: {
      userId,
      name: "1er contact",
      subject: overrides.subject ?? "Votre site {{site}}",
      body: overrides.body ?? "Bonjour {{prenom}},\n\nVotre site {{site}} mérite mieux.",
    },
  })
}

describe("generateEmailDrafts", () => {
  it("crée un brouillon rendu par prospect, emailTo figé, missingVars tracées", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const template = await makeTemplate(user.id)
    const complet = await makeClient(user.id, {
      type: "PROSPECT", firstName: "Jean", email: "jean@boulangerie.fr", websiteUrl: "https://boulangerie.fr",
    })
    const lacunaire = await makeClient(user.id, { type: "PROSPECT", name: "Sans Rien" })

    const res = await generateEmailDrafts([complet.id, lacunaire.id], template.id)
    expect(res).toEqual({ created: 2, skipped: 0 })

    const draftComplet = await prisma.emailDraft.findFirst({ where: { clientId: complet.id } })
    expect(draftComplet?.status).toBe("DRAFT")
    expect(draftComplet?.emailTo).toBe("jean@boulangerie.fr")
    expect(draftComplet?.subject).toBe("Votre site https://boulangerie.fr")
    expect(draftComplet?.body).toContain("Bonjour Jean")
    expect(draftComplet?.missingVars).toBeNull()
    expect(draftComplet?.templateId).toBe(template.id)

    const draftLacunaire = await prisma.emailDraft.findFirst({ where: { clientId: lacunaire.id } })
    expect(draftLacunaire?.emailTo).toBeNull()
    // Les variables vides sont substituées par "" mais tracées dans missingVars
    expect(draftLacunaire?.missingVars?.split(",").sort()).toEqual(["prenom", "site"])
    expect(draftLacunaire?.body).not.toContain("{{")
  })

  it("saute les prospects ayant déjà un brouillon actif (DRAFT/READY), pas les SENT/CANCELLED", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const template = await makeTemplate(user.id)
    const a = await makeClient(user.id, { type: "PROSPECT", email: "a@a.fr", websiteUrl: "https://a.fr", firstName: "A" })
    const b = await makeClient(user.id, { type: "PROSPECT", email: "b@b.fr", websiteUrl: "https://b.fr", firstName: "B", name: "B" })

    await generateEmailDrafts([a.id, b.id], template.id)
    // Re-génération immédiate : tout est déjà en file
    expect(await generateEmailDrafts([a.id, b.id], template.id)).toEqual({ created: 0, skipped: 2 })

    // Un brouillon annulé ne bloque plus la régénération
    const draftA = await prisma.emailDraft.findFirst({ where: { clientId: a.id } })
    await cancelEmailDraft(draftA!.id)
    expect(await generateEmailDrafts([a.id, b.id], template.id)).toEqual({ created: 1, skipped: 1 })
  })

  it("ignore les prospects d'un autre utilisateur et refuse un modèle étranger (anti-IDOR)", async () => {
    const owner = await makeUser()
    const attacker = await makeUser()
    const victim = await makeClient(owner.id, { type: "PROSPECT", email: "v@v.fr" })
    const ownerTemplate = await makeTemplate(owner.id)

    setTestUser(attacker.id)
    // Modèle d'autrui → refus
    await expect(generateEmailDrafts([victim.id], ownerTemplate.id)).rejects.toThrow("Modèle introuvable")

    // Prospect d'autrui avec son propre modèle → aucun brouillon créé
    const mineTemplate = await makeTemplate(attacker.id)
    expect(await generateEmailDrafts([victim.id], mineTemplate.id)).toEqual({ created: 0, skipped: 0 })
    expect(await prisma.emailDraft.count()).toBe(0)
  })
})

describe("updateEmailDraft", () => {
  it("toute édition repasse en DRAFT (même un brouillon relu) et recalcule missingVars", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const template = await makeTemplate(user.id)
    const p = await makeClient(user.id, { type: "PROSPECT", firstName: "Jean", email: "j@j.fr", websiteUrl: "https://j.fr" })
    await generateEmailDrafts([p.id], template.id)
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: p.id } }))!

    await setEmailDraftReady(draft.id)
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("READY")

    // Édition après relecture → retour en DRAFT + {{var}} résiduelle détectée
    await updateEmailDraft(draft.id, { body: "Bonjour {{prenom}}, on se voit à {{ville}} ?" })
    let after = await prisma.emailDraft.findUnique({ where: { id: draft.id } })
    expect(after?.status).toBe("DRAFT")
    expect(after?.missingVars?.split(",").sort()).toEqual(["prenom", "ville"])

    // Nouvelle édition qui comble tout → missingVars nettoyée
    await updateEmailDraft(draft.id, { body: "Bonjour Jean, on se voit à Lyon ?" })
    after = await prisma.emailDraft.findUnique({ where: { id: draft.id } })
    expect(after?.missingVars).toBeNull()
  })

  it("refuse l'édition d'un brouillon d'un autre utilisateur (anti-IDOR) et d'un brouillon envoyé", async () => {
    const owner = await makeUser()
    const attacker = await makeUser()
    setTestUser(owner.id)
    const template = await makeTemplate(owner.id)
    const p = await makeClient(owner.id, { type: "PROSPECT", firstName: "J", email: "j@j.fr", websiteUrl: "https://j.fr" })
    await generateEmailDrafts([p.id], template.id)
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: p.id } }))!

    setTestUser(attacker.id)
    await expect(updateEmailDraft(draft.id, { subject: "piraté" })).rejects.toThrow("Brouillon introuvable")

    setTestUser(owner.id)
    await prisma.emailDraft.update({ where: { id: draft.id }, data: { status: "SENT", sentAt: new Date() } })
    await expect(updateEmailDraft(draft.id, { subject: "trop tard" })).rejects.toThrow("plus modifiable")
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.subject).not.toBe("trop tard")
  })
})

describe("setEmailDraftReady / setEmailDraftBack / cancel / delete", () => {
  it("refuse le marquage relu si des {{variables}} subsistent dans le texte", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const template = await makeTemplate(user.id)
    const p = await makeClient(user.id, { type: "PROSPECT", firstName: "J", email: "j@j.fr", websiteUrl: "https://j.fr" })
    await generateEmailDrafts([p.id], template.id)
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: p.id } }))!

    await updateEmailDraft(draft.id, { body: "Il reste {{site}} ici" })
    await expect(setEmailDraftReady(draft.id)).rejects.toThrow()
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("DRAFT")
  })

  it("refuse le marquage relu si le destinataire est vide ou invalide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const template = await makeTemplate(user.id)
    // Prospect sans email → emailTo null à la génération
    const p = await makeClient(user.id, { type: "PROSPECT", firstName: "J", websiteUrl: "https://j.fr" })
    await generateEmailDrafts([p.id], template.id)
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: p.id } }))!

    await expect(setEmailDraftReady(draft.id)).rejects.toThrow("Destinataire")

    await updateEmailDraft(draft.id, { emailTo: "pas-un-email" })
    await expect(setEmailDraftReady(draft.id)).rejects.toThrow("Destinataire")

    await updateEmailDraft(draft.id, { emailTo: "ok@valide.fr" })
    await setEmailDraftReady(draft.id)
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("READY")
  })

  it("refuse le marquage relu tant que les variables manquantes de génération n'ont pas été revues", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const template = await makeTemplate(user.id)
    // websiteUrl absent → {{site}} vide à la génération → missingVars tracée
    const p = await makeClient(user.id, { type: "PROSPECT", firstName: "J", email: "j@j.fr" })
    await generateEmailDrafts([p.id], template.id)
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: p.id } }))!
    expect(draft.missingVars).toContain("site")

    await expect(setEmailDraftReady(draft.id)).rejects.toThrow("manquantes")

    // Une édition (relecture humaine) recalcule missingVars → marquage possible
    await updateEmailDraft(draft.id, { body: "Bonjour Jean, votre site https://j.fr mérite mieux." })
    await setEmailDraftReady(draft.id)
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("READY")
  })

  it("setEmailDraftBack repasse READY → DRAFT ; cancel/delete scopés au propriétaire", async () => {
    const owner = await makeUser()
    const attacker = await makeUser()
    setTestUser(owner.id)
    const template = await makeTemplate(owner.id)
    const p = await makeClient(owner.id, { type: "PROSPECT", firstName: "J", email: "j@j.fr", websiteUrl: "https://j.fr" })
    await generateEmailDrafts([p.id], template.id)
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: p.id } }))!

    await setEmailDraftReady(draft.id)
    await setEmailDraftBack(draft.id)
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("DRAFT")

    // Anti-IDOR : un autre user ne peut ni annuler, ni supprimer, ni marquer relu
    setTestUser(attacker.id)
    await expect(cancelEmailDraft(draft.id)).rejects.toThrow()
    await expect(setEmailDraftReady(draft.id)).rejects.toThrow("introuvable")
    await deleteEmailDraft(draft.id) // no-op silencieux (deleteMany scopé)
    expect(await prisma.emailDraft.findUnique({ where: { id: draft.id } })).not.toBeNull()

    setTestUser(owner.id)
    await cancelEmailDraft(draft.id)
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("CANCELLED")
    await deleteEmailDraft(draft.id)
    expect(await prisma.emailDraft.findUnique({ where: { id: draft.id } })).toBeNull()
  })
})

describe("sendReadyDrafts", () => {
  async function setupReadyAndDraft(userId: string) {
    const template = await makeTemplate(userId)
    const pReady = await makeClient(userId, {
      type: "PROSPECT", prospectStatus: "TO_CONTACT", firstName: "Prêt", name: "Prêt",
      email: "pret@ok.fr", websiteUrl: "https://ok.fr",
    })
    const pDraft = await makeClient(userId, {
      type: "PROSPECT", prospectStatus: "TO_CONTACT", firstName: "Pas",  name: "Pas relu",
      email: "pas@relu.fr", websiteUrl: "https://relu.fr",
    })
    await generateEmailDrafts([pReady.id, pDraft.id], template.id)
    const ready = (await prisma.emailDraft.findFirst({ where: { clientId: pReady.id } }))!
    const draft = (await prisma.emailDraft.findFirst({ where: { clientId: pDraft.id } }))!
    await setEmailDraftReady(ready.id)
    return { pReady, pDraft, ready, draft }
  }

  it("n'envoie QUE les READY : SENT + sentAt, EmailLog, Interaction (sujet en summary), bump TO_CONTACT", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { pReady, pDraft, ready, draft } = await setupReadyAndDraft(user.id)

    const res = await sendReadyDrafts([ready.id, draft.id])
    expect(res).toEqual({ sent: 1, failed: 0, refused: 1 })

    // Un seul appel Resend, un seul mail, au destinataire figé du brouillon
    expect(batchSend).toHaveBeenCalledTimes(1)
    const emails = batchSend.mock.calls[0][0]
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe("pret@ok.fr")
    expect(emails[0].subject).toBe("Votre site https://ok.fr")

    const readyAfter = await prisma.emailDraft.findUnique({ where: { id: ready.id } })
    expect(readyAfter?.status).toBe("SENT")
    expect(readyAfter?.sentAt).not.toBeNull()
    // Le brouillon non relu n'a pas bougé
    expect((await prisma.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("DRAFT")

    const log = await prisma.emailLog.findFirst({ where: { clientId: pReady.id } })
    expect(log?.to).toBe("pret@ok.fr")
    expect(log?.subject).toBe("Votre site https://ok.fr")
    expect(log?.resendMessageId).toBe("msg-0")

    const interaction = await prisma.interaction.findFirst({ where: { clientId: pReady.id } })
    expect(interaction?.channel).toBe("EMAIL")
    expect(interaction?.summary).toContain("Votre site https://ok.fr")

    expect((await prisma.client.findUnique({ where: { id: pReady.id } }))?.prospectStatus).toBe("CONTACTED")
    expect((await prisma.client.findUnique({ where: { id: pDraft.id } }))?.prospectStatus).toBe("TO_CONTACT")
  })

  it("défense en profondeur : un READY corrompu ({{var}} résiduelle ou email invalide) est refusé", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { ready } = await setupReadyAndDraft(user.id)

    // Corruption directe en base (contourne updateEmailDraft) : le re-check refuse
    await prisma.emailDraft.update({ where: { id: ready.id }, data: { body: "Reste {{site}} ici" } })
    let res = await sendReadyDrafts([ready.id])
    expect(res).toEqual({ sent: 0, failed: 0, refused: 1 })
    expect(batchSend).not.toHaveBeenCalled()

    await prisma.emailDraft.update({ where: { id: ready.id }, data: { body: "ok", emailTo: "invalide" } })
    res = await sendReadyDrafts([ready.id])
    expect(res).toEqual({ sent: 0, failed: 0, refused: 1 })
    expect((await prisma.emailDraft.findUnique({ where: { id: ready.id } }))?.status).toBe("READY")
  })

  it("échec Resend : le brouillon reste READY, compté failed, aucun EmailLog", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { pReady, ready } = await setupReadyAndDraft(user.id)
    batchSend.mockResolvedValueOnce({ data: null, error: { message: "boom" } })

    const res = await sendReadyDrafts([ready.id])
    expect(res).toEqual({ sent: 0, failed: 1, refused: 0 })
    expect((await prisma.emailDraft.findUnique({ where: { id: ready.id } }))?.status).toBe("READY")
    expect(await prisma.emailLog.count({ where: { clientId: pReady.id } })).toBe(0)
  })

  it("refuse les brouillons d'un autre utilisateur (anti-IDOR) — rien ne part", async () => {
    const owner = await makeUser()
    setTestUser(owner.id)
    const { ready } = await setupReadyAndDraft(owner.id)

    const attacker = await makeUser()
    setTestUser(attacker.id)
    const res = await sendReadyDrafts([ready.id])
    expect(res).toEqual({ sent: 0, failed: 0, refused: 1 })
    expect(batchSend).not.toHaveBeenCalled()
    expect((await prisma.emailDraft.findUnique({ where: { id: ready.id } }))?.status).toBe("READY")
  })

  it("refuse d'envoyer sans RESEND_FROM_EMAIL vérifiée (sandbox resend.dev inclus)", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { ready } = await setupReadyAndDraft(user.id)

    const saved = process.env.RESEND_FROM_EMAIL
    try {
      process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev"
      await expect(sendReadyDrafts([ready.id])).rejects.toThrow("RESEND_FROM_EMAIL")
    } finally {
      process.env.RESEND_FROM_EMAIL = saved
    }
    expect(batchSend).not.toHaveBeenCalled()
  })
})
