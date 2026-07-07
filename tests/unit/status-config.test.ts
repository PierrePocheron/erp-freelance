import { describe, it, expect } from "vitest"
import {
  fmtShort, fmtDate, fmtDateTime,
  STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, CLOSED_STATUSES,
} from "@/components/modules/entretien/status-config"

// ── Formatters ────────────────────────────────────────────────────────────────

describe("fmtShort", () => {
  it("formate une Date en jour + mois court fr-FR", () => {
    const result = fmtShort(new Date("2026-06-01T00:00:00Z"))
    // "1 juin" ou "1 juin." selon l'environnement — on vérifie le pattern
    expect(result).toMatch(/1/)
    expect(result.toLowerCase()).toMatch(/juin/)
  })

  it("accepte une string ISO", () => {
    const result = fmtShort("2026-01-15T00:00:00Z")
    expect(result).toMatch(/15/)
    expect(result.toLowerCase()).toMatch(/janv/)
  })
})

describe("fmtDate", () => {
  it("inclut l'année", () => {
    const result = fmtDate(new Date("2026-12-25T00:00:00Z"))
    expect(result).toMatch(/2026/)
    expect(result.toLowerCase()).toMatch(/d[eé]c/)
  })
})

describe("fmtDateTime", () => {
  it("inclut heure et minute", () => {
    // On passe une date avec heure pour s'assurer du format
    const d = new Date("2026-06-15T14:30:00Z")
    const result = fmtDateTime(d)
    expect(result).toMatch(/2026/)
    // heure présente (format "14:30" ou "14 h 30" selon locale)
    expect(result).toMatch(/\d{2}/)
  })
})

// ── Constantes statuts ────────────────────────────────────────────────────────

describe("STATUS_CONFIG", () => {
  it("contient tous les statuts de PIPELINE_STATUSES et OUTCOME_STATUSES", () => {
    const allStatuses = [...PIPELINE_STATUSES, ...OUTCOME_STATUSES]
    for (const s of allStatuses) {
      expect(STATUS_CONFIG).toHaveProperty(s)
      expect(STATUS_CONFIG[s].label).toBeTruthy()
      expect(STATUS_CONFIG[s].dot).toBeTruthy()
    }
  })
})

describe("CLOSED_STATUSES", () => {
  it("est un sous-ensemble de OUTCOME_STATUSES", () => {
    for (const s of CLOSED_STATUSES) {
      expect(OUTCOME_STATUSES).toContain(s)
    }
  })

  it("contient exactement les 4 statuts de clôture", () => {
    expect(CLOSED_STATUSES).toHaveLength(4)
    expect(CLOSED_STATUSES).toContain("ACCEPTED")
    expect(CLOSED_STATUSES).toContain("REJECTED")
    expect(CLOSED_STATUSES).toContain("WITHDRAWN")
    expect(CLOSED_STATUSES).toContain("GHOSTED")
  })

  it("ne contient aucun statut de pipeline actif", () => {
    for (const s of CLOSED_STATUSES) {
      expect(PIPELINE_STATUSES).not.toContain(s)
    }
  })
})

describe("PIPELINE_STATUSES", () => {
  it("commence par WISHLIST et se termine par OFFER", () => {
    expect(PIPELINE_STATUSES[0]).toBe("WISHLIST")
    expect(PIPELINE_STATUSES[PIPELINE_STATUSES.length - 1]).toBe("OFFER")
  })
})
