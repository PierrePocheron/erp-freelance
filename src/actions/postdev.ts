"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

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
  data: { type: string; name: string; expiresAt: string }
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
      type: data.type as any,
      name: data.name,
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

export async function checkSiteStatus(postDevId: string, projectId: string, url: string) {
  const userId = await requireAuth()
  const postDev = await prisma.postDev.findFirst({
    where: { id: postDevId, project: { userId } },
    select: { id: true },
  })
  if (!postDev) throw new Error("Non autorisé")

  // SSRF protection — validate URL before fetching
  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { throw new Error("URL invalide") }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Protocole non autorisé")
  const hostname = parsedUrl.hostname
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
    throw new Error("URL non autorisée")
  }

  let isUp = false
  let statusCode: number | null = null
  let responseTimeMs: number | null = null

  try {
    const start = Date.now()
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    })
    responseTimeMs = Date.now() - start
    statusCode = res.status
    isUp = res.ok
  } catch {
    isUp = false
  }

  await prisma.monitoringCheck.create({
    data: { postDevId, isUp, statusCode, responseTimeMs },
  })

  revalidatePath(`/projets/${projectId}/post-dev`)
  return { isUp, statusCode, responseTimeMs }
}
