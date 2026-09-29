import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createProspect,
  updateProspectStatus,
  updateProspectsStatusBulk,
  markProspectsContacted,
  importProspects,
  deleteProspects,
  getOrCreateDefaultEmailTemplates,
  getEmailTemplateStats,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  setEmailTemplateArchived,
  getCallTemplates,
  createCallTemplate,
  updateCallTemplate,
  deleteCallTemplate,
  reorderCallTemplates,
  setProspectInterest,
  sendProspectionEmails,
  logProspectAction,
  createProspectNote,
  updateProspectNote,
  deleteProspectNote,
} from "@/actions/prospection"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeCompany } from "./helpers/factories"

// Complète prospection.test.ts : frise (STATUS_CHANGE / actions rapides), notes,
// modèles d'email et d'appel, niveau d'intérêt, envoi Resend (mocké), isolation.
// Données FACTICES uniquement (repo public).

const batchSend = vi.hoisted(() => vi.fn())
vi.mock("@/lib/resend", () => ({ getResend: () => ({ batch: { send: batchSend } }) }))

beforeEach(() => {
  process.env.RESEND_FROM_EMAIL = "prospection@example.com"
  batchSend.mockReset()
  batchSend.mockImplementation(async (emails: unknown[]) => ({
    data: { data: emails.map((_, i) => ({ id: `msg-${i}` })) },
    error: null,
  }))
})

async function asNewUser() {
  const u = await makeUser()
  setTestUser(u.id)
  return u
}

const prospect = (userId: string, overrides: Record<string, unknown> = {}) =>
  makeClient(userId, { type: "PROSPECT", name: "Garage Exemple", ...overrides })

// ── createProspect ───────────────────────────────────────────────────────────

describe("createProspect", () => {
  it("nettoie les champs, source PROSPECTION par défaut, réutilise la société sans tenir compte de la casse", async () => {
    const user = await asNewUser()
    const co = await makeCompany(user.id, { name: "Plomberie Exemple" })

    const p = await createProspect({
      name: "  Jean Test  ", email: "  ", phone: " 06 00 00 00 00 ",
      companyName: "plomberie exemple", websiteUrl: " https://plomberie.example.com ", region: "  ",
    })
    expect(p).toMatchObject({
      name: "Jean Test", email: null, phone: "06 00 00 00 00", source: "PROSPECTION",
      companyId: co.id, company: "Plomberie Exemple", websiteUrl: "https://plomberie.example.com", region: null,
    })
    expect(await prisma.company.count({ where: { userId: user.id } })).toBe(1)
  })

  it("respecte une source explicite ; nom vide → erreur, rien d'écrit", async () => {
    const user = await asNewUser()
    const p = await createProspect({ name: "Via LinkedIn", source: "LINKEDIN" })
    expect(p.source).toBe("LINKEDIN")
    expect(p.companyId).toBeNull()

    await expect(createProspect({ name: "   " })).rejects.toThrow("Le nom est requis")
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(1)
  })
})

// ── Statuts & frise STATUS_CHANGE ────────────────────────────────────────────

describe("updateProspectStatus — historique", () => {
  it("trace un STATUS_CHANGE daté avec from/to", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id)

    await updateProspectStatus(p.id, "CONTACTED")
    await updateProspectStatus(p.id, "IN_DISCUSSION")

    const events = await prisma.prospectEvent.findMany({ where: { clientId: p.id }, orderBy: { date: "asc" } })
    expect(events.map((e) => [e.kind, e.fromStatus, e.toStatus])).toEqual([
      ["STATUS_CHANGE", "TO_CONTACT", "CONTACTED"],
      ["STATUS_CHANGE", "CONTACTED", "IN_DISCUSSION"],
    ])
  })

  it("statut inchangé → aucun événement", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id, { prospectStatus: "REPLIED" })
    await updateProspectStatus(p.id, "REPLIED")
    expect(await prisma.prospectEvent.count({ where: { clientId: p.id } })).toBe(0)
  })

  it("quitter Gagné annule la conversion (CLIENT → PROSPECT)", async () => {
    const user = await asNewUser()
    const p = await makeClient(user.id, { type: "CLIENT", prospectStatus: "WON" })

    await updateProspectStatus(p.id, "LOST")

    const after = await prisma.client.findUnique({ where: { id: p.id } })
    expect(after).toMatchObject({ type: "PROSPECT", prospectStatus: "LOST" })
    const ev = await prisma.prospectEvent.findFirst({ where: { clientId: p.id } })
    expect(ev).toMatchObject({ fromStatus: "WON", toStatus: "LOST" })
  })

  it("isolation : un prospect d'autrui reste intact et sans événement", async () => {
    const owner = await makeUser()
    const victim = await prospect(owner.id)
    await asNewUser()

    await expect(updateProspectStatus(victim.id, "LOST")).rejects.toThrow("Non autorisé")
    expect((await prisma.client.findUnique({ where: { id: victim.id } }))?.prospectStatus).toBe("TO_CONTACT")
    expect(await prisma.prospectEvent.count()).toBe(0)
  })
})

