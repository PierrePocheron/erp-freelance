import { describe, it, expect } from "vitest"
import { ProspectStage, ProspectStatus } from "@/generated/prisma/enums"
import {
  LEGACY_STAGE_TO_STATUS, STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, ALL_STATUSES,
} from "@/components/modules/prospection/status-config"

// Le mapping TS est le miroir du backfill SQL de la migration
// 20260709175541_prospection_status_website_emailing — garde-fou d'exhaustivité.

describe("LEGACY_STAGE_TO_STATUS", () => {
  it("couvre exhaustivement les 10 valeurs de l'ancien enum ProspectStage", () => {
    const stages = Object.keys(ProspectStage)
    expect(Object.keys(LEGACY_STAGE_TO_STATUS).sort()).toEqual(stages.sort())
  })

  it("mappe chaque étape legacy vers la valeur attendue du backfill SQL", () => {
    expect(LEGACY_STAGE_TO_STATUS.IDENTIFIED).toBe("TO_CONTACT")
    expect(LEGACY_STAGE_TO_STATUS.CONTACTED).toBe("CONTACTED")
    expect(LEGACY_STAGE_TO_STATUS.NO_RESPONSE).toBe("CONTACTED")
    expect(LEGACY_STAGE_TO_STATUS.REPLIED).toBe("REPLIED")
    expect(LEGACY_STAGE_TO_STATUS.MEETING).toBe("IN_DISCUSSION")
    expect(LEGACY_STAGE_TO_STATUS.PROPOSAL_SENT).toBe("IN_DISCUSSION")
    expect(LEGACY_STAGE_TO_STATUS.NEGOTIATION).toBe("IN_DISCUSSION")
    expect(LEGACY_STAGE_TO_STATUS.WON).toBe("WON")
    expect(LEGACY_STAGE_TO_STATUS.LOST).toBe("LOST")
    expect(LEGACY_STAGE_TO_STATUS.ON_HOLD).toBe("LOST")
  })

  it("ne produit que des valeurs du nouvel enum ProspectStatus", () => {
    const validStatuses = Object.keys(ProspectStatus)
    for (const status of Object.values(LEGACY_STAGE_TO_STATUS)) {
      expect(validStatuses).toContain(status)
    }
  })
})

describe("STATUS_CONFIG", () => {
  it("a une entrée par valeur de ProspectStatus, ni plus ni moins", () => {
    expect(Object.keys(STATUS_CONFIG).sort()).toEqual(Object.keys(ProspectStatus).sort())
  })

  it("PIPELINE + OUTCOME partitionnent l'ensemble des statuts", () => {
    expect([...PIPELINE_STATUSES, ...OUTCOME_STATUSES].sort()).toEqual(Object.keys(ProspectStatus).sort())
    expect(ALL_STATUSES).toHaveLength(Object.keys(ProspectStatus).length)
  })
})
