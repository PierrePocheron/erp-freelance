import { describe, it, expect, beforeAll } from "vitest"

// Clé de test dédiée — indépendante de .env, pour que ce test reste autonome
// même si la config d'environnement change.
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "fF918aH/5YGVnFkHDxpW1ts18ogmzqXlHRl8VRBuOUc="
})

describe("crypto (chiffrement au repos)", () => {
  it("encrypt/decrypt fait un aller-retour fidèle", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto")
    const original = "FR7630006000011234567890189"
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toMatch(/^enc:v1:/)
    expect(decrypt(encrypted)).toBe(original)
  })

  it("produit un chiffré différent à chaque appel (IV aléatoire)", async () => {
    const { encrypt } = await import("@/lib/crypto")
    const a = encrypt("secret")
    const b = encrypt("secret")
    expect(a).not.toBe(b)
  })

  it("laisse passer null/undefined sans y toucher", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto")
    expect(encrypt(null)).toBeNull()
    expect(encrypt(undefined)).toBeUndefined()
    expect(decrypt(null)).toBeNull()
    expect(decrypt(undefined)).toBeUndefined()
  })

  it("decrypt retourne une valeur en clair (sans préfixe) telle quelle — compat ascendante", async () => {
    const { decrypt } = await import("@/lib/crypto")
    expect(decrypt("FR7630006000011234567890189")).toBe("FR7630006000011234567890189")
  })
})