describe("updateProspectsStatusBulk — historique", () => {
  it("un événement par prospect réellement modifié, conversion WON puis annulation", async () => {
    const user = await asNewUser()
    const a = await prospect(user.id, { name: "A" })
    const b = await prospect(user.id, { name: "B", prospectStatus: "WON", type: "CLIENT" })

    await updateProspectsStatusBulk([a.id, b.id], "WON")
    expect((await prisma.client.findUnique({ where: { id: a.id } }))?.type).toBe("CLIENT")
    // b était déjà WON → pas d'événement pour lui
    expect(await prisma.prospectEvent.count({ where: { clientId: b.id } })).toBe(0)
    expect(await prisma.prospectEvent.findFirst({ where: { clientId: a.id } })).toMatchObject({
      kind: "STATUS_CHANGE", fromStatus: "TO_CONTACT", toStatus: "WON",
    })

    await updateProspectsStatusBulk([a.id, b.id], "LOST")
    const after = await prisma.client.findMany({ where: { id: { in: [a.id, b.id] } } })
    expect(after.every((c) => c.type === "PROSPECT" && c.prospectStatus === "LOST")).toBe(true)
    expect(await prisma.prospectEvent.count({ where: { clientId: { in: [a.id, b.id] } } })).toBe(3)
  })

  it("aucun changement → aucun événement ; ids d'autrui ignorés", async () => {
    const owner = await makeUser()
    const victim = await prospect(owner.id, { prospectStatus: "REPLIED" })
    const user = await asNewUser()
    const mine = await prospect(user.id, { prospectStatus: "LOST" })

    await updateProspectsStatusBulk([mine.id, victim.id], "LOST")

    expect(await prisma.prospectEvent.count()).toBe(0)
    expect((await prisma.client.findUnique({ where: { id: victim.id } }))?.prospectStatus).toBe("REPLIED")
  })
})

describe("markProspectsContacted — frise", () => {
  it("canal non-email : événement STATUS_CHANGE avec libellé du canal, modèle tracé sur l'interaction", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id)
    const tpl = await createEmailTemplate({ name: "Script", subject: "s", body: "b" })

    await markProspectsContacted([p.id], "LINKEDIN", undefined, { id: tpl.id, name: tpl.name })

    const ev = await prisma.prospectEvent.findFirst({ where: { clientId: p.id } })
    expect(ev).toMatchObject({ kind: "STATUS_CHANGE", note: "LinkedIn de prospection" })
    const inter = await prisma.interaction.findFirst({ where: { clientId: p.id } })
    expect(inter).toMatchObject({ channel: "LINKEDIN", summary: "LinkedIn de prospection", emailTemplateId: tpl.id, emailTemplateName: "Script" })
  })

  it("email + note personnalisée : EMAIL_SENT avec la note nettoyée", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id)

    await markProspectsContacted([p.id], "EMAIL", "  Relance manuelle  ")

    expect(await prisma.prospectEvent.findFirst({ where: { clientId: p.id } })).toMatchObject({ kind: "EMAIL_SENT", note: "Relance manuelle" })
    expect(await prisma.interaction.findFirst({ where: { clientId: p.id } })).toMatchObject({ summary: "Relance manuelle", emailTemplateId: null })
  })
})

