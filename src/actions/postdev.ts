"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ── PostDev ───────────────────────────────────────────────────────────────────

export async function upsertPostDev(
  projectId: string,
  userId: string,
  data: {
    prodUrl?: string | null
    adminUrl?: string | null
    hostingUrl?: string | null
    registrarUrl?: string | null
  }
) {
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
  await prisma.renewal.delete({ where: { id: renewalId } })
  revalidatePath(`/projets/${projectId}/post-dev`)
}

// ── Monitoring ────────────────────────────────────────────────────────────────

export async function checkSiteStatus(postDevId: string, projectId: string, url: string) {
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
