import { describe, it, expect } from "vitest"
import {
  isInvoiceEditable,
  isQuoteEditable,
  canIssueInvoice,
  canCancelInvoice,
  canRevertQuoteToDraft,
} from "@/lib/invoice-state"

describe("isInvoiceEditable / canIssueInvoice", () => {
  it("vrai uniquement en brouillon", () => {
    expect(isInvoiceEditable("DRAFT")).toBe(true)
    expect(canIssueInvoice("DRAFT")).toBe(true)
  })
  it("faux pour tout autre état", () => {
    for (const s of ["ISSUED", "SENT", "LATE", "PAID", "CANCELLED"]) {
      expect(isInvoiceEditable(s)).toBe(false)
      expect(canIssueInvoice(s)).toBe(false)
    }
  })
})

describe("canCancelInvoice", () => {
  it("on peut annuler une facture émise/envoyée/en retard/payée", () => {
    for (const s of ["ISSUED", "SENT", "LATE", "PAID"]) {
      expect(canCancelInvoice(s)).toBe(true)
    }
  })
  it("on ne peut annuler ni un brouillon ni une facture déjà annulée", () => {
    expect(canCancelInvoice("DRAFT")).toBe(false)
    expect(canCancelInvoice("CANCELLED")).toBe(false)
  })
})

describe("isQuoteEditable", () => {
  it("vrai uniquement en brouillon", () => {
    expect(isQuoteEditable("DRAFT")).toBe(true)
    for (const s of ["VALIDATED", "SENT", "ACCEPTED", "SIGNED", "REFUSED", "EXPIRED"]) {
      expect(isQuoteEditable(s)).toBe(false)
    }
  })
})

describe("canRevertQuoteToDraft", () => {
  it("vrai uniquement pour un devis validé (pas encore envoyé)", () => {
    expect(canRevertQuoteToDraft("VALIDATED")).toBe(true)
    for (const s of ["DRAFT", "SENT", "ACCEPTED", "SIGNED", "REFUSED", "EXPIRED"]) {
      expect(canRevertQuoteToDraft(s)).toBe(false)
    }
  })
})