// ── logProspectAction : chaque type d'action ─────────────────────────────────

describe("logProspectAction", () => {
  const cases = [
    { kind: "CALL_NO_ANSWER", status: "CONTACTED", channel: "CALL", summary: "Appel de prospection — pas de réponse" },
    { kind: "CALL_ANSWERED", status: "REPLIED", channel: "CALL", summary: "Appel de prospection — a répondu" },
    { kind: "EMAIL_SENT", status: "CONTACTED", channel: "EMAIL", summary: "Email de prospection envoyé" },
    { kind: "REPLY_POSITIVE", status: "IN_DISCUSSION", channel: "EMAIL", summary: "Réponse positive du prospect" },
    { kind: "REPLY_NEGATIVE", status: "LOST", channel: "EMAIL", summary: "Réponse négative du prospect" },
    { kind: "MEETING_BOOKED", status: "IN_DISCUSSION", channel: "MEETING", summary: "Rendez-vous fixé" },
  ] as const

  for (const c of cases) {
    it(`${c.kind} depuis À contacter → ${c.status}, événement + interaction ${c.channel}`, async () => {
      const user = await asNewUser()
      const p = await prospect(user.id)

      const res = await logProspectAction(p.id, c.kind)

      expect(res.status).toBe(c.status)
      expect(res.event).toMatchObject({ kind: c.kind, fromStatus: "TO_CONTACT", toStatus: c.status, note: null })
      expect((await prisma.client.findUnique({ where: { id: p.id } }))?.prospectStatus).toBe(c.status)
      const events = await prisma.prospectEvent.findMany({ where: { clientId: p.id } })
      expect(events).toHaveLength(1)
      const inter = await prisma.interaction.findMany({ where: { clientId: p.id } })
      expect(inter).toHaveLength(1)
      expect(inter[0]).toMatchObject({ channel: c.channel, summary: c.summary })
    })
  }

  it("jamais de rétrogradation : action de contact sur un prospect en discussion", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id, { prospectStatus: "IN_DISCUSSION" })

    const res = await logProspectAction(p.id, "CALL_NO_ANSWER", "  répondeur  ")

    expect(res.status).toBe("IN_DISCUSSION")
    expect(res.event).toMatchObject({ kind: "CALL_NO_ANSWER", fromStatus: null, toStatus: null, note: "répondeur" })
    expect((await prisma.client.findUnique({ where: { id: p.id } }))?.prospectStatus).toBe("IN_DISCUSSION")
  })

  it("un Gagné reste gagné, même sur réponse négative", async () => {
    const user = await asNewUser()
    const p = await makeClient(user.id, { type: "CLIENT", prospectStatus: "WON" })

    const res = await logProspectAction(p.id, "REPLY_NEGATIVE")

    expect(res.status).toBe("WON")
    const after = await prisma.client.findUnique({ where: { id: p.id } })
    expect(after).toMatchObject({ prospectStatus: "WON", type: "CLIENT" })
  })

  it("depuis Perdu, une action de contact relance le pipeline ; une réponse négative ne change rien", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id, { prospectStatus: "LOST" })

    expect((await logProspectAction(p.id, "REPLY_NEGATIVE")).status).toBe("LOST")
    const res = await logProspectAction(p.id, "CALL_ANSWERED")
    expect(res.status).toBe("REPLIED")
    expect(res.event).toMatchObject({ fromStatus: "LOST", toStatus: "REPLIED" })
  })

  it("EMAIL_SENT trace le modèle utilisé sur l'interaction", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id)
    const tpl = await createEmailTemplate({ name: "1er contact", subject: "s", body: "b" })

    await logProspectAction(p.id, "EMAIL_SENT", undefined, { id: tpl.id, name: tpl.name })

    expect(await prisma.interaction.findFirst({ where: { clientId: p.id } })).toMatchObject({
      emailTemplateId: tpl.id, emailTemplateName: "1er contact",
    })
  })

  it("isolation : prospect d'autrui → erreur, ni statut ni frise ni interaction", async () => {
    const owner = await makeUser()
    const victim = await prospect(owner.id)
    await asNewUser()

    await expect(logProspectAction(victim.id, "MEETING_BOOKED")).rejects.toThrow("Non autorisé")
    expect((await prisma.client.findUnique({ where: { id: victim.id } }))?.prospectStatus).toBe("TO_CONTACT")
    expect(await prisma.prospectEvent.count()).toBe(0)
    expect(await prisma.interaction.count()).toBe(0)
  })
})

