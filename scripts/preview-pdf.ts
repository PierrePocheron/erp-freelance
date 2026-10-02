#!/usr/bin/env tsx
/**
 * ─────────────────────────────────────────────────────────────────
 *  ERP Freelance — Aperçu du template PDF (sans base de données)
 * ─────────────────────────────────────────────────────────────────
 *  Usage :
 *    PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx tsx scripts/preview-pdf.ts
 *
 *  Rend trois documents factices dans /tmp :
 *    /tmp/erp-preview-facture.pdf   (facture standard, lignes multiples)
 *    /tmp/erp-preview-acompte.pdf   (facture d'acompte)
 *    /tmp/erp-preview-devis.pdf     (devis avec bon pour accord)
 *
 *  ⚠️ Repo PUBLIC : uniquement des valeurs inventées ici (clients, adresses,
 *  SIRET, IBAN, numéros, montants) — jamais une vraie facture recopiée.
 * ─────────────────────────────────────────────────────────────────
 */
import fs from "fs"
import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "../src/lib/pdf"

const emitter = {
  name: "M. JEAN EXEMPLE",
  email: "contact@exemple.fr",
  companyName: "Studio Exemple",
  address: "1 rue de l'Exemple",
  postalCode: "69000",
  city: "Lyon",
  siret: "00000000000000",
  phone: "06 00 00 00 00",
  bankName: "Banque Exemple",
  iban: "FR76 3000 6000 0112 3456 7890 189",
  bic: "EXEMFRPP",
}

const conditions = `En conformité de l'article L 441-6 du Code de commerce :
Tout règlement effectué après expiration du délai de paiement (soit un mois après la date de réception) donnera lieu, à titre de pénalité de retard, à l'application d'un intérêt égal à celui appliqué par la Banque Centrale Européenne à son opération de refinancement la plus récente, majoré de 10 (dix) points de pourcentage, ainsi qu'à une indemnité forfaitaire pour frais de recouvrement d'un montant de 40 (quarante) euros.
Les pénalités de retard sont exigibles sans qu'un rappel soit nécessaire.
TVA non applicable (Art. 293B du CGI)`

const branding = {
  accentColor: "#6BCB3D",
  logoText: "JE",
  logoSubtext: "STUDIO EXEMPLE",
  backgroundColor: "#FAF6EE",
}

const client = {
  name: "Boulangerie Démo",
  company: "BOULANGERIE DÉMO",
  address: "2 place de la Démo",
  postalCode: "75000",
  city: "Paris",
  email: "contact@boulangerie-demo.fr",
  siret: "00000000000000",
}

const facture = {
  type: "FACTURE" as const,
  number: "FA-0001",
  createdAt: new Date("2026-01-31"),
  dueDate: new Date("2026-02-28"),
  ...branding,
  emitter,
  client,
  lines: [
    {
      description: "Site vitrine\n- 4 pages : Accueil, Produits, Horaires, Contact\n- Responsive ordinateur, mobile et tablette",
      quantity: 4,
      unitPrice: 250,
      taxRate: 0,
      total: 1000,
    },
    {
      description: "Maintenance mensuelle",
      detail: "Mises à jour techniques\nSauvegardes régulières\nCertificat SSL (HTTPS)",
      quantity: 1,
      unitPrice: 30,
      taxRate: 0,
      total: 30,
    },
    {
      description: "Atelier de prise en main (offert)",
      quantity: 0,
      unitPrice: 0,
      taxRate: 0,
      total: 0,
    },
  ],
  generalConditions: conditions,
  totalHT: 1030,
}

const acompte = {
  type: "FACTURE" as const,
  invoiceType: "DEPOSIT" as const,
  number: "FA-0002",
  createdAt: new Date("2026-03-02"),
  ...branding,
  emitter,
  client,
  lines: [
    {
      description: "Acompte 30 % sur devis N°DE-0001 — Création du site vitrine",
      quantity: 1,
      unitPrice: 300,
      taxRate: 0,
      total: 300,
    },
  ],
  generalConditions: conditions,
  totalHT: 300,
}

const devis = {
  type: "DEVIS" as const,
  number: "DE-0001",
  createdAt: new Date("2026-02-20"),
  expiresAt: new Date("2026-03-20"),
  depositPercent: 30,
  ...branding,
  emitter,
  client,
  lines: [
    {
      description:
        "Création du site web :\n- 5 pages : Accueil, Produits, Horaires, Galerie, Contact\n- Intégration du design et des contenus fournis par le client\n- Responsive ordinateur, mobile et tablette",
      quantity: 5,
      unitPrice: 200,
      taxRate: 0,
      total: 1000,
    },
    {
      description: "Hébergement mensuel :\n- Hébergement du site\n- Certificat SSL (HTTPS)\n- Sauvegardes régulières",
      quantity: 1,
      unitPrice: 20,
      taxRate: 0,
      total: 20,
    },
  ],
  generalConditions: "Acompte de 30 % à la commande, solde à la livraison.\nTVA non applicable, art. 293 B du CGI.",
  totalHT: 1020,
}

async function main() {
  const docs = [
    { props: facture, out: "/tmp/erp-preview-facture.pdf" },
    { props: acompte, out: "/tmp/erp-preview-acompte.pdf" },
    { props: devis, out: "/tmp/erp-preview-devis.pdf" },
  ]
  for (const { props, out } of docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element: any = React.createElement(InvoicePDF, props as any)
    const buffer = await renderToBuffer(element)
    fs.writeFileSync(out, buffer)
    console.log(`✓ ${out} (${(buffer.length / 1024).toFixed(0)} Ko)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
