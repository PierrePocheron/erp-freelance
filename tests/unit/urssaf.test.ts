import { describe, it, expect } from "vitest"
import {
  periodKey,
  periodBounds,
  periodLabel,
  previousPeriod,
  nextPeriod,
  periodToDeclare,
  declarationDueDate,
  isQuarterKey,
  computeContributions,
  ratesFromProfile,
  type UrssafRates,
} from "@/lib/urssaf"

// Taux 2026 sans ACRE (défauts du schéma, relevés sur autoentrepreneur.urssaf.fr)
const RATES: UrssafRates = {
  BNC:          { cotisations: 25.60, vl: 2.20, cfp: 0.20 },
  BIC_SERVICES: { cotisations: 21.20, vl: 1.70, cfp: 0.10 },
  BIC_SALES:    { cotisations: 12.30, vl: 1.00, cfp: 0.10 },
}

describe("periodKey", () => {
  it("calcule le trimestre civil", () => {
    expect(periodKey(new Date(2026, 3, 15), "QUARTERLY")).toBe("2026-T2")
    expect(periodKey(new Date(2026, 0, 1),  "QUARTERLY")).toBe("2026-T1")
    expect(periodKey(new Date(2026, 11, 31), "QUARTERLY")).toBe("2026-T4")
  })

  it("calcule le mois avec zéro initial", () => {
    expect(periodKey(new Date(2026, 6, 5), "MONTHLY")).toBe("2026-07")
    expect(periodKey(new Date(2026, 10, 5), "MONTHLY")).toBe("2026-11")
  })
})

describe("isQuarterKey", () => {
  it("distingue trimestre et mois", () => {
    expect(isQuarterKey("2026-T2")).toBe(true)
    expect(isQuarterKey("2026-07")).toBe(false)
  })
})

describe("periodBounds", () => {
  it("borne un trimestre du 1er jour au dernier jour inclus", () => {
    const { start, end } = periodBounds("2026-T2")
    expect(start).toEqual(new Date(2026, 3, 1))
    expect(end.getMonth()).toBe(5)
    expect(end.getDate()).toBe(30) // 30 juin
    expect(end.getHours()).toBe(23)
  })

  it("borne un mois", () => {
    const { start, end } = periodBounds("2026-02")
    expect(start).toEqual(new Date(2026, 1, 1))
    expect(end.getDate()).toBe(28) // février 2026 non bissextile
  })
})

describe("previousPeriod / nextPeriod", () => {
  it("gère les bascules d'année en trimestriel", () => {
    expect(previousPeriod("2026-T1")).toBe("2025-T4")
    expect(previousPeriod("2026-T3")).toBe("2026-T2")
    expect(nextPeriod("2026-T4")).toBe("2027-T1")
    expect(nextPeriod("2026-T2")).toBe("2026-T3")
  })

  it("gère les bascules d'année en mensuel", () => {
    expect(previousPeriod("2026-01")).toBe("2025-12")
    expect(nextPeriod("2026-12")).toBe("2027-01")
    expect(nextPeriod("2026-09")).toBe("2026-10")
  })
})

describe("periodToDeclare", () => {
  it("début juillet en trimestriel → on déclare T2", () => {
    expect(periodToDeclare(new Date(2026, 6, 5), "QUARTERLY")).toBe("2026-T2")
  })

  it("janvier en trimestriel → on déclare le T4 de l'année passée", () => {
    expect(periodToDeclare(new Date(2026, 0, 15), "QUARTERLY")).toBe("2025-T4")
  })

  it("mensuel → mois précédent", () => {
    expect(periodToDeclare(new Date(2026, 6, 5), "MONTHLY")).toBe("2026-06")
  })
})

describe("declarationDueDate", () => {
  it("T2 (avr–juin) → échéance 31 juillet", () => {
    const due = declarationDueDate("2026-T2")
    expect(due.getMonth()).toBe(6)
    expect(due.getDate()).toBe(31)
    expect(due.getFullYear()).toBe(2026)
  })

  it("T4 → échéance 31 janvier de l'année suivante", () => {
    const due = declarationDueDate("2026-T4")
    expect(due.getFullYear()).toBe(2027)
    expect(due.getMonth()).toBe(0)
    expect(due.getDate()).toBe(31)
  })

  it("mensuel juin → échéance 31 juillet", () => {
    const due = declarationDueDate("2026-06")
    expect(due.getMonth()).toBe(6)
    expect(due.getDate()).toBe(31)
  })
})

describe("periodLabel", () => {
  it("libellé trimestriel avec mois", () => {
    expect(periodLabel("2026-T2")).toBe("T2 2026 · avril – juin")
  })
  it("libellé mensuel capitalisé", () => {
    expect(periodLabel("2026-07")).toBe("Juillet 2026")
  })
})

describe("computeContributions", () => {
  it("reproduit exactement la déclaration T2 2026 (capture URSSAF)", () => {
    // BNC 1260 € (Billy Boat) + BIC prestations 81 € (Farache, Fête des Lumières)
    const est = computeContributions({ BNC: 1260, BIC_SERVICES: 81 }, RATES, true)

    expect(est.byCategory.BNC.cotisations).toBe(323)          // 25,60 %
    expect(est.byCategory.BNC.vl).toBe(28)                    // 2,20 %
    expect(est.byCategory.BIC_SERVICES.cotisations).toBe(17)  // 21,20 %
    expect(est.byCategory.BIC_SERVICES.vl).toBe(1)            // 1,70 %

    expect(est.totalCA).toBe(1341)
    expect(est.totalCotisations).toBe(340)
    expect(est.totalVL).toBe(29)
    expect(est.totalCFP).toBe(3)   // CFP BNC 2,52 → 3 ; BIC 0,08 → 0
    expect(est.totalDue).toBe(372) // total payé à l'URSSAF
  })

  it("ignore le versement libératoire si non opté", () => {
    const est = computeContributions({ BNC: 1000 }, RATES, false)
    expect(est.totalVL).toBe(0)
    expect(est.totalDue).toBe(est.totalCotisations + est.totalCFP)
  })

  it("catégories absentes → zéro", () => {
    const est = computeContributions({}, RATES, true)
    expect(est.totalCA).toBe(0)
    expect(est.totalDue).toBe(0)
  })
})

describe("ratesFromProfile", () => {
  it("mappe les colonnes plates de UserProfile", () => {
    const rates = ratesFromProfile({
      rateBNCCotisations: 25.6, rateBNCVL: 2.2, rateBNCCFP: 0.2,
      rateBICServicesCotisations: 21.2, rateBICServicesVL: 1.7, rateBICServicesCFP: 0.1,
      rateBICSalesCotisations: 12.3, rateBICSalesVL: 1.0, rateBICSalesCFP: 0.1,
    })
    expect(rates.BNC.cotisations).toBe(25.6)
    expect(rates.BIC_SERVICES.vl).toBe(1.7)
    expect(rates.BIC_SALES.cotisations).toBe(12.3)
  })
})