// ── Notes de prospect ────────────────────────────────────────────────────────

describe("notes de prospect", () => {
  it("création (titre nettoyé, contenu vide → null), modification, suppression", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id)

    const note = await createProspectNote(p.id, { title: "  Appel du 12  ", content: "   " })
    expect(note).toMatchObject({ clientId: p.id, title: "Appel du 12", content: null })

    await updateProspectNote(note.id, { title: "Appel", content: "  Rappeler lundi  " })
    expect(await prisma.prospectNote.findUnique({ where: { id: note.id } })).toMatchObject({ title: "Appel", content: "Rappeler lundi" })

    await deleteProspectNote(note.id)
    expect(await prisma.prospectNote.count()).toBe(0)
  })

  it("isolation : impossible de créer, modifier ou supprimer une note sur le prospect d'autrui", async () => {
    const owner = await makeUser()
    setTestUser(owner.id)
    const victim = await prospect(owner.id)
    const victimNote = await createProspectNote(victim.id, { title: "Privé", content: "secret" })

    await asNewUser()
    await expect(createProspectNote(victim.id, { title: "Intrus" })).rejects.toThrow("Non autorisé")
    await expect(updateProspectNote(victimNote.id, { title: "Piraté" })).rejects.toThrow("Note introuvable")
    await deleteProspectNote(victimNote.id)

    const notes = await prisma.prospectNote.findMany()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ id: victimNote.id, title: "Privé", content: "secret" })
  })
})

// ── Modèles d'email ──────────────────────────────────────────────────────────

