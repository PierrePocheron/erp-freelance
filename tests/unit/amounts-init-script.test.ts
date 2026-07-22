import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { AMOUNTS_INIT_SCRIPT, AMOUNTS_INIT_SCRIPT_HASH } from "@/lib/amounts-init-script"

describe("amounts-init-script (CSP)", () => {
  it("le hash CSP correspond au contenu du script", () => {
    // Si ce test casse : le script a changé sans régénérer le hash → la CSP
    // bloquerait son exécution en prod (masquage des montants figé au 1er rendu).
    // Commande de régénération dans src/lib/amounts-init-script.ts.
    const expected = "sha256-" + createHash("sha256").update(AMOUNTS_INIT_SCRIPT).digest("base64")
    expect(AMOUNTS_INIT_SCRIPT_HASH).toBe(expected)
  })
})
