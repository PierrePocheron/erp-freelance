import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Chiffrement au repos (extension Prisma) : IBAN, BIC et jetons OAuth ne doivent
// jamais être lisibles en base. Les fonctions pures étaient testées, mais PERSONNE
// ne vérifiait que l'extension s'applique vraiment — une régression y serait
// totalement silencieuse (le code continue de lire des valeurs en clair).
// $queryRawUnsafe ne passe pas par l'extension : c'est ce qui rend le test possible.

const IBAN = "FR7630006000011234567890189"   // IBAN de documentation, jamais réel
const BIC = "AGRIFRPP"

describe("chiffrement au repos", () => {
  it("l'IBAN d'un profil émetteur est chiffré en base et déchiffré à la lecture", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const emitter = await prisma.emitterProfile.create({
      data: { userId: user.id, name: "Pedro Agency", iban: IBAN, bic: BIC },
      select: { id: true },
    })

    const [row] = await prisma.$queryRawUnsafe<{ iban: string; bic: string }[]>(
      'SELECT iban, bic FROM "EmitterProfile" WHERE id = $1', emitter.id,
    )
    expect(row.iban.startsWith("enc:v1:")).toBe(true)
    expect(row.iban).not.toContain("FR76")
    expect(row.bic.startsWith("enc:v1:")).toBe(true)
    expect(row.bic).not.toContain("AGRI")

    const read = await prisma.emitterProfile.findUniqueOrThrow({ where: { id: emitter.id } })
    expect(read.iban).toBe(IBAN)
    expect(read.bic).toBe(BIC)
  })

  it("déchiffre aussi chaque élément d'un findMany", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await prisma.emitterProfile.create({ data: { userId: user.id, name: "A", iban: IBAN } })
    await prisma.emitterProfile.create({ data: { userId: user.id, name: "B", iban: "FR7611111111111111111111111" } })

    const all = await prisma.emitterProfile.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } })
    expect(all.map((e) => e.iban)).toEqual([IBAN, "FR7611111111111111111111111"])
  })

  it("relit tel quel un IBAN resté en clair (compatibilité ascendante)", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const emitter = await prisma.emitterProfile.create({
      data: { userId: user.id, name: "Legacy", iban: IBAN },
      select: { id: true },
    })
    // Simule une ligne écrite avant la mise en place du chiffrement.
    await prisma.$executeRawUnsafe(
      'UPDATE "EmitterProfile" SET iban = $1 WHERE id = $2', "FR7622222222222222222222222", emitter.id,
    )

    const read = await prisma.emitterProfile.findUniqueOrThrow({ where: { id: emitter.id } })
    expect(read.iban).toBe("FR7622222222222222222222222")
  })

  it("chiffre aussi l'IBAN du profil utilisateur et les jetons OAuth", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await prisma.userProfile.create({ data: { userId: user.id, iban: IBAN } })
    await prisma.account.create({
      data: {
        userId: user.id, type: "oauth", provider: "google",
        providerAccountId: `acc-${user.id}`,
        access_token: "ya29.secret-token", refresh_token: "1//refresh-secret",
      },
    })

    const [profile] = await prisma.$queryRawUnsafe<{ iban: string }[]>(
      'SELECT iban FROM "UserProfile" WHERE "userId" = $1', user.id,
    )
    expect(profile.iban.startsWith("enc:v1:")).toBe(true)

    const [account] = await prisma.$queryRawUnsafe<{ access_token: string; refresh_token: string }[]>(
      'SELECT access_token, refresh_token FROM "Account" WHERE "userId" = $1', user.id,
    )
    expect(account.access_token.startsWith("enc:v1:")).toBe(true)
    expect(account.access_token).not.toContain("ya29")
    expect(account.refresh_token).not.toContain("refresh-secret")

    const readBack = await prisma.account.findFirstOrThrow({ where: { userId: user.id } })
    expect(readBack.access_token).toBe("ya29.secret-token")
  })
})