describe("modèles d'email", () => {
  it("getOrCreateDefaultEmailTemplates provisionne 3 modèles une seule fois, par utilisateur", async () => {
    const user = await asNewUser()
    const first = await getOrCreateDefaultEmailTemplates()
    expect(first.map((t) => t.sortOrder)).toEqual([0, 1, 2])
    const again = await getOrCreateDefaultEmailTemplates()
    expect(again.map((t) => t.id)).toEqual(first.map((t) => t.id))
    expect(await prisma.emailTemplate.count({ where: { userId: user.id } })).toBe(3)

    // Un autre utilisateur a ses propres modèles (le compte n'est pas global)
    const other = await asNewUser()
    await getOrCreateDefaultEmailTemplates()
    expect(await prisma.emailTemplate.count({ where: { userId: other.id } })).toBe(3)
  })

  it("création : nom requis, champs nettoyés", async () => {
    const user = await asNewUser()
    await expect(createEmailTemplate({ name: "  ", subject: "s", body: "b" })).rejects.toThrow("Le nom du modèle est requis")
    const t = await createEmailTemplate({ name: "  Relance ", subject: "  Re : votre site ", body: " corps " })
    expect(t).toMatchObject({ userId: user.id, name: "Relance", subject: "Re : votre site", body: " corps " })
  })

  it("modification / archivage / suppression, et isolation (le modèle d'autrui reste intact)", async () => {
    const owner = await asNewUser()
    const victim = await createEmailTemplate({ name: "Victime", subject: "s", body: "b" })

    await asNewUser()
    const mine = await createEmailTemplate({ name: "Mien", subject: "s", body: "b" })

    await updateEmailTemplate(mine.id, { name: " Mien v2 ", subject: " sujet ", body: "corps" })
    expect(await prisma.emailTemplate.findUnique({ where: { id: mine.id } })).toMatchObject({ name: "Mien v2", subject: "sujet", body: "corps" })

    await setEmailTemplateArchived(mine.id, true)
    expect((await prisma.emailTemplate.findUnique({ where: { id: mine.id } }))?.archivedAt).toBeInstanceOf(Date)
    await setEmailTemplateArchived(mine.id, false)
    expect((await prisma.emailTemplate.findUnique({ where: { id: mine.id } }))?.archivedAt).toBeNull()

    await expect(updateEmailTemplate(victim.id, { name: "Piraté", subject: "x", body: "x" })).rejects.toThrow("Non autorisé")
    await expect(setEmailTemplateArchived(victim.id, true)).rejects.toThrow("Non autorisé")
    await deleteEmailTemplate(victim.id)
    expect(await prisma.emailTemplate.findUnique({ where: { id: victim.id } })).toMatchObject({
      userId: owner.id, name: "Victime", archivedAt: null,
    })

    await deleteEmailTemplate(mine.id)
    expect(await prisma.emailTemplate.findUnique({ where: { id: mine.id } })).toBeNull()
  })

  it("getEmailTemplateStats : attribution au dernier modèle envoyé, prospects d'autrui exclus", async () => {
    const owner = await asNewUser()
    const foreignTpl = await createEmailTemplate({ name: "Autre", subject: "s", body: "b" })
    const foreign = await prospect(owner.id, { prospectStatus: "REPLIED" })
    await prisma.interaction.create({ data: { clientId: foreign.id, date: new Date(), channel: "EMAIL", summary: "x", emailTemplateId: foreignTpl.id } })

    const user = await asNewUser()
    const t1 = await createEmailTemplate({ name: "T1", subject: "s", body: "b" })
    const t2 = await createEmailTemplate({ name: "T2", subject: "s", body: "b" })
    const replied = await prospect(user.id, { name: "Répondu", prospectStatus: "IN_DISCUSSION" })
    const silent = await prospect(user.id, { name: "Muet", prospectStatus: "CONTACTED" })
    const mk = (clientId: string, emailTemplateId: string | null, date: string) =>
      prisma.interaction.create({ data: { clientId, date: new Date(date), channel: "EMAIL", summary: "x", emailTemplateId } })
    await mk(replied.id, t1.id, "2026-09-01T10:00:00Z")
    await mk(replied.id, t2.id, "2026-09-05T10:00:00Z") // dernier envoi → attribué à T2
    await mk(silent.id, t1.id, "2026-09-02T10:00:00Z")
    await mk(silent.id, null, "2026-09-06T10:00:00Z")   // sans modèle → ignoré

    const stats = await getEmailTemplateStats()
    expect(stats).toEqual({
      [t1.id]: { prospects: 1, replied: 0 },
      [t2.id]: { prospects: 1, replied: 1 },
    })
  })
})

// ── Modèles d'appel ──────────────────────────────────────────────────────────

describe("modèles d'appel", () => {
  it("CRUD + ordre, liste limitée au user courant", async () => {
    const owner = await asNewUser()
    await createCallTemplate({ name: "Script d'autrui", script: "..." })

    const user = await asNewUser()
    await expect(createCallTemplate({ name: " ", script: "x" })).rejects.toThrow("Le nom du modèle est requis")
    const a = await createCallTemplate({ name: " A ", script: "Bonjour" })
    const b = await createCallTemplate({ name: "B", script: "Salut" })
    expect(a).toMatchObject({ userId: user.id, name: "A" })

    await reorderCallTemplates([b.id, a.id])
    expect((await getCallTemplates()).map((t) => t.name)).toEqual(["B", "A"])

    await updateCallTemplate(a.id, { name: " A2 ", script: "Nouveau" })
    expect(await prisma.callTemplate.findUnique({ where: { id: a.id } })).toMatchObject({ name: "A2", script: "Nouveau" })

    await deleteCallTemplate(b.id)
    expect((await getCallTemplates()).map((t) => t.name)).toEqual(["A2"])
    expect(await prisma.callTemplate.count({ where: { userId: owner.id } })).toBe(1)
  })

  it("isolation : modifier, réordonner ou supprimer le script d'autrui est sans effet", async () => {
    await asNewUser()
    const victim = await createCallTemplate({ name: "Victime", script: "original" })
    await prisma.callTemplate.update({ where: { id: victim.id }, data: { sortOrder: 7 } })

    await asNewUser()
    await expect(updateCallTemplate(victim.id, { name: "Piraté", script: "x" })).rejects.toThrow("Non autorisé")
    await reorderCallTemplates([victim.id])
    await deleteCallTemplate(victim.id)

    expect(await prisma.callTemplate.findUnique({ where: { id: victim.id } })).toMatchObject({
      name: "Victime", script: "original", sortOrder: 7,
    })
  })
})

