"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import type { RenewalType } from "@/generated/prisma/enums"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// ── PostDev ───────────────────────────────────────────────────────────────────

export async function upsertPostDev(
  projectId: string,
  _userId: string,
  data: {
    prodUrl?: string | null
    adminUrl?: string | null
    hostingUrl?: string | null
    registrarUrl?: string | null
  }
) {
  const userId = await requireAuth()
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } })
  if (!project) throw new Error("Projet introuvable")

  await prisma.postDev.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  })
  revalidatePath(`/projets/${projectId}/post-dev`)
}

// ── Renewals ──────────────────────────────────────────────────────────────────

export async function addRenewal(
  postDevId: string,
  projectId: string,
  data: { type: string; name: string; expiresAt: string; purchasedAt?: string | null; periodMonths?: number | null; amount?: number | null }
) {
  const userId = await requireAuth()
  const postDev = await prisma.postDev.findFirst({
    where: { id: postDevId, project: { userId } },
    select: { id: true },
  })
  if (!postDev) throw new Error("Non autorisé")
  await prisma.renewal.create({
    data: {
      postDevId,
      type: data.type as RenewalType,
      name: data.name,
      amount: data.amount ?? null,
      purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : null,
      periodMonths: data.periodMonths ?? null,
      expiresAt: new Date(data.expiresAt),
    },
  })
  revalidatePath(`/projets/${projectId}/post-dev`)
}

export async function deleteRenewal(renewalId: string, projectId: string) {
  const userId = await requireAuth()
  const renewal = await prisma.renewal.findFirst({
    where: { id: renewalId, postDev: { project: { userId } } },
    select: { id: true },
  })
  if (!renewal) throw new Error("Non autorisé")
  await prisma.renewal.delete({ where: { id: renewalId } })
  revalidatePath(`/projets/${projectId}/post-dev`)
}

// ── Monitoring ────────────────────────────────────────────────────────────────

type ProbeResult = { isUp: boolean; statusCode: number | null; responseTimeMs: number | null }

// SSRF protection — valide l'URL avant tout fetch. Lève sur URL/protocole/hôte interdit.
function assertSafeUrl(url: string): void {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error("URL invalide") }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Protocole non autorisé")
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) {
    throw new Error("URL non autorisée")
  }
}

// Sonde une URL en HEAD (timeout 10s). Ne lève jamais une fois l'URL validée :
// un échec réseau = site down.
async function probeUrl(url: string): Promise<ProbeResult> {
  assertSafeUrl(url)
  try {
    const start = Date.now()
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000), cache: "no-store" })
    return { isUp: res.ok, statusCode: res.status, responseTimeMs: Date.now() - start }
  } catch {
    return { isUp: false, statusCode: null, responseTimeMs: null }
  }
}

export async function checkSiteStatus(postDevId: string, projectId: string, url: string) {
  const userId = await requireAuth()
  const postDev = await prisma.postDev.findFirst({
    where: { id: postDevId, project: { userId } },
    select: { id: true },
  })
  if (!postDev) throw new Error("Non autorisé")

  const result = await probeUrl(url)
  await prisma.monitoringCheck.create({ data: { postDevId, ...result } })

  revalidatePath(`/projets/${projectId}/post-dev`)
  return result
}

// Vérifie toutes les prods renseignées (PostDev avec prodUrl) de l'utilisateur, en
// parallèle. Enregistre un MonitoringCheck par prod et renvoie l'agrégat.
export async function checkAllProds(): Promise<{ checked: number; up: number; down: number }> {
  const userId = await requireAuth()
  const prods = await prisma.postDev.findMany({
    where: { project: { userId }, prodUrl: { not: null } },
    select: { id: true, prodUrl: true },
  })

  let up = 0
  let down = 0
  await Promise.all(prods.map(async (pd) => {
    let result: ProbeResult
    try { result = await probeUrl(pd.prodUrl!) }
    catch { result = { isUp: false, statusCode: null, responseTimeMs: null } }
    await prisma.monitoringCheck.create({ data: { postDevId: pd.id, ...result } })
    if (result.isUp) up++; else down++
  }))

  revalidatePath("/")
  return { checked: prods.length, up, down }
}
