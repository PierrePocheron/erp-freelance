import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(__dirname, "../.env.local") })
config({ path: resolve(__dirname, "../.env") })

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Helpers ──────────────────────────────────────────────────────────────────

const d = (iso: string) => new Date(iso)

async function main() {
  // Trouve le user — il doit s'être connecté au moins une fois
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) {
    throw new Error("Aucun utilisateur trouvé. Connectez-vous d'abord via l'app, puis relancez le seed.")
  }
  const userId = user.id
  console.log(`\n🌱 Seed pour : ${user.email}\n`)

  // ── Profil utilisateur ───────────────────────────────────────────────────

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      companyName: "Pierre Pocheron Dev",
      siret: "123 456 789 00012",
      address: "42 rue de la République",
      postalCode: "69001",
      city: "Lyon",
      country: "France",
      phone: "+33 6 12 34 56 78",
      website: "https://pierrepocheron.dev",
      iban: "FR76 3000 6000 0112 3456 7890 189",
      bic: "BNPAFRPP",
      quotePrefix: "DEV",
      invoicePrefix: "FAC",
    },
    update: {},
  })
  console.log("✅ Profil utilisateur")

  // ── Tags ─────────────────────────────────────────────────────────────────

  const [tagFrontend, tagBackend, tagDesign, tagSEO, tagMaint] = await Promise.all([
    prisma.tag.upsert({ where: { userId_name: { userId, name: "Frontend" } }, create: { userId, name: "Frontend", color: "#3b82f6" }, update: {} }),
    prisma.tag.upsert({ where: { userId_name: { userId, name: "Backend" } }, create: { userId, name: "Backend", color: "#8b5cf6" }, update: {} }),
    prisma.tag.upsert({ where: { userId_name: { userId, name: "Design" } }, create: { userId, name: "Design", color: "#ec4899" }, update: {} }),
    prisma.tag.upsert({ where: { userId_name: { userId, name: "SEO" } }, create: { userId, name: "SEO", color: "#10b981" }, update: {} }),
    prisma.tag.upsert({ where: { userId_name: { userId, name: "Maintenance" } }, create: { userId, name: "Maintenance", color: "#f59e0b" }, update: {} }),
  ])
  console.log("✅ Tags (5)")

  // ── Produits ─────────────────────────────────────────────────────────────

  const [prodDev, prodDesign, prodMaint, prodSEO, prodHosting] = await Promise.all([
    prisma.product.create({ data: { userId, name: "Développement web", description: "Prestation de développement web (TJM)", unitPrice: 650, unit: "DAY" } }),
    prisma.product.create({ data: { userId, name: "Design UI/UX", description: "Conception d'interfaces et maquettes Figma", unitPrice: 800, unit: "DAY" } }),
    prisma.product.create({ data: { userId, name: "Maintenance mensuelle", description: "Forfait maintenance et mises à jour", unitPrice: 350, unit: "MONTH" } }),
    prisma.product.create({ data: { userId, name: "Audit & optimisation SEO", description: "Audit complet et plan d'action SEO", unitPrice: 500, unit: "UNIT" } }),
    prisma.product.create({ data: { userId, name: "Hébergement serveur", description: "Location serveur VPS", unitPrice: 15, unit: "MONTH" } }),
  ])
  console.log("✅ Produits (5)")

  // ── Clients ───────────────────────────────────────────────────────────────

  const techcorp = await prisma.client.create({
    data: {
      userId, type: "CLIENT", name: "Caroline Dubois", company: "TechCorp SAS",
      email: "caroline@techcorp.fr", phone: "+33 1 42 56 78 90",
      source: "WORD_OF_MOUTH", temperature: "HOT", priorityScore: 10,
      notes: "Client historique depuis 2023. Très bon contact, budget confortable. Référencé chez 2 autres boîtes.",
      createdAt: d("2023-09-01"),
    },
  })

  const studio = await prisma.client.create({
    data: {
      userId, type: "CLIENT", name: "Matthieu Renard", company: "Studio Créatif",
      email: "matthieu@studiocrea.fr", phone: "+33 6 87 65 43 21",
      source: "LINKEDIN", temperature: "WARM", priorityScore: 7,
      notes: "Graphiste indépendant qui cherche un dev pour ses clients. Partenariat potentiel.",
      createdAt: d("2026-02-01"),
    },
  })

  const bionatura = await prisma.client.create({
    data: {
      userId, type: "CLIENT", name: "Laura Petit", company: "BioNatura",
      email: "laura@bionatura.fr", phone: "+33 4 78 12 34 56",
      source: "INBOUND", temperature: "COLD", priorityScore: 5,
      notes: "E-commerce bio. Contrat de maintenance mensuel depuis nov. 2025.",
      createdAt: d("2025-10-15"),
    },
  })

  const nexus = await prisma.client.create({
    data: {
      userId, type: "PROSPECT", name: "Alexandre Martin", company: "Nexus Ventures",
      email: "alex@nexusventures.io", phone: "+33 6 11 22 33 44",
      source: "LINKEDIN", temperature: "HOT", priorityScore: 9,
      notes: "Rencontré au DevFest Lyon. Projet SaaS mobile. Budget estimé 15k€. Devis envoyé, attend la décision du board.",
      createdAt: d("2025-12-10"),
    },
  })

  const morand = await prisma.client.create({
    data: {
      userId, type: "PROSPECT", name: "Sophie Morand", company: "Cabinet Morand",
      email: "s.morand@cabinetmorand.fr",
      source: "WORD_OF_MOUTH", temperature: "WARM", priorityScore: 6,
      notes: "Recommandée par Caroline (TechCorp). Avocat en droit des affaires, cherche site vitrine.",
      createdAt: d("2026-04-01"),
    },
  })

  const foodtech = await prisma.client.create({
    data: {
      userId, type: "PROSPECT", name: "Thomas Girard", company: "FoodTech Solutions",
      email: "t.girard@foodtech.fr",
      source: "OTHER", temperature: "COLD", priorityScore: 3,
      notes: "Premier contact par email. MVP SaaS logistique alimentaire. Stade très early.",
      createdAt: d("2026-05-05"),
    },
  })

  await prisma.client.create({
    data: {
      userId, type: "INACTIVE", name: "Marc Lejeune", company: "Comm'Agence",
      email: "m.lejeune@commagence.fr",
      source: "OTHER", temperature: "COLD", priorityScore: 1,
      notes: "Mission terminée en 2024. Pas de suite prévue.",
      createdAt: d("2024-01-10"),
    },
  })
  console.log("✅ Clients (7)")

  // ── Interactions ──────────────────────────────────────────────────────────

  await prisma.interaction.createMany({
    data: [
      // TechCorp
      { clientId: techcorp.id, date: d("2026-01-10"), channel: "MEETING", summary: "Réunion de lancement — validation du brief et du planning. Devis accepté." },
      { clientId: techcorp.id, date: d("2026-02-14"), channel: "EMAIL", summary: "Retour sur les maquettes — 2 ajustements mineurs demandés, validés sous 24h." },
      { clientId: techcorp.id, date: d("2026-03-15"), channel: "CALL", summary: "Appel de clôture refonte — client très satisfait, évoque déjà un projet dashboard." },
      { clientId: techcorp.id, date: d("2026-03-20"), channel: "EMAIL", summary: "Brief dashboard analytics envoyé, réponse positive, démarrage mars." },
      { clientId: techcorp.id, date: d("2026-05-06"), channel: "CALL", summary: "Point d'avancement dashboard — API en cours, livraison prévue fin mai." },
      // Studio Créatif
      { clientId: studio.id, date: d("2026-02-05"), channel: "LINKEDIN", summary: "Premier contact — demande de devis identité visuelle pour nouveau studio photo." },
      { clientId: studio.id, date: d("2026-02-20"), channel: "MEETING", summary: "Réunion brief — vision créative claire, budget 3 200 € validé." },
      { clientId: studio.id, date: d("2026-04-28"), channel: "EMAIL", summary: "Envoi proposition logo v1 — 3 pistes graphiques. En attente de retour." },
      // BioNatura
      { clientId: bionatura.id, date: d("2025-10-20"), channel: "CALL", summary: "Appel découverte — besoin maintenance + amélioration SEO site WooCommerce." },
      { clientId: bionatura.id, date: d("2025-11-03"), channel: "EMAIL", summary: "Signature contrat maintenance mensuelle 350 €/mois. Démarrage immédiat." },
      { clientId: bionatura.id, date: d("2026-04-15"), channel: "EMAIL", summary: "Envoi rapport SEO mensuel — +23% trafic organique sur 3 mois." },
      // Nexus
      { clientId: nexus.id, date: d("2025-12-10"), channel: "LINKEDIN", summary: "Rencontré au DevFest Lyon — échange autour d'un projet app mobile React Native + API Node." },
      { clientId: nexus.id, date: d("2026-01-20"), channel: "CALL", summary: "Appel découverte — SaaS gestion RH mobile, ~15k€ budget. Specs à affiner." },
      { clientId: nexus.id, date: d("2026-03-05"), channel: "EMAIL", summary: "Envoi devis DEV-2026-004 (12 000 €). Décision attendue après board mi-mars." },
      // Cabinet Morand
      { clientId: morand.id, date: d("2026-04-02"), channel: "EMAIL", summary: "Demande reçue par recommandation de TechCorp — site vitrine avocat." },
      { clientId: morand.id, date: d("2026-04-10"), channel: "CALL", summary: "Appel découverte — budget ~1 800 €, site sobre et professionnel, délai 6 semaines." },
      // FoodTech
      { clientId: foodtech.id, date: d("2026-05-05"), channel: "EMAIL", summary: "Premier contact entrant — MVP SaaS logistique. Demande de disponibilités." },
    ],
  })
  console.log("✅ Interactions (17)")

  // ── Rappels ───────────────────────────────────────────────────────────────

  await prisma.reminder.createMany({
    data: [
      { clientId: techcorp.id, dueDate: d("2026-05-22"), note: "Envoyer facture solde Dashboard Analytics", isDone: false },
      { clientId: nexus.id, dueDate: d("2026-05-08"), note: "Relancer Alexandre — décision board sur devis appli mobile", isDone: false },
      { clientId: morand.id, dueDate: d("2026-05-19"), note: "Envoyer devis site vitrine Cabinet Morand", isDone: false },
      { clientId: foodtech.id, dueDate: d("2026-05-28"), note: "Appel pour préciser specs MVP FoodTech", isDone: false },
      { clientId: studio.id, dueDate: d("2026-05-30"), note: "Relancer Matthieu pour retour logo v1", isDone: false },
    ],
  })
  console.log("✅ Rappels (5)")

  // ── Projets ───────────────────────────────────────────────────────────────

  // Projet 1 — Refonte e-commerce TechCorp (TERMINÉ)
  const projEcom = await prisma.project.create({
    data: {
      userId, clientId: techcorp.id,
      name: "Refonte e-commerce TechCorp",
      description: "Refonte complète de la boutique en ligne Shopify avec nouveau design et optimisation UX.",
      status: "COMPLETED",
      startDate: d("2026-01-06"),
      endDate: d("2026-03-14"),
      estimatedHours: 360,
      tags: { connect: [{ id: tagFrontend.id }, { id: tagBackend.id }] },
    },
  })

  // Projet 2 — Dashboard Analytics TechCorp (ACTIF)
  const projDash = await prisma.project.create({
    data: {
      userId, clientId: techcorp.id,
      name: "Dashboard Analytics TechCorp",
      description: "Tableau de bord temps réel des ventes, stocks et comportements clients. API REST + React.",
      status: "ACTIVE",
      startDate: d("2026-03-17"),
      endDate: d("2026-06-30"),
      estimatedHours: 240,
      tags: { connect: [{ id: tagBackend.id }, { id: tagFrontend.id }] },
    },
  })

  // Projet 3 — Identité visuelle Studio Créatif (ACTIF)
  const projStudio = await prisma.project.create({
    data: {
      userId, clientId: studio.id,
      name: "Identité visuelle Studio Créatif",
      description: "Création logo, charte graphique et déclinaisons print/digital pour studio photo lyonnais.",
      status: "ACTIVE",
      startDate: d("2026-02-10"),
      endDate: d("2026-05-30"),
      estimatedHours: 80,
      tags: { connect: [{ id: tagDesign.id }] },
    },
  })

  // Projet 4 — Maintenance BioNatura (ACTIF)
  const projBio = await prisma.project.create({
    data: {
      userId, clientId: bionatura.id,
      name: "Maintenance & SEO BioNatura",
      description: "Contrat mensuel : mises à jour WooCommerce, sécurité, optimisation SEO on-page.",
      status: "ACTIVE",
      startDate: d("2025-11-01"),
      estimatedHours: 16,
      tags: { connect: [{ id: tagMaint.id }, { id: tagSEO.id }] },
    },
  })
  console.log("✅ Projets (4)")

  // ── Milestones ────────────────────────────────────────────────────────────

  const [ms1, ms2, ms3] = await Promise.all([
    prisma.milestone.create({ data: { projectId: projEcom.id, name: "Design & maquettes", date: d("2026-01-31"), status: "DONE" } }),
    prisma.milestone.create({ data: { projectId: projEcom.id, name: "Développement", date: d("2026-02-28"), status: "DONE" } }),
    prisma.milestone.create({ data: { projectId: projEcom.id, name: "Recette & mise en prod", date: d("2026-03-14"), status: "DONE" } }),
  ])

  const [ms4, ms5, ms6] = await Promise.all([
    prisma.milestone.create({ data: { projectId: projDash.id, name: "Maquettes & specs", date: d("2026-04-04"), status: "DONE" } }),
    prisma.milestone.create({ data: { projectId: projDash.id, name: "API & base de données", date: d("2026-05-16"), status: "IN_PROGRESS" } }),
    prisma.milestone.create({ data: { projectId: projDash.id, name: "Interface & graphiques", date: d("2026-06-20"), status: "UPCOMING" } }),
  ])
  console.log("✅ Milestones (6)")

  // ── Tâches ────────────────────────────────────────────────────────────────

  // Projet 1 — toutes DONE
  const [t1a, t1b, t1c, t1d, t1e, t1f] = await Promise.all([
    prisma.task.create({ data: { projectId: projEcom.id, milestoneId: ms1.id, title: "Analyse des besoins & wireframes", status: "DONE", priority: "HIGH", estimatedHours: 8, completedAt: d("2026-01-15") } }),
    prisma.task.create({ data: { projectId: projEcom.id, milestoneId: ms1.id, title: "Design maquettes Figma (desktop + mobile)", status: "DONE", priority: "HIGH", estimatedHours: 16, completedAt: d("2026-01-28") } }),
    prisma.task.create({ data: { projectId: projEcom.id, milestoneId: ms2.id, title: "Intégration HTML/CSS Shopify", status: "DONE", priority: "MEDIUM", estimatedHours: 32, completedAt: d("2026-02-15") } }),
    prisma.task.create({ data: { projectId: projEcom.id, milestoneId: ms2.id, title: "Développement sections & fonctionnalités", status: "DONE", priority: "HIGH", estimatedHours: 48, completedAt: d("2026-02-28") } }),
    prisma.task.create({ data: { projectId: projEcom.id, milestoneId: ms3.id, title: "Tests cross-browser & corrections", status: "DONE", priority: "MEDIUM", estimatedHours: 16, completedAt: d("2026-03-10") } }),
    prisma.task.create({ data: { projectId: projEcom.id, milestoneId: ms3.id, title: "Déploiement & formation client", status: "DONE", priority: "LOW", estimatedHours: 8, completedAt: d("2026-03-14") } }),
  ])

  // Projet 2 — mix
  const [t2a, t2b, t2c, t2d, t2e, t2f, t2g] = await Promise.all([
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms4.id, title: "Cahier des charges technique", status: "DONE", priority: "HIGH", estimatedHours: 8, completedAt: d("2026-03-25") } }),
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms4.id, title: "Design dashboards Figma", status: "DONE", priority: "HIGH", estimatedHours: 16, completedAt: d("2026-04-03") } }),
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms5.id, title: "Setup PostgreSQL & schéma", status: "DONE", priority: "HIGH", estimatedHours: 12, completedAt: d("2026-04-15") } }),
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms5.id, title: "Développement API REST (endpoints)", status: "IN_PROGRESS", priority: "URGENT", estimatedHours: 48, startedAt: d("2026-04-16") } }),
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms6.id, title: "Intégration Chart.js & graphiques", status: "TODO", priority: "MEDIUM", estimatedHours: 24 } }),
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms6.id, title: "Authentification & gestion des rôles", status: "TODO", priority: "HIGH", estimatedHours: 16 } }),
    prisma.task.create({ data: { projectId: projDash.id, milestoneId: ms6.id, title: "Tests, documentation & déploiement", status: "TODO", priority: "MEDIUM", estimatedHours: 16 } }),
  ])

  // Projet 3 — Studio
  await Promise.all([
    prisma.task.create({ data: { projectId: projStudio.id, title: "Brief créatif & collecte références", status: "DONE", priority: "HIGH", estimatedHours: 4, completedAt: d("2026-02-25") } }),
    prisma.task.create({ data: { projectId: projStudio.id, title: "Recherches & moodboard", status: "DONE", priority: "MEDIUM", estimatedHours: 6, completedAt: d("2026-03-10") } }),
    prisma.task.create({ data: { projectId: projStudio.id, title: "Proposition logo v1 (3 pistes)", status: "DONE", priority: "HIGH", estimatedHours: 16, completedAt: d("2026-04-25") } }),
    prisma.task.create({ data: { projectId: projStudio.id, title: "Révisions logo suite retour client", status: "IN_PROGRESS", priority: "HIGH", estimatedHours: 8, startedAt: d("2026-05-05") } }),
    prisma.task.create({ data: { projectId: projStudio.id, title: "Charte graphique complète", status: "TODO", priority: "MEDIUM", estimatedHours: 20 } }),
    prisma.task.create({ data: { projectId: projStudio.id, title: "Livrables finaux (formats print + digital)", status: "TODO", priority: "LOW", estimatedHours: 8 } }),
  ])

  // Projet 4 — BioNatura
  await Promise.all([
    prisma.task.create({ data: { projectId: projBio.id, title: "Audit SEO initial (100+ critères)", status: "DONE", priority: "HIGH", estimatedHours: 8, completedAt: d("2025-11-15") } }),
    prisma.task.create({ data: { projectId: projBio.id, title: "Optimisation méta-données & balises", status: "DONE", priority: "MEDIUM", estimatedHours: 6, completedAt: d("2025-12-10") } }),
    prisma.task.create({ data: { projectId: projBio.id, title: "Maintenance mai 2026 — MàJ plugins", status: "IN_PROGRESS", priority: "MEDIUM", estimatedHours: 4, startedAt: d("2026-05-05") } }),
    prisma.task.create({ data: { projectId: projBio.id, title: "Optimisation vitesse (Core Web Vitals)", status: "TODO", priority: "HIGH", estimatedHours: 6 } }),
  ])
  console.log("✅ Tâches (23)")

  // ── Time Entries ──────────────────────────────────────────────────────────

  await prisma.timeEntry.createMany({
    data: [
      // Projet 1
      { taskId: t1c.id, userId, startedAt: d("2026-02-03T09:00:00"), endedAt: d("2026-02-03T17:00:00"), duration: 480, note: "Intégration header + pages catégories" },
      { taskId: t1c.id, userId, startedAt: d("2026-02-04T09:00:00"), endedAt: d("2026-02-04T18:00:00"), duration: 540, note: "Intégration fiche produit + panier" },
      { taskId: t1d.id, userId, startedAt: d("2026-02-10T09:00:00"), endedAt: d("2026-02-10T18:00:00"), duration: 540, note: "Développement filtres & recherche" },
      { taskId: t1d.id, userId, startedAt: d("2026-02-17T09:00:00"), endedAt: d("2026-02-17T17:30:00"), duration: 510, note: "Intégration paiement Stripe" },
      // Projet 2
      { taskId: t2c.id, userId, startedAt: d("2026-04-08T10:00:00"), endedAt: d("2026-04-08T18:00:00"), duration: 480, note: "Schéma DB + migrations initiales" },
      { taskId: t2d.id, userId, startedAt: d("2026-04-22T09:00:00"), endedAt: d("2026-04-22T18:00:00"), duration: 540, note: "Endpoints ventes & analytics" },
      { taskId: t2d.id, userId, startedAt: d("2026-04-29T09:00:00"), endedAt: d("2026-04-29T17:00:00"), duration: 480, note: "Endpoints stocks & alertes" },
      { taskId: t2d.id, userId, startedAt: d("2026-05-07T09:00:00"), endedAt: d("2026-05-07T16:00:00"), duration: 420, note: "Tests API + documentation Swagger" },
    ],
  })
  console.log("✅ Time entries (8)")

  // ── Livrables & Liens utiles ──────────────────────────────────────────────

  await prisma.deliverable.createMany({
    data: [
      { projectId: projEcom.id, name: "Maquettes Figma (desktop + mobile)", status: "VALIDATED", dueDate: d("2026-01-31") },
      { projectId: projEcom.id, name: "Site e-commerce Shopify", status: "VALIDATED", dueDate: d("2026-03-14") },
      { projectId: projEcom.id, name: "Guide d'administration", status: "VALIDATED", dueDate: d("2026-03-14") },
      { projectId: projDash.id, name: "Rapport de specs techniques", status: "VALIDATED", dueDate: d("2026-04-04") },
      { projectId: projDash.id, name: "Documentation API", status: "TO_DELIVER", dueDate: d("2026-05-30") },
      { projectId: projDash.id, name: "Dashboard final déployé", status: "TO_DELIVER", dueDate: d("2026-06-30") },
      { projectId: projStudio.id, name: "Logo SVG/PNG toutes versions", status: "DELIVERED", dueDate: d("2026-05-15") },
      { projectId: projStudio.id, name: "Charte graphique PDF", status: "TO_DELIVER", dueDate: d("2026-05-30") },
      { projectId: projStudio.id, name: "Pack réseaux sociaux", status: "TO_DELIVER", dueDate: d("2026-05-30") },
    ],
  })

  await prisma.usefulLink.createMany({
    data: [
      { projectId: projEcom.id, label: "Repo GitHub", url: "https://github.com/techcorp/ecommerce-shopify", category: "GITHUB" },
      { projectId: projEcom.id, label: "Boutique en ligne", url: "https://shop.techcorp.fr", category: "PROD" },
      { projectId: projEcom.id, label: "Admin Shopify", url: "https://shop.techcorp.fr/admin", category: "DOCS" },
      { projectId: projDash.id, label: "Repo GitHub", url: "https://github.com/techcorp/dashboard", category: "GITHUB" },
      { projectId: projDash.id, label: "Env staging", url: "https://dashboard-staging.techcorp.fr", category: "STAGING" },
      { projectId: projDash.id, label: "Maquettes Figma", url: "https://figma.com/file/dashboard-tc", category: "DOCS" },
      { projectId: projBio.id, label: "Admin WordPress", url: "https://bionatura.fr/wp-admin", category: "PROD" },
      { projectId: projBio.id, label: "Repo thème GitHub", url: "https://github.com/bionatura/theme", category: "GITHUB" },
    ],
  })
  console.log("✅ Livrables (9) & Liens utiles (8)")

  // ── Journal de bord ───────────────────────────────────────────────────────

  await prisma.journalEntry.createMany({
    data: [
      { projectId: projEcom.id, content: "RAS sur l'intégration Shopify, Caroline très réactive pour les retours. Légère optimisation des images à prévoir post-lancement.", createdAt: d("2026-02-20") },
      { projectId: projEcom.id, content: "Mise en prod réussie. 0 bug critique. Caroline a validé tous les points du cahier de recette. Projet clôturé.", createdAt: d("2026-03-14") },
      { projectId: projDash.id, content: "L'API prend du retard : les specs côté TechCorp ont évolué (ajout module prédictif). Délai repoussé à mi-juin.", createdAt: d("2026-04-30") },
    ],
  })
  console.log("✅ Journal de bord (3 entrées)")

  // ── Post-Dev (projet terminé uniquement) ──────────────────────────────────

  const postDev = await prisma.postDev.create({
    data: {
      projectId: projEcom.id,
      prodUrl: "https://shop.techcorp.fr",
      adminUrl: "https://shop.techcorp.fr/admin",
      hostingUrl: "https://partners.shopify.com",
      registrarUrl: "https://gandi.net",
    },
  })

  await prisma.renewal.createMany({
    data: [
      { postDevId: postDev.id, type: "DOMAIN", name: "techcorp.fr", expiresAt: d("2027-03-15") },
      { postDevId: postDev.id, type: "HOSTING", name: "Shopify Advanced", expiresAt: d("2027-01-31") },
    ],
  })

  await prisma.monitoringCheck.createMany({
    data: [
      { postDevId: postDev.id, checkedAt: d("2026-05-10T08:00:00"), isUp: true, statusCode: 200, responseTimeMs: 312 },
      { postDevId: postDev.id, checkedAt: d("2026-05-11T08:00:00"), isUp: true, statusCode: 200, responseTimeMs: 298 },
      { postDevId: postDev.id, checkedAt: d("2026-05-12T08:00:00"), isUp: true, statusCode: 200, responseTimeMs: 341 },
    ],
  })
  console.log("✅ Post-Dev + 2 renouvellements + 3 checks monitoring")

  // ── Devis ─────────────────────────────────────────────────────────────────

  const quote1 = await prisma.quote.create({
    data: {
      userId, clientId: techcorp.id, projectId: projEcom.id,
      number: "DEV-2026-001", status: "ACCEPTED", depositPercent: 30, totalHT: 8500,
      notes: "Acompte de 30% à la signature, solde à la livraison.",
      sentAt: d("2026-01-08"), acceptedAt: d("2026-01-09"), createdAt: d("2026-01-08"),
      lines: {
        create: [
          { productId: prodDev.id, description: "Développement Shopify — 13 jours", quantity: 13, unitPrice: 650, total: 8450 },
          { description: "Formation client (2h)", quantity: 1, unitPrice: 50, total: 50 },
        ],
      },
    },
  })

  const quote2 = await prisma.quote.create({
    data: {
      userId, clientId: techcorp.id, projectId: projDash.id,
      number: "DEV-2026-002", status: "ACCEPTED", depositPercent: 30, totalHT: 4500,
      sentAt: d("2026-03-18"), acceptedAt: d("2026-03-19"), createdAt: d("2026-03-18"),
      lines: {
        create: [
          { productId: prodDev.id, description: "Développement dashboard — 6 jours", quantity: 6, unitPrice: 650, total: 3900 },
          { productId: prodDesign.id, description: "Design UI/UX dashboards — 0,75 jour", quantity: 0.75, unitPrice: 800, total: 600 },
        ],
      },
    },
  })

  const quote3 = await prisma.quote.create({
    data: {
      userId, clientId: studio.id, projectId: projStudio.id,
      number: "DEV-2026-003", status: "ACCEPTED", depositPercent: 0, totalHT: 3200,
      sentAt: d("2026-02-22"), acceptedAt: d("2026-02-24"), createdAt: d("2026-02-22"),
      lines: {
        create: [
          { productId: prodDesign.id, description: "Identité visuelle complète — 4 jours", quantity: 4, unitPrice: 800, total: 3200 },
        ],
      },
    },
  })

  await prisma.quote.create({
    data: {
      userId, clientId: nexus.id,
      number: "DEV-2026-004", status: "SENT", depositPercent: 30, totalHT: 12000,
      notes: "Devis valable 30 jours. Acompte 30% à la signature du contrat.",
      sentAt: d("2026-03-05"), createdAt: d("2026-03-05"),
      lines: {
        create: [
          { productId: prodDev.id, description: "Développement React Native (app iOS + Android) — 12 jours", quantity: 12, unitPrice: 650, total: 7800 },
          { productId: prodDev.id, description: "API Node.js + base de données — 6 jours", quantity: 6, unitPrice: 650, total: 3900 },
          { description: "Mise en ligne App Store + Google Play", quantity: 1, unitPrice: 300, total: 300 },
        ],
      },
    },
  })
  console.log("✅ Devis (4)")

  // ── Factures ──────────────────────────────────────────────────────────────

  await prisma.invoice.create({
    data: {
      userId, clientId: techcorp.id, projectId: projEcom.id, quoteId: quote1.id,
      number: "FAC-2026-001", type: "DEPOSIT", status: "PAID",
      totalHT: 2550, depositDeducted: 0,
      dueDate: d("2026-01-23"), paidAt: d("2026-01-18"), sentAt: d("2026-01-09"), createdAt: d("2026-01-09"),
      notes: "Acompte 30% — refonte e-commerce",
      lines: { create: [{ description: "Acompte 30% — refonte e-commerce (DEV-2026-001)", quantity: 1, unitPrice: 2550, total: 2550 }] },
    },
  })

  await prisma.invoice.create({
    data: {
      userId, clientId: techcorp.id, projectId: projEcom.id, quoteId: quote1.id,
      number: "FAC-2026-002", type: "FINAL", status: "PAID",
      totalHT: 5950, depositDeducted: 2550,
      dueDate: d("2026-03-29"), paidAt: d("2026-03-22"), sentAt: d("2026-03-15"), createdAt: d("2026-03-15"),
      notes: "Solde refonte e-commerce — acompte FAC-2026-001 déduit",
      lines: {
        create: [
          { productId: prodDev.id, description: "Développement Shopify — 13 jours", quantity: 13, unitPrice: 650, total: 8450 },
          { description: "Formation client (2h)", quantity: 1, unitPrice: 50, total: 50 },
          { description: "Déduction acompte FAC-2026-001", quantity: 1, unitPrice: -2550, total: -2550 },
        ],
      },
    },
  })

  await prisma.invoice.create({
    data: {
      userId, clientId: techcorp.id, projectId: projDash.id, quoteId: quote2.id,
      number: "FAC-2026-003", type: "DEPOSIT", status: "PAID",
      totalHT: 1350, depositDeducted: 0,
      dueDate: d("2026-04-03"), paidAt: d("2026-03-27"), sentAt: d("2026-03-19"), createdAt: d("2026-03-19"),
      notes: "Acompte 30% — dashboard analytics",
      lines: { create: [{ description: "Acompte 30% — dashboard analytics (DEV-2026-002)", quantity: 1, unitPrice: 1350, total: 1350 }] },
    },
  })

  await prisma.invoice.create({
    data: {
      userId, clientId: bionatura.id, projectId: projBio.id,
      number: "FAC-2026-004", type: "RECURRING", status: "PAID",
      totalHT: 365, depositDeducted: 0,
      dueDate: d("2026-03-31"), paidAt: d("2026-03-28"), sentAt: d("2026-03-01"), createdAt: d("2026-03-01"),
      lines: {
        create: [
          { productId: prodMaint.id, description: "Maintenance mars 2026", quantity: 1, unitPrice: 350, total: 350 },
          { productId: prodHosting.id, description: "Hébergement mars 2026", quantity: 1, unitPrice: 15, total: 15 },
        ],
      },
    },
  })

  await prisma.invoice.create({
    data: {
      userId, clientId: bionatura.id, projectId: projBio.id,
      number: "FAC-2026-005", type: "RECURRING", status: "PAID",
      totalHT: 365, depositDeducted: 0,
      dueDate: d("2026-04-30"), paidAt: d("2026-04-25"), sentAt: d("2026-04-01"), createdAt: d("2026-04-01"),
      lines: {
        create: [
          { productId: prodMaint.id, description: "Maintenance avril 2026", quantity: 1, unitPrice: 350, total: 350 },
          { productId: prodHosting.id, description: "Hébergement avril 2026", quantity: 1, unitPrice: 15, total: 15 },
        ],
      },
    },
  })

  await prisma.invoice.create({
    data: {
      userId, clientId: studio.id, projectId: projStudio.id, quoteId: quote3.id,
      number: "FAC-2026-006", type: "FINAL", status: "SENT",
      totalHT: 3200, depositDeducted: 0,
      dueDate: d("2026-05-25"), sentAt: d("2026-05-05"), createdAt: d("2026-05-05"),
      notes: "Solde identité visuelle Studio Créatif. Merci pour votre confiance.",
      lines: { create: [{ productId: prodDesign.id, description: "Identité visuelle complète — 4 jours", quantity: 4, unitPrice: 800, total: 3200 }] },
    },
  })
  console.log("✅ Factures (6)")

  // ── Récurrente ────────────────────────────────────────────────────────────

  await prisma.recurringInvoice.create({
    data: {
      userId, clientId: bionatura.id, projectId: projBio.id,
      name: "Maintenance mensuelle BioNatura",
      frequency: "MONTHLY",
      nextGenerationDate: d("2026-06-01"),
      isActive: true,
    },
  })
  console.log("✅ Facture récurrente (1)")

  // ── Événements calendrier ─────────────────────────────────────────────────

  await prisma.calendarEvent.createMany({
    data: [
      { userId, title: "Kick-off Dashboard Analytics", description: "Réunion de lancement avec Caroline — TechCorp", startDate: d("2026-03-17T10:00:00"), endDate: d("2026-03-17T11:30:00"), sourceType: "MANUAL" },
      { userId, title: "Livraison logo Studio Créatif", description: "Présentation logo v2 validé à Matthieu", startDate: d("2026-05-20T14:00:00"), endDate: d("2026-05-20T15:00:00"), sourceType: "MANUAL" },
      { userId, title: "Appel Nexus Ventures", description: "Suivi devis DEV-2026-004 — décision board", startDate: d("2026-05-22T11:00:00"), endDate: d("2026-05-22T11:45:00"), sourceType: "MANUAL" },
      { userId, title: "Envoi devis Cabinet Morand", description: "Devis site vitrine avocat à préparer et envoyer", startDate: d("2026-05-19T09:00:00"), allDay: true, sourceType: "MANUAL" },
    ],
  })
  console.log("✅ Événements calendrier (4)")

  // ── Résumé ────────────────────────────────────────────────────────────────

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed terminé avec succès !

  7 clients  (3 actifs, 3 prospects, 1 inactif)
  5 tags
  4 projets  (1 terminé + PostDev, 3 actifs)
  6 milestones · 23 tâches · 8 time entries
  4 devis    (3 acceptés, 1 en attente)
  6 factures (5 payées, 1 à encaisser)
  5 rappels  (dont 1 en retard)
  17 interactions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main()
  .catch((e) => { console.error("❌ Erreur seed:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
