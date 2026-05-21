#!/usr/bin/env tsx
/**
 * ─────────────────────────────────────────────────────────────────
 *  ERP Freelance — Script d'import des données
 * ─────────────────────────────────────────────────────────────────
 *  Usage:
 *    npm run import ./erp-export-2026-05-21.json
 *    npx tsx scripts/import.ts ./erp-export-2026-05-21.json
 *
 *  Ce script :
 *  - Charge le fichier JSON exporté depuis l'application
 *  - Remplace l'userId par celui de l'utilisateur courant en DB
 *  - Insère les données dans le bon ordre (respect des FK)
 *  - Est idempotent : les enregistrements existants sont ignorés (skipDuplicates)
 *
 *  Prérequis :
 *  - DATABASE_URL configuré dans .env.local ou .env
 *  - npx prisma migrate deploy appliqué au préalable
 *  - Au moins un utilisateur connecté via l'app (sinon : créer un compte d'abord)
 * ─────────────────────────────────────────────────────────────────
 */

import { config } from "dotenv"
import { resolve } from "path"
import { readFileSync, existsSync } from "fs"

// Charger les variables d'environnement
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "../src/generated/prisma"

const prisma = new PrismaClient({ log: [] })

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDate(val: string | null | undefined): Date | null {
  if (!val) return null
  return new Date(val)
}

function log(label: string, n: number) {
  if (n === 0) return
  console.log(`  ✅ ${label.padEnd(30)} ${n} enregistrement${n > 1 ? "s" : ""}`)
}

