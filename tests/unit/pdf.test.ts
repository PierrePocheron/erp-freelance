import { describe, it, expect } from "vitest"
import React, { type ReactElement } from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { InvoicePDF } from "@/lib/pdf"

// Rendu smoke du template PDF « Pedro » — aucune DB, props factices (mêmes
// données que scripts/preview-pdf.ts, en condensé). Si les polices Poppins /
// Barbra manquent, le fallback Helvetica doit suffire : le test valide aussi ça.

type PdfProps = Parameters<typeof InvoicePDF>[0]

function renderPdf(props: PdfProps) {
  const element = React.createElement(InvoicePDF, props) as ReactElement<DocumentProps>
  return renderToBuffer(element)
}

const emitter = {
  name: "M. PIERRE POCHERON",
  email: "pierre@test.local",
  companyName: "Pedro Dev",
  address: "1 rue du Test",
  postalCode: "69200",
  city: "Vénissieux",
  siret: "12345678900011",
  bankName: "Revolut",
  iban: "FR7600000000000000000000000",
  bic: "REVOFRP2",
}

const client = {
  name: "Concept Dojo",
  company: "CONCEPT DOJO",
  address: "9 rue de l'épée",
  postalCode: "69003",
  city: "Lyon 3",
  email: "contact@dojo.fr",
}

const branding = {
  accentColor: "#6BCB3D",
  logoText: "PP",
  logoSubtext: "PEDRO DEV",
  backgroundColor: "#FAF6EE",
}

const simpleLine = {
  description: "Création site web",
  quantity: 1,
  unitPrice: 1000,
  taxRate: 0,
  total: 1000,
}

function expectPdf(buffer: Buffer) {
  expect(buffer.length).toBeGreaterThan(0)
  expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-")
}

describe("template PDF (rendu smoke sans DB)", () => {
  it("rend une facture standard", async () => {
    const buffer = await renderPdf({
      type: "FACTURE",
      number: "FA260701",
      createdAt: new Date("2026-07-01"),
      dueDate: new Date("2026-08-01"),
      ...branding,
      emitter,
      client,
      lines: [simpleLine],
      generalConditions: "TVA non applicable (Art. 293B du CGI)",
      totalHT: 1000,
    })
    expectPdf(buffer)
  }, 30_000)

  it("rend une facture d'acompte (invoiceType DEPOSIT)", async () => {
    const buffer = await renderPdf({
      type: "FACTURE",
      invoiceType: "DEPOSIT",
      number: "FA260702",
      createdAt: new Date("2026-07-02"),
      ...branding,
      emitter,
      client,
      lines: [
        {
          description: "Acompte 30% sur devis N°260702 — Création site web",
          quantity: 1,
          unitPrice: 300,
          taxRate: 0,
          total: 300,
        },
      ],
      totalHT: 300,
    })
    expectPdf(buffer)
  }, 30_000)

  it("rend un devis avec acompte et bon pour accord", async () => {
    const buffer = await renderPdf({
      type: "DEVIS",
      number: "260701",
      createdAt: new Date("2026-07-01"),
      expiresAt: new Date("2026-08-01"),
      depositPercent: 30,
      ...branding,
      emitter,
      client,
      lines: [simpleLine],
      generalConditions: "Acompte de 30% à la commande, solde à la livraison.",
      totalHT: 1000,
    })
    expectPdf(buffer)
  }, 30_000)

  it("ne plante pas sur une description multi-lignes avec puces « - »", async () => {
    const buffer = await renderPdf({
      type: "FACTURE",
      number: "FA260703",
      createdAt: new Date("2026-07-03"),
      ...branding,
      emitter,
      client,
      lines: [
        {
          description:
            "Création du site web :\n- 5 pages : Accueil, Services, Contact\n- Intégration du design\n• Responsive mobile et tablette",
          detail: "Hébergement inclus\nCertificat SSL (HTTPS)",
          quantity: 5,
          unitPrice: 200,
          taxRate: 20,
          total: 1000,
        },
        {
          // Ligne informative (tout à zéro) : montants masqués mais rendu OK.
          description: "Suivi projet\n- Réunions hebdomadaires",
          quantity: 0,
          unitPrice: 0,
          taxRate: 0,
          total: 0,
        },
      ],
      totalHT: 1000,
    })
    expectPdf(buffer)
  }, 30_000)
})
