/**
 * Seed réel — Client BillyBoat Location
 * ──────────────────────────────────────
 * Usage : npx tsx scripts/seed-billyboat.ts
 *
 * ⚠️  Ajuste les montants du devis/facture avant d'exécuter.
 *     Le script est idempotent sur le client (upsert),
 *     mais crée le projet + les données liées une seule fois.
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(__dirname, "../.env.local") })
config({ path: resolve(__dirname, "../.env") })

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const d = (iso: string) => new Date(iso)

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) throw new Error("Aucun utilisateur trouvé. Connectez-vous d'abord.")
  const userId = user.id
  console.log(`\n🌱 Seed BillyBoat pour : ${user.email}\n`)

  // ── Client ───────────────────────────────────────────────────────────────

  const billyboat = await prisma.client.upsert({
    where: { id: "billyboat-real" },
    create: {
      id:          "billyboat-real",
      userId,
      type:        "CLIENT",
      name:        "BillyBoat Location",
      company:     "BillyBoat Location",
      email:       null,                         // ← à compléter si tu l'as
      phone:       "06 23 57 79 02",
      source:      "WORD_OF_MOUTH",
      temperature: "HOT",
      priorityScore: 9,
      address:     "19 Avenue du Bassin",
      postalCode:  "33950",
      city:        "Lège-Cap-Ferret",
      country:     "France",
      notes:       "Professionnels du nautisme depuis 2011. Location de bateaux sur le Bassin d'Arcachon (12 embarcations : coques rigides, semi-rigides, chaland). Note Google 4,8/5. Réseaux : @billyboat_location.",
    },
    update: {},
  })
  console.log("✅ Client BillyBoat")

  // ── Projet ────────────────────────────────────────────────────────────────

  const proj = await prisma.project.create({
    data: {
      userId,
      clientId:       billyboat.id,
      name:           "Site web BillyBoat Location",
      description:    "Création du site vitrine de location de bateaux sur le Bassin d'Arcachon. Formulaire de contact avec reCAPTCHA, emails transactionnels via Resend, déploiement Netlify, domaine OVH.",
      status:         "COMPLETED",
      startDate:      null,                      // ← à compléter si tu la connais
      endDate:        d("2026-05-23"),
      estimatedHours: null,
    },
  })
  console.log("✅ Projet")

  // ── Milestones ────────────────────────────────────────────────────────────

  await prisma.milestone.createMany({
    data: [
      { projectId: proj.id, name: "Design & maquettes",    date: d("2026-04-15"), status: "DONE" },
      { projectId: proj.id, name: "Développement",         date: d("2026-05-15"), status: "DONE" },
      { projectId: proj.id, name: "Mise en production",    date: d("2026-05-23"), status: "DONE" },
    ],
  })
  console.log("✅ Milestones (3)")

  // ── Tâches ────────────────────────────────────────────────────────────────

  await prisma.task.createMany({
    data: [
      { projectId: proj.id, title: "Brief client & collecte des contenus",           status: "DONE", priority: "HIGH",   completedAt: d("2026-04-01") },
      { projectId: proj.id, title: "Maquettes Figma (desktop + mobile)",             status: "DONE", priority: "HIGH",   completedAt: d("2026-04-14") },
      { projectId: proj.id, title: "Intégration HTML/CSS",                           status: "DONE", priority: "HIGH",   completedAt: d("2026-04-30") },
      { projectId: proj.id, title: "Formulaire de contact + reCAPTCHA",              status: "DONE", priority: "MEDIUM", completedAt: d("2026-05-10") },
      { projectId: proj.id, title: "Emails transactionnels via Resend",              status: "DONE", priority: "MEDIUM", completedAt: d("2026-05-12") },
      { projectId: proj.id, title: "Configuration domaine OVH + SSL",                status: "DONE", priority: "HIGH",   completedAt: d("2026-05-22") },
      { projectId: proj.id, title: "Déploiement Netlify & tests cross-device",       status: "DONE", priority: "HIGH",   completedAt: d("2026-05-23") },
    ],
  })
  console.log("✅ Tâches (7)")

  // ── Liens utiles ──────────────────────────────────────────────────────────

  await prisma.usefulLink.createMany({
    data: [
      { projectId: proj.id, label: "Prod — Site BillyBoat",      url: "https://billyboatlocation.com/location-de-bateau/",                          category: "PROD"   },
      { projectId: proj.id, label: "GitHub",                      url: "https://github.com/PierrePocheron/BillyBoat",                                category: "GITHUB" },
      { projectId: proj.id, label: "Netlify — Dashboard",         url: "https://app.netlify.com/projects/billyboat/overview",                        category: "OTHER"  },
      { projectId: proj.id, label: "OVH — Zone DNS",              url: "https://manager.eu.ovhcloud.com/#/web-domains/domain/billyboatlocation.com/zone", category: "DOCS" },
      { projectId: proj.id, label: "Resend — Domaines email",     url: "https://resend.com/domains",                                                 category: "OTHER"  },
      { projectId: proj.id, label: "Google reCAPTCHA — Console",  url: "https://www.google.com/recaptcha/admin/site/754908466",                      category: "OTHER"  },
    ],
  })
  console.log("✅ Liens utiles (6)")

  // ── Post-Dev ──────────────────────────────────────────────────────────────

  const postDev = await prisma.postDev.create({
    data: {
      projectId:    proj.id,
      prodUrl:      "https://billyboatlocation.com/location-de-bateau/",
      adminUrl:     null,                        // ← CMS/admin si applicable
      hostingUrl:   "https://app.netlify.com/projects/billyboat/overview",
      registrarUrl: "https://manager.eu.ovhcloud.com/#/web-domains/domain/billyboatlocation.com/zone",
    },
  })

  await prisma.renewal.createMany({
    data: [
      { postDevId: postDev.id, type: "DOMAIN",  name: "billyboatlocation.com",  expiresAt: d("2027-01-01") }, // ← date à vérifier sur OVH
      { postDevId: postDev.id, type: "HOSTING", name: "Netlify (free/pro)",     expiresAt: d("2027-01-01") }, // ← adapter si plan payant
    ],
  })
  console.log("✅ Post-Dev + 2 renouvellements")

  // ── Interaction — Mise en prod ────────────────────────────────────────────

  await prisma.interaction.create({
    data: {
      clientId:  billyboat.id,
      date:      d("2026-05-23T12:34:00"),
      channel:   "OTHER",
      summary:   "🚀 Mise en production du site à 12h34. Déploiement Netlify OK, domaine OVH propagé, reCAPTCHA et emails Resend testés et fonctionnels.",
    },
  })
  console.log("✅ Interaction (mise en prod)")

  // ── Rappel — Facture à envoyer ────────────────────────────────────────────

  await prisma.reminder.create({
    data: {
      clientId: billyboat.id,
      dueDate:  d("2026-05-23"),
      note:     "Envoyer la facture de solde suite à la mise en prod du site.",
      isDone:   false,
    },
  })
  console.log("✅ Rappel (facture à envoyer)")

  // ── Devis ─────────────────────────────────────────────────────────────────
  // ⚠️  Mets à jour le montant (totalHT) et les lignes avant d'exécuter

  const quote = await prisma.quote.create({
    data: {
      userId,
      clientId:       billyboat.id,
      projectId:      proj.id,
      number:         "DEV-2026-BB01",           // ← adapter à ton numérotation
      status:         "ACCEPTED",
      depositPercent: 0,
      totalHT:        0,                         // ← À REMPLIR
      sentAt:         null,                      // ← date d'envoi du devis si tu l'as
      acceptedAt:     null,                      // ← date d'acceptation
      lines: {
        create: [
          {
            description: "Création site web BillyBoat Location",
            quantity:    1,
            unitPrice:   0,                      // ← À REMPLIR
            total:       0,                      // ← À REMPLIR
          },
        ],
      },
    },
  })
  console.log("✅ Devis (montant à compléter)")

  // ── Facture DRAFT — à envoyer cet après-midi ─────────────────────────────

  await prisma.invoice.create({
    data: {
      userId,
      clientId:        billyboat.id,
      projectId:       proj.id,
      quoteId:         quote.id,
      number:          "FAC-2026-BB01",          // ← adapter à ton numérotation
      type:            "FINAL",
      status:          "DRAFT",
      totalHT:         0,                        // ← À REMPLIR
      depositDeducted: 0,
      dueDate:         d("2026-06-06"),          // ← 14 jours à partir d'aujourd'hui
      notes:           "Solde — Création site web BillyBoat Location. Merci pour votre confiance.",
      lines: {
        create: [
          {
            description: "Création site web BillyBoat Location",
            quantity:    1,
            unitPrice:   0,                      // ← À REMPLIR
            total:       0,                      // ← À REMPLIR
          },
        ],
      },
    },
  })
  console.log("✅ Facture DRAFT (montant à compléter — à envoyer cet après-midi)")

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Seed BillyBoat terminé !

  Client  : BillyBoat Location (Lège-Cap-Ferret)
  Projet  : Site web BillyBoat Location — COMPLETED
  7 tâches toutes DONE
  6 liens utiles
  Post-Dev + 2 renouvellements (dates à vérifier)
  1 rappel : envoyer la facture aujourd'hui

  ⚠️  AVANT D'ENVOYER LA FACTURE :
     → Ouvre la facture FAC-2026-BB01 dans l'app
     → Mets à jour le montant et les lignes
     → Passe-la en SENT quand tu l'envoies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main()
  .catch((e) => { console.error("❌ Erreur :", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
