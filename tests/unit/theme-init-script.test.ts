import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_HASH } from "@/lib/theme-init-script"

describe("theme-init-script (CSP)", () => {
  it("le hash CSP correspond au contenu du script", () => {
    // Si ce test casse : le script a changé sans régénérer le hash → la CSP
    // bloquerait son exécution en prod (écran blanc de thème / FOUC).
    // Commande de régénération dans src/lib/theme-init-script.ts.
    const expected = "sha256-" + createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")
    expect(THEME_INIT_SCRIPT_HASH).toBe(expected)
  })
})
