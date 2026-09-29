import { prisma } from "@/lib/prisma"

/**
 * Anti-IDOR : vérifie que chaque id RÉFÉRENCÉ par une création/mise à jour appartient
 * bien à l'utilisateur. Vérifier la cible (le projet, la facture…) ne suffit pas : sans
 * ce contrôle, on pouvait rattacher SON objet au contact, à la société ou à la catégorie
 * d'un autre compte — et voir ensuite ses données (nom, société…) dans ses propres écrans.
 *
 * Les valeurs vides (undefined / null / "") sont ignorées. Lève si une référence est étrangère.
 */
export async function assertOwnedRefs(
  userId: string,
  refs: {
    clientId?: string | null
    companyId?: string | null
    projectId?: string | null
    quoteId?: string | null
    invoiceId?: string | null
    expenseCategoryId?: string | null
    calendarCategoryId?: string | null
  },
) {
  const checks: [string | null | undefined, () => Promise<unknown>, string][] = [
    [refs.clientId, () => prisma.client.findFirst({ where: { id: refs.clientId!, userId }, select: { id: true } }), "Contact introuvable"],
    [refs.companyId, () => prisma.company.findFirst({ where: { id: refs.companyId!, userId }, select: { id: true } }), "Société introuvable"],
    [refs.projectId, () => prisma.project.findFirst({ where: { id: refs.projectId!, userId }, select: { id: true } }), "Projet introuvable"],
    [refs.quoteId, () => prisma.quote.findFirst({ where: { id: refs.quoteId!, userId }, select: { id: true } }), "Devis introuvable"],
    [refs.invoiceId, () => prisma.invoice.findFirst({ where: { id: refs.invoiceId!, userId }, select: { id: true } }), "Facture introuvable"],
    [refs.expenseCategoryId, () => prisma.expenseCategory.findFirst({ where: { id: refs.expenseCategoryId!, userId }, select: { id: true } }), "Catégorie introuvable"],
    [refs.calendarCategoryId, () => prisma.calendarCategory.findFirst({ where: { id: refs.calendarCategoryId!, userId }, select: { id: true } }), "Catégorie introuvable"],
  ]
  for (const [id, find, message] of checks) {
    if (id && !(await find())) throw new Error(message)
  }
}