function warn(msg: string) {
  console.log(`  ⚠️  ${msg}`)
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.error("❌ Usage: npx tsx scripts/import.ts ./erp-export-YYYY-MM-DD.json")
    process.exit(1)
  }

  const resolvedPath = resolve(filePath)
  if (!existsSync(resolvedPath)) {
    console.error(`❌ Fichier introuvable: ${resolvedPath}`)
    process.exit(1)
  }

  const raw = readFileSync(resolvedPath, "utf-8")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backup: any = JSON.parse(raw)

  console.log()
  console.log("━".repeat(55))
  console.log("  📦  ERP Freelance — Import des données")
  console.log("━".repeat(55))
  console.log(`  📅  Export du   : ${backup.exportedAt}`)
  console.log(`  🏷️   Version    : ${backup.version}`)
  if (backup.stats) {
    console.log(`  📊  Contenu    : ${backup.stats.clients} clients · ${backup.stats.projects} projets · ${backup.stats.invoices} factures`)
  }
  console.log()

  // Trouver l'utilisateur courant (le plus ancien = le propriétaire)
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) {
    console.error("❌ Aucun utilisateur trouvé en base.")
    console.error("   → Connectez-vous d'abord via l'application pour créer votre compte.")
    process.exit(1)
  }

  const userId = user.id
  console.log(`  👤  Utilisateur : ${user.email}`)
  console.log(`  🆔  userId      : ${userId}`)
  console.log()
  console.log("📥 Début de l'import...")
  console.log()

  const { data } = backup
  let totalCount = 0

  function track(label: string, n: number) {
    totalCount += n
    log(label, n)
  }

  // ── 1. UserProfile ──────────────────────────────────────────────────────────
  if (data.userProfile) {
    const p = data.userProfile
    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        id: p.id, userId,
        companyName: p.companyName ?? null,
        siret: p.siret ?? null,
        address: p.address ?? null,
        postalCode: p.postalCode ?? null,
        city: p.city ?? null,
        country: p.country ?? "France",
        phone: p.phone ?? null,
        website: p.website ?? null,
        iban: p.iban ?? null,
        bic: p.bic ?? null,
        quotePrefix: p.quotePrefix ?? "DEV",
        invoicePrefix: p.invoicePrefix ?? "FAC",
        quoteNumberFormat: p.quoteNumberFormat ?? "PREFIX-YYYY-NNN",
        invoiceNumberFormat: p.invoiceNumberFormat ?? "PREFIX-YYYY-NNN",
        defaultConditions: p.defaultConditions ?? null,
        pdfAccentColor: p.pdfAccentColor ?? "#6366f1",
        customAccentColors: p.customAccentColors ?? null,
        logoUrl: p.logoUrl ?? null,
      },
      update: {
        companyName: p.companyName ?? null,
        siret: p.siret ?? null,
        address: p.address ?? null,
        postalCode: p.postalCode ?? null,
        city: p.city ?? null,
        country: p.country ?? "France",
        phone: p.phone ?? null,
        website: p.website ?? null,
        iban: p.iban ?? null,
        bic: p.bic ?? null,
        quotePrefix: p.quotePrefix ?? "DEV",
        invoicePrefix: p.invoicePrefix ?? "FAC",
        quoteNumberFormat: p.quoteNumberFormat ?? "PREFIX-YYYY-NNN",
        invoiceNumberFormat: p.invoiceNumberFormat ?? "PREFIX-YYYY-NNN",
        defaultConditions: p.defaultConditions ?? null,
        pdfAccentColor: p.pdfAccentColor ?? "#6366f1",
        customAccentColors: p.customAccentColors ?? null,
        logoUrl: p.logoUrl ?? null,
      },
    })
    track("UserProfile", 1)
  }

  // ── 2. Tags utilisateur ─────────────────────────────────────────────────────
  if (data.tags?.length) {
    await prisma.tag.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.tags.map((t: any) => ({
        id: t.id,
        userId,
        name: t.name,
        color: t.color ?? "#6366f1",
        createdAt: toDate(t.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Tags", data.tags.length)
  }

  // ── 3. Conditions générales ─────────────────────────────────────────────────
  if (data.conditionsTemplates?.length) {
    await prisma.conditionsTemplate.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.conditionsTemplates.map((c: any) => ({
        id: c.id, userId, name: c.name, content: c.content,
        isDefault: c.isDefault ?? false,
        createdAt: toDate(c.createdAt) ?? new Date(),
        updatedAt: toDate(c.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Conditions générales", data.conditionsTemplates.length)
  }

  // ── 4. Clients ──────────────────────────────────────────────────────────────
  if (data.clients?.length) {
    await prisma.client.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.clients.map((c: any) => ({
        id: c.id, userId,
        type: c.type,
        name: c.name,
        company: c.company ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        source: c.source,
        temperature: c.temperature,
        priorityScore: c.priorityScore ?? 1,
        notes: c.notes ?? null,
        createdAt: toDate(c.createdAt) ?? new Date(),
        updatedAt: toDate(c.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Clients", data.clients.length)
  }

  // ── 5. Interactions ─────────────────────────────────────────────────────────
  if (data.interactions?.length) {
    await prisma.interaction.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.interactions.map((i: any) => ({
        id: i.id,
        clientId: i.clientId,
        date: new Date(i.date),
        channel: i.channel,
        summary: i.summary,
        response: i.response ?? null,
        createdAt: toDate(i.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Interactions", data.interactions.length)
  }

  // ── 6. Rappels ──────────────────────────────────────────────────────────────
  if (data.reminders?.length) {
    await prisma.reminder.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.reminders.map((r: any) => ({
        id: r.id,
        clientId: r.clientId,
        dueDate: new Date(r.dueDate),
        note: r.note ?? null,
        isDone: r.isDone ?? false,
        doneAt: toDate(r.doneAt),
        emailSent: r.emailSent ?? false,
        createdAt: toDate(r.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Rappels", data.reminders.length)
  }

  // ── 7. Fichiers clients ─────────────────────────────────────────────────────
  if (data.clientFiles?.length) {
    await prisma.clientFile.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.clientFiles.map((f: any) => ({
        id: f.id, clientId: f.clientId, name: f.name,
        fileUrl: f.fileUrl, type: f.type,
        createdAt: toDate(f.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Fichiers clients", data.clientFiles.length)
  }

  // ── 8. Produits ─────────────────────────────────────────────────────────────
  if (data.products?.length) {
    await prisma.product.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.products.map((p: any) => ({
        id: p.id, userId,
        name: p.name,
        description: p.description ?? null,
        unitPrice: p.unitPrice,
        unit: p.unit,
        billingType: p.billingType,
        defaultTaxRate: p.defaultTaxRate ?? 0,
        isActive: p.isActive ?? true,
        createdAt: toDate(p.createdAt) ?? new Date(),
        updatedAt: toDate(p.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Produits", data.products.length)
  }

  // ── 9. Projets (sans les tags M2M) ─────────────────────────────────────────
  if (data.projects?.length) {
    await prisma.project.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.projects.map((p: any) => ({
        id: p.id, userId, clientId: p.clientId,
        name: p.name,
        description: p.description ?? null,
        status: p.status,
        startDate: toDate(p.startDate),
        endDate: toDate(p.endDate),
        estimatedHours: p.estimatedHours ?? null,
        createdAt: toDate(p.createdAt) ?? new Date(),
        updatedAt: toDate(p.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Projets", data.projects.length)
  }

  // ── 10. Tags → Projets (M2M) ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectsWithTags = (data.projects ?? []).filter((p: any) => p.tagIds?.length > 0)
  for (const project of projectsWithTags) {
    try {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          tags: { connect: project.tagIds.map((id: string) => ({ id })) },
        },
      })
    } catch {
      warn(`Tags M2M ignorés pour le projet ${project.id} (tags manquants ?)`)
    }
  }
  if (projectsWithTags.length > 0) track("Tags → Projets (M2M)", projectsWithTags.length)

  // ── 11. Jalons ──────────────────────────────────────────────────────────────
  if (data.milestones?.length) {
    await prisma.milestone.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.milestones.map((m: any) => ({
        id: m.id, projectId: m.projectId, name: m.name,
        date: new Date(m.date), status: m.status,
        createdAt: toDate(m.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Jalons", data.milestones.length)
  }

  // ── 12. Tags de tâches (TaskTag) ────────────────────────────────────────────
  if (data.taskTags?.length) {
    await prisma.taskTag.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.taskTags.map((tt: any) => ({
        id: tt.id, projectId: tt.projectId, name: tt.name,
        color: tt.color ?? "#6366f1",
        createdAt: toDate(tt.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Tags de tâches", data.taskTags.length)
  }

  // ── 13. Tâches — 1ère passe (sans parentTaskId pour éviter les FK circulaires) ──
  if (data.tasks?.length) {
    await prisma.task.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.tasks.map((t: any) => ({
        id: t.id,
        userId: t.userId ? userId : null,
        projectId: t.projectId ?? null,
        clientId: t.clientId ?? null,
        milestoneId: t.milestoneId ?? null,
        parentTaskId: null, // On lie les sous-tâches en 2ème passe
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        importance: t.importance ?? 1,
        isGroup: t.isGroup ?? false,
        color: t.color ?? null,
        order: t.order ?? 0,
        estimatedHours: t.estimatedHours ?? null,
        startedAt: toDate(t.startedAt),
        dueDate: toDate(t.dueDate),
        completedAt: toDate(t.completedAt),
        createdAt: toDate(t.createdAt) ?? new Date(),
        updatedAt: toDate(t.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Tâches", data.tasks.length)
  }

  // ── 14. Tâches — 2ème passe : restaurer parentTaskId (sous-tâches) ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasksWithParent = (data.tasks ?? []).filter((t: any) => t.parentTaskId)
  for (const task of tasksWithParent) {
    await prisma.task.update({
      where: { id: task.id },
      data: { parentTaskId: task.parentTaskId },
    })
  }
  if (tasksWithParent.length > 0) track("Sous-tâches liées", tasksWithParent.length)

  // ── 15. TaskTags → Tâches (M2M) ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasksWithTags = (data.tasks ?? []).filter((t: any) => t.taskTagIds?.length > 0)
  for (const task of tasksWithTags) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          taskTags: { connect: task.taskTagIds.map((id: string) => ({ id })) },
        },
      })
    } catch {
      warn(`Tags M2M ignorés pour la tâche ${task.id}`)
    }
  }
  if (tasksWithTags.length > 0) track("Tags → Tâches (M2M)", tasksWithTags.length)

  // ── 16. Entrées de temps ────────────────────────────────────────────────────
  if (data.timeEntries?.length) {
    await prisma.timeEntry.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.timeEntries.map((e: any) => ({
        id: e.id, taskId: e.taskId, userId,
        startedAt: new Date(e.startedAt),
        endedAt: toDate(e.endedAt),
        duration: e.duration ?? null,
        note: e.note ?? null,
        createdAt: toDate(e.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Entrées de temps", data.timeEntries.length)
  }

  // ── 17. Journal de bord ─────────────────────────────────────────────────────
  if (data.journalEntries?.length) {
    await prisma.journalEntry.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.journalEntries.map((j: any) => ({
        id: j.id, projectId: j.projectId, content: j.content,
        createdAt: toDate(j.createdAt) ?? new Date(),
        updatedAt: toDate(j.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Journal de bord", data.journalEntries.length)
  }

  // ── 18. Livrables ───────────────────────────────────────────────────────────
  if (data.deliverables?.length) {
    await prisma.deliverable.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.deliverables.map((d: any) => ({
        id: d.id, projectId: d.projectId, name: d.name,
        status: d.status,
        dueDate: toDate(d.dueDate),
        createdAt: toDate(d.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Livrables", data.deliverables.length)
  }

  // ── 19. Liens utiles ────────────────────────────────────────────────────────
  if (data.usefulLinks?.length) {
    await prisma.usefulLink.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.usefulLinks.map((l: any) => ({
        id: l.id, projectId: l.projectId, label: l.label,
        url: l.url, category: l.category,
        createdAt: toDate(l.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Liens utiles", data.usefulLinks.length)
  }

  // ── 20. Post-Dev ────────────────────────────────────────────────────────────
  if (data.postDevs?.length) {
    await prisma.postDev.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.postDevs.map((p: any) => ({
        id: p.id, projectId: p.projectId,
        prodUrl: p.prodUrl ?? null,
        adminUrl: p.adminUrl ?? null,
        hostingUrl: p.hostingUrl ?? null,
        registrarUrl: p.registrarUrl ?? null,
        createdAt: toDate(p.createdAt) ?? new Date(),
        updatedAt: toDate(p.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Post-Dev", data.postDevs.length)
  }

  // ── 21. Renouvellements ─────────────────────────────────────────────────────
  if (data.renewals?.length) {
    await prisma.renewal.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.renewals.map((r: any) => ({
        id: r.id, postDevId: r.postDevId,
        type: r.type, name: r.name,
        expiresAt: new Date(r.expiresAt),
        reminderSent30: r.reminderSent30 ?? false,
        reminderSent7: r.reminderSent7 ?? false,
        createdAt: toDate(r.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Renouvellements", data.renewals.length)
  }

  // ── 22. Devis ───────────────────────────────────────────────────────────────
  if (data.quotes?.length) {
    await prisma.quote.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.quotes.map((q: any) => ({
        id: q.id, userId, clientId: q.clientId,
        projectId: q.projectId ?? null,
        number: q.number, status: q.status,
        depositPercent: q.depositPercent ?? 0,
        totalHT: q.totalHT ?? 0,
        notes: q.notes ?? null,
        generalConditions: q.generalConditions ?? null,
        expiresAt: toDate(q.expiresAt),
        validatedAt: toDate(q.validatedAt),
        sentAt: toDate(q.sentAt),
        acceptedAt: toDate(q.acceptedAt),
        signedFileUrl: q.signedFileUrl ?? null,
        createdAt: toDate(q.createdAt) ?? new Date(),
        updatedAt: toDate(q.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Devis", data.quotes.length)
  }

  // ── 23. Lignes de devis ─────────────────────────────────────────────────────
  if (data.quoteLines?.length) {
    await prisma.quoteLine.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.quoteLines.map((l: any) => ({
        id: l.id, quoteId: l.quoteId,
        productId: l.productId ?? null,
        description: l.description,
        detail: l.detail ?? null,
        quantity: l.quantity ?? 1,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate ?? 0,
        billingType: l.billingType,
        total: l.total,
      })),
      skipDuplicates: true,
    })
    track("Lignes de devis", data.quoteLines.length)
  }

  // ── 24. Factures ────────────────────────────────────────────────────────────
  if (data.invoices?.length) {
    await prisma.invoice.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.invoices.map((i: any) => ({
        id: i.id, userId, clientId: i.clientId,
        projectId: i.projectId ?? null,
        quoteId: i.quoteId ?? null,
        number: i.number, type: i.type, status: i.status,
        totalHT: i.totalHT ?? 0,
        depositDeducted: i.depositDeducted ?? 0,
        dueDate: toDate(i.dueDate),
        paidAt: toDate(i.paidAt),
        sentAt: toDate(i.sentAt),
        notes: i.notes ?? null,
        createdAt: toDate(i.createdAt) ?? new Date(),
        updatedAt: toDate(i.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Factures", data.invoices.length)
  }

  // ── 25. Lignes de factures ──────────────────────────────────────────────────
  if (data.invoiceLines?.length) {
    await prisma.invoiceLine.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.invoiceLines.map((l: any) => ({
        id: l.id, invoiceId: l.invoiceId,
        productId: l.productId ?? null,
        description: l.description,
        detail: l.detail ?? null,
        quantity: l.quantity ?? 1,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate ?? 0,
        total: l.total,
      })),
      skipDuplicates: true,
    })
    track("Lignes de factures", data.invoiceLines.length)
  }

  // ── 26. Paiements ───────────────────────────────────────────────────────────
  if (data.payments?.length) {
    await prisma.payment.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.payments.map((p: any) => ({
        id: p.id, invoiceId: p.invoiceId,
        amount: p.amount,
        paidAt: toDate(p.paidAt) ?? new Date(),
        note: p.note ?? null,
        createdAt: toDate(p.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Paiements", data.payments.length)
  }

  // ── 27. Factures récurrentes ────────────────────────────────────────────────
  if (data.recurringInvoices?.length) {
    await prisma.recurringInvoice.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.recurringInvoices.map((r: any) => ({
        id: r.id, userId, clientId: r.clientId,
        projectId: r.projectId ?? null,
        name: r.name, frequency: r.frequency,
        nextGenerationDate: new Date(r.nextGenerationDate),
        isActive: r.isActive ?? true,
        createdAt: toDate(r.createdAt) ?? new Date(),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Factures récurrentes", data.recurringInvoices.length)
  }

  // ── 28. Événements calendrier ───────────────────────────────────────────────
  if (data.calendarEvents?.length) {
    await prisma.calendarEvent.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.calendarEvents.map((e: any) => ({
        id: e.id, userId,
        title: e.title,
        description: e.description ?? null,
        startDate: new Date(e.startDate),
        endDate: toDate(e.endDate),
        allDay: e.allDay ?? false,
        sourceType: e.sourceType,
        sourceId: e.sourceId ?? null,
        createdAt: toDate(e.createdAt) ?? new Date(),
        updatedAt: toDate(e.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Événements calendrier", data.calendarEvents.length)
  }

  // ── 29. Idées projets ───────────────────────────────────────────────────────
  if (data.projectIdeas?.length) {
    await prisma.projectIdea.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.projectIdeas.map((i: any) => ({
        id: i.id, userId,
        title: i.title,
        content: i.content ?? "",
        createdAt: toDate(i.createdAt) ?? new Date(),
        updatedAt: toDate(i.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
    track("Idées projets", data.projectIdeas.length)
  }

  // ── Résumé ──────────────────────────────────────────────────────────────────
  console.log()
  console.log("━".repeat(55))
  console.log(`  ✨  Import terminé — ${totalCount} enregistrements traités`)
  console.log("━".repeat(55))
  console.log()
  console.log("  💡  Prochaine étape : redémarre l'application et vérifie tes données.")
  console.log()
}

main()
  .catch((e) => {
    console.error()
    console.error("❌ Erreur d'import:", e.message)
    console.error()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
