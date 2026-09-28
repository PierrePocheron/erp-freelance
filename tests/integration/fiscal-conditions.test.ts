import { describe, it, expect } from "vitest"
import {
  listFiscalSources, createFiscalSource, updateFiscalSource, deleteFiscalSource, linkEmitterToFiscalSource,
} from "@/actions/fiscal-source"
import {
  createConditionsTemplate, updateConditionsTemplate, deleteConditionsTemplate, setDefaultConditionsTemplate,
} from "@/actions/conditions"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Sources fiscales : elles décident de ce qui entre dans l'assiette URSSAF (via
// le `bucket`) et de ce qui apparaît au récapitulatif annuel. Conditions
// générales : le texte imprimé au bas des devis et factures.

describe("sources fiscales", () => {
  it("crée, modifie partiellement et liste une source", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const source = await createFiscalSource({ name: "  Studio Démo AE  ", bucket: "AE_URSSAF" })
    expect(source.name).toBe("Studio Démo AE") // trim
    expect(source.color).toBe("#6366f1")     // couleur par défaut

    await updateFiscalSource(source.id, { color: "#ff0000" })
    const after = await prisma.fiscalSource.findUniqueOrThrow({ where: { id: source.id } })
    // La mise à jour est partielle : le nom et le bucket ne bougent pas.
    expect([after.name, after.bucket, after.color]).toEqual(["Studio Démo AE", "AE_URSSAF", "#ff0000"])

    const list = await listFiscalSources()
    expect(list.map((s) => s.id)).toEqual([source.id])
  })

  it("refuse un nom vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await expect(createFiscalSource({ name: "   ", bucket: "AE_URSSAF" })).rejects.toThrow(/requis/i)
  })

  it("supprimer une source détache les revenus au lieu de les effacer", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const source = await createFiscalSource({ name: "Études", bucket: "NON_IMPOSABLE" })
    const revenue = await prisma.revenue.create({
      data: { userId: user.id, type: "STUDY", label: "Étude", amount: 70, status: "RECEIVED", fiscalSourceId: source.id },
    })

    await deleteFiscalSource(source.id)

    const after = await prisma.revenue.findUniqueOrThrow({ where: { id: revenue.id } })
    expect(after.fiscalSourceId).toBeNull()
    expect(after.amount).toBe(70)
  })

  it("lie un émetteur à une source, et refuse celles d'un autre compte", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const source = await createFiscalSource({ name: "AE", bucket: "AE_URSSAF" })
    const emitter = await prisma.emitterProfile.create({ data: { userId: user.id, name: "Studio Démo" } })

    await linkEmitterToFiscalSource(emitter.id, source.id)
    expect((await prisma.emitterProfile.findUniqueOrThrow({ where: { id: emitter.id } })).fiscalSourceId).toBe(source.id)

    const victim = await makeUser()
    setTestUser(victim.id)
    const victimSource = await createFiscalSource({ name: "Privée", bucket: "OTHER" })

    setTestUser(user.id)
    await expect(linkEmitterToFiscalSource(emitter.id, victimSource.id)).rejects.toThrow(/introuvable/i)
    expect((await prisma.emitterProfile.findUniqueOrThrow({ where: { id: emitter.id } })).fiscalSourceId).toBe(source.id)
  })

  it("ne touche pas à la source d'un autre compte", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    const victimSource = await createFiscalSource({ name: "Privée", bucket: "AE_URSSAF" })

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await expect(updateFiscalSource(victimSource.id, { name: "pwned" })).rejects.toThrow(/introuvable/i)
    await expect(deleteFiscalSource(victimSource.id)).rejects.toThrow(/introuvable/i)
    expect(await listFiscalSources()).toEqual([])

    expect((await prisma.fiscalSource.findUniqueOrThrow({ where: { id: victimSource.id } })).name).toBe("Privée")
  })
})

describe("modèles de conditions générales", () => {
  it("le premier modèle devient le défaut, et le défaut est exclusif", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    await createConditionsTemplate("ignored", { name: "CGV standard", content: "Article 1…" })
    await createConditionsTemplate("ignored", { name: "CGV agence", content: "Article 2…" })

    const all = await prisma.conditionsTemplate.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } })
    expect(all.map((t) => [t.name, t.isDefault])).toEqual([["CGV agence", false], ["CGV standard", true]])

    const agence = all.find((t) => t.name === "CGV agence")!
    await setDefaultConditionsTemplate(agence.id, "ignored")

    const after = await prisma.conditionsTemplate.findMany({ where: { userId: user.id } })
    expect(after.filter((t) => t.isDefault).map((t) => t.name)).toEqual(["CGV agence"])
  })

  it("modifie et supprime ses propres modèles seulement", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    await createConditionsTemplate("ignored", { name: "CGV privées", content: "Secret" })
    const victimTpl = await prisma.conditionsTemplate.findFirstOrThrow({ where: { userId: victim.id } })

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await updateConditionsTemplate(victimTpl.id, "ignored", { name: "pwned", content: "pwned" })
    await deleteConditionsTemplate(victimTpl.id, "ignored")
    await setDefaultConditionsTemplate(victimTpl.id, "ignored")

    // Les trois actions utilisent updateMany/deleteMany scopés : elles ne lèvent
    // pas, elles ne touchent simplement rien.
    const after = await prisma.conditionsTemplate.findUniqueOrThrow({ where: { id: victimTpl.id } })
    expect([after.name, after.content]).toEqual(["CGV privées", "Secret"])
  })
})
