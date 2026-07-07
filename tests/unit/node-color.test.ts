import { describe, it, expect } from "vitest"
import { nodeColor, NODE_BASE_COLORS, INVOICE_STATUS_COLOR, PROJECT_STATUS_COLOR } from "@/components/modules/graph/graph-types"
import type { RawNode } from "@/components/modules/graph/graph-types"

function node(overrides: Partial<RawNode>): RawNode {
  return {
    id: "test",
    type: "COMPANY",
    label: "Test",
    parentId: null,
    meta: {},
    ...overrides,
  }
}

describe("nodeColor — types sans statut", () => {
  it("retourne la couleur de base pour COMPANY", () => {
    expect(nodeColor(node({ type: "COMPANY" }))).toBe(NODE_BASE_COLORS.COMPANY)
  })

  it("retourne la couleur de base pour CLIENT", () => {
    expect(nodeColor(node({ type: "CLIENT" }))).toBe(NODE_BASE_COLORS.CLIENT)
  })

  it("retourne la couleur de base pour PROJECT sans statut", () => {
    expect(nodeColor(node({ type: "PROJECT" }))).toBe(NODE_BASE_COLORS.PROJECT)
  })

  it("retourne la couleur de base pour QUOTE", () => {
    expect(nodeColor(node({ type: "QUOTE" }))).toBe(NODE_BASE_COLORS.QUOTE)
  })
})

describe("nodeColor — INVOICE : couleur basée sur le statut", () => {
  it("PAID → vert emeraude", () => {
    expect(nodeColor(node({ type: "INVOICE", status: "PAID" }))).toBe(INVOICE_STATUS_COLOR.PAID)
  })

  it("SENT → bleu", () => {
    expect(nodeColor(node({ type: "INVOICE", status: "SENT" }))).toBe(INVOICE_STATUS_COLOR.SENT)
  })

  it("LATE → rouge", () => {
    expect(nodeColor(node({ type: "INVOICE", status: "LATE" }))).toBe(INVOICE_STATUS_COLOR.LATE)
  })

  it("DRAFT → gris", () => {
    expect(nodeColor(node({ type: "INVOICE", status: "DRAFT" }))).toBe(INVOICE_STATUS_COLOR.DRAFT)
  })

  it("CANCELLED → gris foncé", () => {
    expect(nodeColor(node({ type: "INVOICE", status: "CANCELLED" }))).toBe(INVOICE_STATUS_COLOR.CANCELLED)
  })

  it("statut inconnu → fallback sur la couleur de base INVOICE", () => {
    expect(nodeColor(node({ type: "INVOICE", status: "UNKNOWN_STATUS" }))).toBe(NODE_BASE_COLORS.INVOICE)
  })

  it("pas de statut → couleur de base INVOICE", () => {
    expect(nodeColor(node({ type: "INVOICE" }))).toBe(NODE_BASE_COLORS.INVOICE)
  })
})

describe("nodeColor — PROJECT : couleur basée sur le statut", () => {
  it("ACTIVE → violet", () => {
    expect(nodeColor(node({ type: "PROJECT", status: "ACTIVE" }))).toBe(PROJECT_STATUS_COLOR.ACTIVE)
  })

  it("COMPLETED → vert", () => {
    expect(nodeColor(node({ type: "PROJECT", status: "COMPLETED" }))).toBe(PROJECT_STATUS_COLOR.COMPLETED)
  })

  it("PAUSED → ambre", () => {
    expect(nodeColor(node({ type: "PROJECT", status: "PAUSED" }))).toBe(PROJECT_STATUS_COLOR.PAUSED)
  })

  it("CANCELLED → gris", () => {
    expect(nodeColor(node({ type: "PROJECT", status: "CANCELLED" }))).toBe(PROJECT_STATUS_COLOR.CANCELLED)
  })

  it("statut inconnu → fallback sur la couleur de base PROJECT", () => {
    expect(nodeColor(node({ type: "PROJECT", status: "ANYTHING" }))).toBe(NODE_BASE_COLORS.PROJECT)
  })
})

describe("NODE_BASE_COLORS — valeurs non nulles", () => {
  it("toutes les couleurs de base sont des strings hexadécimales non vides", () => {
    for (const color of Object.values(NODE_BASE_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