// ── Niveau d'intérêt ─────────────────────────────────────────────────────────

describe("setProspectInterest", () => {
  it("accepte 1 à 3, toute autre valeur remet à null", async () => {
    const user = await asNewUser()
    const p = await prospect(user.id)
    const level = async () => (await prisma.client.findUnique({ where: { id: p.id } }))?.interestLevel

    await setProspectInterest(p.id, 2)
    expect(await level()).toBe(2)
    await setProspectInterest(p.id, 7)
    expect(await level()).toBeNull()
    await setProspectInterest(p.id, 3)
    await setProspectInterest(p.id, null)
    expect(await level()).toBeNull()
  })

  it("isolation : le prospect d'autrui garde son niveau", async () => {
    const owner = await makeUser()
    const victim = await prospect(owner.id, { interestLevel: 1 })
    await asNewUser()
    await expect(setProspectInterest(victim.id, 3)).rejects.toThrow("Non autorisé")
    expect((await prisma.client.findUnique({ where: { id: victim.id } }))?.interestLevel).toBe(1)
  })
})

// ── Import CSV : compléments ─────────────────────────────────────────────────

describe("importProspects — compléments", () => {
  it("mappe tous les champs, source connue conservée, société réutilisée (casse)", async () => {
    const user = await asNewUser()
    const co = await makeCompany(user.id, { name: "Fleuriste Exemple" })

    const { imported, skipped } = await importProspects([{
      name: " Fleuriste ", firstName: " Léa ", lastName: " Test ", email: " lea@example.com ", phone: " 06 00 00 00 01 ",
      companyName: "FLEURISTE EXEMPLE", websitePagesApprox: 12, businessDescription: " Fleurs ", city: " Lyon ",
      notes: " à rappeler ", source: "WEBSITE",
    }])

    expect({ imported, skipped }).toEqual({ imported: 1, skipped: [] })
    const p = await prisma.client.findFirst({ where: { userId: user.id } })
    expect(p).toMatchObject({
      name: "Fleuriste", firstName: "Léa", lastName: "Test", email: "lea@example.com", phone: "06 00 00 00 01",
      companyId: co.id, company: "Fleuriste Exemple", websitePagesApprox: 12, businessDescription: "Fleurs",
      city: "Lyon", notes: "à rappeler", source: "WEBSITE", type: "PROSPECT", prospectStatus: "TO_CONTACT",
    })
  })

  it("fichier vide → rien d'importé", async () => {
    const user = await asNewUser()
    expect(await importProspects([])).toEqual({ imported: 0, skipped: [] })
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(0)
  })

  it("la déduplication ne tient pas compte des contacts d'un autre utilisateur", async () => {
    const owner = await makeUser()
    await prospect(owner.id, { email: "partage@example.com" })
    const user = await asNewUser()

    const { imported } = await importProspects([{ name: "Même email", email: "partage@example.com" }])

    expect(imported).toBe(1)
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(1)
    expect(await prisma.client.count({ where: { userId: owner.id } })).toBe(1)
  })
})

describe("deleteProspects — isolation", () => {
  it("le prospect d'autrui n'est pas supprimé", async () => {
    const owner = await makeUser()
    const victim = await prospect(owner.id)
    await asNewUser()
    expect(await deleteProspects([victim.id])).toEqual({ deleted: 0 })
    expect(await prisma.client.findUnique({ where: { id: victim.id } })).not.toBeNull()
  })
})

// ── Envoi en masse (Resend mocké) ────────────────────────────────────────────

