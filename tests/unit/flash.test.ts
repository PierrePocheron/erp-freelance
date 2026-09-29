import { describe, it, expect, vi, beforeEach } from "vitest"

const jar = new Map<string, string>()
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => { jar.set(k, v) },
  }),
}))
vi.mock("next/navigation", () => ({
  unstable_rethrow: (e: unknown) => {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e
  },
}))

const { runWithFlash, readFlash } = await import("@/lib/flash")

describe("runWithFlash", () => {
  beforeEach(() => jar.clear())

  it("succès : pose le message de confirmation", async () => {
    await runWithFlash(async () => {}, "Facture émise")
    expect(await readFlash()).toMatchObject({ kind: "success", message: "Facture émise" })
  })

  it("succès sans message : aucun flash", async () => {
    await runWithFlash(async () => {})
    expect(await readFlash()).toBeNull()
  })

  it("erreur métier : le message français est conservé (Next le masquerait en prod)", async () => {
    await runWithFlash(async () => { throw new Error("Le client n'a pas d'adresse email") }, "Envoyé")
    expect(await readFlash()).toMatchObject({ kind: "error", message: "Le client n'a pas d'adresse email" })
  })

  it("redirect() de Next traverse sans être avalé", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" })
    await expect(runWithFlash(async () => { throw redirectError })).rejects.toBe(redirectError)
    expect(await readFlash()).toBeNull()
  })

  it("cookie illisible → null", async () => {
    jar.set("flash", "{pas du json")
    expect(await readFlash()).toBeNull()
  })
})
