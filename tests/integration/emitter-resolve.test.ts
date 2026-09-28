import { describe, it, expect } from "vitest"
import { resolveEmitter } from "@/lib/emitter-resolve"
import { prisma } from "@/lib/prisma"
import { makeUser } from "./helpers/factories"

// `resolveEmitter` décide du SIRET, de l'IBAN et de la raison sociale IMPRIMÉS
// sur chaque facture. Zéro test jusqu'ici, alors qu'une régression envoie au
// client un document aux mauvaises mentions légales.

describe("résolution du bloc émetteur", () => {
  it("utilise le profil émetteur du document quand il y en a un", async () => {
    const user = await makeUser()
    const emitter = await prisma.emitterProfile.create({
      data: {
        userId: user.id, name: "Interne", companyName: "Studio Démo", email: "facturation@example.test",
        siret: "12345678900011", iban: "FR7630006000011234567890189", bic: "AGRIFRPP",
        address: "1 rue du Test", postalCode: "69000", city: "Lyon", pdfAccentColor: "#123456",
      },
    })

    const { emitter: block, accentColor } = await resolveEmitter({
      userId: user.id, emitterProfileId: emitter.id, userName: "Pierre", userEmail: "pierre@example.test",
    })

    expect(block.companyName).toBe("Studio Démo")
    expect(block.siret).toBe("12345678900011")
    expect(block.iban).toBe("FR7630006000011234567890189") // déchiffré à la lecture
    expect(block.email).toBe("facturation@example.test")
    expect(block.name).toBe("Pierre") // l'identité reste celle de la personne
    expect(accentColor).toBe("#123456")
  })

  it("à défaut de raison sociale, retombe sur le libellé interne", async () => {
    const user = await makeUser()
    const emitter = await prisma.emitterProfile.create({
      data: { userId: user.id, name: "Libellé interne", companyName: "   " },
    })

    const { emitter: block } = await resolveEmitter({
      userId: user.id, emitterProfileId: emitter.id, userName: "Pierre", userEmail: "p@example.test",
    })
    expect(block.companyName).toBe("Libellé interne")
  })

  it("document détaché → retombe sur le profil utilisateur", async () => {
    const user = await makeUser()
    await prisma.userProfile.create({
      data: { userId: user.id, companyName: "Ancienne Identité", siret: "99988877700022", iban: "FR7611111111111111111111111" },
    })

    const { emitter: block } = await resolveEmitter({
      userId: user.id, emitterProfileId: null, userName: "Pierre", userEmail: "p@example.test",
    })

    expect(block.companyName).toBe("Ancienne Identité")
    expect(block.siret).toBe("99988877700022")
    expect(block.iban).toBe("FR7611111111111111111111111")
  })

  it("ignore un profil émetteur d'un AUTRE compte (anti-IDOR)", async () => {
    const victim = await makeUser()
    const victimEmitter = await prisma.emitterProfile.create({
      data: { userId: victim.id, name: "Victime", companyName: "Société Victime", siret: "11122233300044" },
    })
    const other = await makeUser()
    await prisma.userProfile.create({ data: { userId: other.id, companyName: "Chez moi" } })

    const { emitter: block } = await resolveEmitter({
      userId: other.id, emitterProfileId: victimEmitter.id, userName: "Autre", userEmail: "a@example.test",
    })

    // Le profil d'autrui n'est pas retenu : on retombe sur le profil utilisateur.
    expect(block.companyName).toBe("Chez moi")
    expect(block.siret).toBeFalsy()
  })

  it("profil vierge → le PDF reste marqué (initiales et nom en sous-titre)", async () => {
    const user = await makeUser()
    const { branding } = await resolveEmitter({
      userId: user.id, emitterProfileId: null, userName: "Paul Petit", userEmail: "p@example.test",
    })
    expect(branding.logoText).toBe("PP")
    expect(branding.logoSubtext).toBe("PAUL PETIT")
  })

  it("sans nom du tout, retombe sur l'initiale de l'email", async () => {
    const user = await makeUser()
    const { emitter: block, branding } = await resolveEmitter({
      userId: user.id, emitterProfileId: null, userName: null, userEmail: "zoe@example.test",
    })
    expect(branding.logoText).toBe("Z")
    expect(block.name).toBe("Freelance")
  })
})
