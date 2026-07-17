#!/usr/bin/env tsx
/**
 * ─────────────────────────────────────────────────────────────────
 *  ERP Freelance — Aperçu du template PDF (sans base de données)
 * ─────────────────────────────────────────────────────────────────
 *  Usage :
 *    PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx tsx scripts/preview-pdf.ts
 *
 *  Rend trois documents factices avec le template « Pedro » dans /tmp :
 *    /tmp/erp-preview-facture.pdf   (facture standard, style Canva)
 *    /tmp/erp-preview-acompte.pdf   (facture d'acompte)
 *    /tmp/erp-preview-devis.pdf     (devis avec bon pour accord)
 *  Données 100 % mockées — aucune connexion DB.
 * ─────────────────────────────────────────────────────────────────
 */
import fs from "fs"
import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "../src/lib/pdf"

const emitter = {
  name: "M. PIERRE POCHERON",
  email: "pierre@exemple.fr",
  companyName: "Pedro Dev",
  address: "1 rue de l'Exemple",
  postalCode: "69200",
  city: "Lyon",
  siret: "00000000000000",
  phone: "06 00 00 00 00",
  bankName: "Revolut",
  iban: "FR7600000000000000000000000",
  bic: "REVOFRP2",
}

const conditions = `En conformité de l'article L 441-6 du Code de commerce :
Tout règlement effectué après expiration du délai de paiement (soit un mois après la date de réception) donnera lieu, à titre de pénalité de retard, à l'application d'un intérêt égal à celui appliqué par la Banque Centrale Européenne à son opération de refinancement la plus récente, majoré de 10 (dix) points de pourcentage, ainsi qu'à une indemnité forfaitaire pour frais de recouvrement d'un montant de 40 (quarante) euros.
Les pénalités de retard sont exigibles sans qu'un rappel soit nécessaire.
TVA non applicable (Art. 293B du CGI)`

const branding = {
  accentColor: "#6BCB3D",
  logoText: "PP",
  logoSubtext: "PEDRO DEV",
  backgroundColor: "#FAF6EE",
}

const facture = {
  type: "FACTURE" as const,
  number: "250701",
  createdAt: new Date("2025-07-31"),
  dueDate: new Date("2025-08-31"),
  ...branding,
  emitter,
  client: {
    name: "Concept Dojo",
    company: "CONCEPT DOJO",
    address: "9 rue de l'épée",
    postalCode: "69003",
    city: "Lyon 3",
    siret: "43868572200012",
  },
  lines: [
    {
      description:
        "CVH – Lyon 2\n- Entretien complet des vitres intérieures et extérieures\n- Nettoyage de la devanture",
      quantity: 117.05,
      unitPrice: 25,
      taxRate: 0,
      total: 2937.5,
    },
    {
      description:
        "CVH – Lyon 3\n- Débarras, tri, nettoyage et réorganisation du garage\n- Dépose et retrait du câblage coaxial obsolète, du lino, de la fibre de verre murale et plafond, des plinthes et des prises\n- Travaux de préparation murale : ponçage, rebouchage, application d'enduit et lissage\n- Déplacement du mobilier et bâchage\n- Pose de carrelage à l'accueil + joint\n- Réparations diverses : escalier, sac de frappe, etc.\n- Nettoyage de la devanture",
      quantity: 0,
      unitPrice: 0,
      taxRate: 0,
      total: 0,
    },
    {
      description: "CVH – Lyon 8 - Berthelot",
      detail:
        "Entretien extérieur : désherbage, nettoyage des abords, jardin (intégral), et devanture\nNettoyage complet de toutes les machines et de l'espace d'entraînement\nRéorganisation de l'espace, ajout de machine, pose de goulotte à l'accueil\nNettoyage des murs des vestiaires bas\nRéparation du sol : développé couché, escalier, traitement d'une bulle sous le revêtement\nTravaux muraux : enduit, ponçage, rebouchage des murs fissurés et sous miroirs\nRemplacement des ampoules (entrée et extérieur)\nDépoussiérage complet du dojo et nettoyage des toiles d'araignées au plafond\nGestion d'un conflit entre adhérents\nNettoyage de la devanture",
      quantity: 0,
      unitPrice: 0,
      taxRate: 0,
      total: 0,
    },
    {
      description:
        "Club 48 - Monplasir\n- Visite du site, prise de photos et vidéos pour évaluation des besoins",
      quantity: 0,
      unitPrice: 0,
      taxRate: 0,
      total: 0,
    },
  ],
  generalConditions: conditions,
  totalHT: 2937.5,
}

const acompte = {
  type: "FACTURE" as const,
  invoiceType: "DEPOSIT" as const,
  number: "FA260402",
  createdAt: new Date("2026-04-22"),
  ...branding,
  emitter,
  client: {
    name: "Billyboat",
    address: "28 ter route de Bordeaux",
    postalCode: "33950",
    city: "Lege-Cap-Ferret",
    email: "contact.billyboat@gmail.com",
    siret: "89401602100012",
  },
  lines: [
    {
      description: "Acompte 30% sur devis N°260402 — Création site web Billy Boat",
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
  number: "260402",
  createdAt: new Date("2026-04-14"),
  expiresAt: new Date("2026-05-14"),
  depositPercent: 30,
  ...branding,
  emitter,
  client: {
    name: "Billyboat",
    address: "28 ter route de Bordeaux",
    postalCode: "33950",
    city: "Lege-Cap-Ferret",
    email: "contact.billyboat@gmail.com",
    siret: "89401602100012",
  },
  lines: [
    {
      description:
        "Création du site web :\n- 5 pages : Accueil, Location de bateau, Gestion locative, Services, Contact\n- Intégration du design et des contenus (textes et photos fournis par le client)\n- Redirection lien de réservation vers Nautic Manager\n- Responsive ordinateur, mobile et tablette",
      quantity: 5,
      unitPrice: 200,
      taxRate: 0,
      total: 1000,
    },
    {
      description:
        "Hébergement mensuel :\n- Hébergement du site\n- Certificat SSL (HTTPS)\n- Sauvegardes régulières\n- Mises à jour techniques",
      quantity: 1,
      unitPrice: 20,
      taxRate: 0,
      total: 20,
    },
  ],
  generalConditions: "Acompte de 30% à la commande, solde à la livraison.\nTVA non applicable, art. 293 B du CGI.",
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