describe("sendProspectionEmails", () => {
  async function setup() {
    const user = await asNewUser()
    const tpl = await createEmailTemplate({ name: "1er contact", subject: "Bonjour {{societe}}", body: "Votre site {{site}}" })
    return { user, tpl }
  }

  it("refuse sans adresse d'envoi configurée (absente ou sandbox resend.dev)", async () => {
    const { tpl } = await setup()
    delete process.env.RESEND_FROM_EMAIL
    await expect(sendProspectionEmails(tpl.id, [])).rejects.toThrow(/Adresse d'envoi non configurée/)
    process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev"
    await expect(sendProspectionEmails(tpl.id, [])).rejects.toThrow(/Adresse d'envoi non configurée/)
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("modèle d'un autre utilisateur → introuvable, rien n'est envoyé", async () => {
    const { tpl } = await setup()
    const attacker = await asNewUser()
    const mine = await prospect(attacker.id, { email: "cible@example.com" })

    await expect(sendProspectionEmails(tpl.id, [mine.id])).rejects.toThrow("Modèle introuvable")
    expect(batchSend).not.toHaveBeenCalled()
    expect(await prisma.emailLog.count()).toBe(0)
  })

  it("envoi réussi : EmailLog + Interaction + EMAIL_SENT + bump TO_CONTACT ; sans email et ids d'autrui ignorés", async () => {
    const owner = await makeUser()
    const foreign = await prospect(owner.id, { email: "autrui@example.com" })
    const { user, tpl } = await setup()
    const fresh = await prospect(user.id, { name: "Frais", email: "frais@example.com", company: "Boulangerie Exemple" })
    const advanced = await prospect(user.id, { name: "Avancé", email: "avance@example.com", prospectStatus: "REPLIED" })
    const noEmail = await prospect(user.id, { name: "Sans email" })

    const res = await sendProspectionEmails(tpl.id, [fresh.id, advanced.id, noEmail.id, foreign.id])

    expect(res).toEqual({ sent: 2, failed: 0, skippedNoEmail: 2 })
    const sentBatch = batchSend.mock.calls[0][0] as { from: string; to: string; subject: string; html: string; text: string }[]
    expect(sentBatch.map((e) => e.to).sort()).toEqual(["avance@example.com", "frais@example.com"])
    expect(sentBatch.every((e) => e.from === "prospection@example.com")).toBe(true)
    expect(sentBatch.find((e) => e.to === "frais@example.com")?.subject).toBe("Bonjour Boulangerie Exemple")

    const logs = await prisma.emailLog.findMany({ where: { userId: user.id } })
    expect(logs).toHaveLength(2)
    expect(logs.every((l) => l.resendMessageId?.startsWith("msg-"))).toBe(true)
    expect(await prisma.interaction.count({ where: { emailTemplateId: tpl.id } })).toBe(2)
    expect(await prisma.prospectEvent.count({ where: { kind: "EMAIL_SENT", note: "Email « 1er contact »" } })).toBe(2)
    expect((await prisma.client.findUnique({ where: { id: fresh.id } }))?.prospectStatus).toBe("CONTACTED")
    expect((await prisma.client.findUnique({ where: { id: advanced.id } }))?.prospectStatus).toBe("REPLIED")
    // Le prospect d'autrui n'a rien reçu ni changé
    expect(await prisma.emailLog.count({ where: { clientId: foreign.id } })).toBe(0)
    expect((await prisma.client.findUnique({ where: { id: foreign.id } }))?.prospectStatus).toBe("TO_CONTACT")
  })

  it("aucun destinataire avec email → aucun appel Resend", async () => {
    const { user, tpl } = await setup()
    const noEmail = await prospect(user.id)
    expect(await sendProspectionEmails(tpl.id, [noEmail.id])).toEqual({ sent: 0, failed: 0, skippedNoEmail: 1 })
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("erreur Resend (retournée ou levée) → comptée en échec, rien n'est tracé", async () => {
    const { user, tpl } = await setup()
    const p = await prospect(user.id, { email: "echec@example.com" })

    batchSend.mockResolvedValueOnce({ data: null, error: { message: "quota" } })
    expect(await sendProspectionEmails(tpl.id, [p.id])).toEqual({ sent: 0, failed: 1, skippedNoEmail: 0 })
    batchSend.mockRejectedValueOnce(new Error("réseau"))
    expect(await sendProspectionEmails(tpl.id, [p.id])).toEqual({ sent: 0, failed: 1, skippedNoEmail: 0 })

    expect(await prisma.emailLog.count()).toBe(0)
    expect(await prisma.interaction.count()).toBe(0)
    expect(await prisma.prospectEvent.count()).toBe(0)
    expect((await prisma.client.findUnique({ where: { id: p.id } }))?.prospectStatus).toBe("TO_CONTACT")
  })

  it("découpe par lots de 100 : un lot en échec n'empêche pas les autres", async () => {
    const { user, tpl } = await setup()
    await prisma.client.createMany({
      data: Array.from({ length: 101 }, (_, i) => ({
        userId: user.id, type: "PROSPECT" as const, name: `Prospect ${i}`, email: `p${i}@example.com`,
      })),
    })
    const ids = (await prisma.client.findMany({ where: { userId: user.id }, select: { id: true } })).map((c) => c.id)
    batchSend
      .mockImplementationOnce(async (emails: unknown[]) => ({ data: { data: emails.map((_, i) => ({ id: `m${i}` })) }, error: null }))
      .mockImplementationOnce(async () => ({ data: null, error: { message: "boom" } }))

    const res = await sendProspectionEmails(tpl.id, ids)

    expect(res).toEqual({ sent: 100, failed: 1, skippedNoEmail: 0 })
    expect(batchSend).toHaveBeenCalledTimes(2)
    expect((batchSend.mock.calls[0][0] as unknown[]).length).toBe(100)
    expect(await prisma.emailLog.count({ where: { userId: user.id } })).toBe(100)
    expect(await prisma.client.count({ where: { userId: user.id, prospectStatus: "CONTACTED" } })).toBe(100)
  })
})

// ── Défauts documentés (non corrigés) ────────────────────────────────────────

describe("défauts documentés", () => {
  // BUG mineur (src/actions/prospection.ts:405-413 et 473-481) — updateEmailTemplate /
  // updateCallTemplate n'appliquent pas la validation de create* : un modèle peut
  // être renommé en chaîne vide (invisible dans les sélecteurs).
  it("renommer un modèle en nom vide est refusé", async () => {
    await asNewUser()
    const e = await createEmailTemplate({ name: "Nom", subject: "s", body: "b" })
    const c = await createCallTemplate({ name: "Nom", script: "x" })
    await expect(updateEmailTemplate(e.id, { name: "  ", subject: "s", body: "b" })).rejects.toThrow()
    await expect(updateCallTemplate(c.id, { name: "  ", script: "x" })).rejects.toThrow()
    expect((await prisma.emailTemplate.findUnique({ where: { id: e.id } }))?.name).toBe("Nom")
    expect((await prisma.callTemplate.findUnique({ where: { id: c.id } }))?.name).toBe("Nom")
  })

  // BUG mineur (src/actions/prospection.ts:155-164) — markProspectsContacted trace un
  // STATUS_CHANGE pour tout canal non-email, SANS from/to, même si le statut ne bouge
  // pas : la frise affiche « Statut modifié » à tort, et la vraie transition
  // TO_CONTACT → CONTACTED n'est pas historisée (contrairement à updateProspectStatus).
  it("un contact en lot ne trace STATUS_CHANGE que sur changement réel, avec from/to", async () => {
    const user = await asNewUser()
    const fresh = await prospect(user.id, { name: "Frais" })
    const advanced = await prospect(user.id, { name: "Avancé", prospectStatus: "IN_DISCUSSION" })

    await markProspectsContacted([fresh.id, advanced.id], "CALL")

    const changes = await prisma.prospectEvent.findMany({ where: { kind: "STATUS_CHANGE" } })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ clientId: fresh.id, fromStatus: "TO_CONTACT", toStatus: "CONTACTED" })
  })
})
