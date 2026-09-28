import { describe, it, expect, vi, beforeEach } from "vitest"
import { checkProjectLinksHealth, checkSiteStatus, upsertPostDev, addRenewal, deleteRenewal } from "@/actions/postdev"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject } from "./helpers/factories"

// Post-Dev : le monitoring sonde des URL fournies par l'utilisateur. Le garde
// anti-SSRF (`assertSafeUrl`) n'était couvert par aucun test alors que c'est lui
// qui empêche l'app de servir de relais vers le réseau interne — la métadonnée
// cloud 169.254.169.254 en tête.

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal("fetch", fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200 })
})

async function projectWithLink(userId: string, url: string) {
  const client = await makeClient(userId)
  const project = await makeProject(userId, client.id)
  const link = await prisma.usefulLink.create({ data: { projectId: project.id, label: "Lien", url, category: "OTHER" } })
  return { project, link }
}

describe("sonde des liens (garde SSRF)", () => {
  it("sonde une URL publique et renvoie son statut", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { project, link } = await projectWithLink(user.id, "https://exemple-public.test/page")

    const out = await checkProjectLinksHealth(project.id)

    expect(out).toEqual([{ linkId: link.id, isUp: true, statusCode: 200 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["localhost", "http://localhost:3000/admin"],
    ["loopback", "http://127.0.0.1/"],
    ["réseau privé", "http://192.168.1.1/"],
    ["métadonnées cloud", "http://169.254.169.254/latest/meta-data/"],
    ["IPv6 loopback", "http://[::1]/"],
  ])("ne sonde jamais une URL %s", async (_label, url) => {
    const user = await makeUser()
    setTestUser(user.id)
    const { project, link } = await projectWithLink(user.id, url)

    const out = await checkProjectLinksHealth(project.id)

    expect(out).toEqual([{ linkId: link.id, isUp: null, statusCode: null }])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("un domaine qui commence par « fc » n'est pas confondu avec une IPv6 privée", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { project } = await projectWithLink(user.id, "https://fc-barcelona.com")

    const out = await checkProjectLinksHealth(project.id)
    expect(out[0].isUp).toBe(true)
  })

  // Les liens de projet passent par `normalizeUrl`, qui préfixe en https tout ce
  // qui ne commence pas par http(s) : « file:///etc/passwd » devient donc
  // « https://file:///etc/passwd », une URL http vers un hôte « file » qui ne
  // résout pas — inoffensive. Le suivi de prod, lui, ne normalise pas : c'est là
  // que le protocole doit être refusé.
  it("checkSiteStatus refuse un protocole non http et une cible interne", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    await upsertPostDev(project.id, "ignored", { prodUrl: "https://mon-site.test" })
    const postDev = await prisma.postDev.findFirstOrThrow({ where: { projectId: project.id } })

    await expect(checkSiteStatus(postDev.id, project.id, "file:///etc/passwd")).rejects.toThrow(/protocole/i)
    await expect(checkSiteStatus(postDev.id, project.id, "http://169.254.169.254/")).rejects.toThrow(/non autorisée/i)
    await expect(checkSiteStatus(postDev.id, project.id, "pas une url")).rejects.toThrow(/invalide/i)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await prisma.monitoringCheck.count({ where: { postDevId: postDev.id } })).toBe(0)
  })

  it("checkSiteStatus refuse le suivi d'un projet d'un autre compte", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    const victimProject = await makeProject(victim.id, victimClient.id)
    const postDev = await prisma.postDev.create({ data: { projectId: victimProject.id, prodUrl: "https://site.test" } })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    await expect(checkSiteStatus(postDev.id, victimProject.id, "https://site.test")).rejects.toThrow(/non autorisé/i)
    expect(await prisma.monitoringCheck.count({ where: { postDevId: postDev.id } })).toBe(0)
  })

  it("enregistre un relevé de monitoring pour son propre projet", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    await upsertPostDev(project.id, "ignored", { prodUrl: "https://mon-site.test" })
    const postDev = await prisma.postDev.findFirstOrThrow({ where: { projectId: project.id } })

    fetchMock.mockResolvedValue({ ok: false, status: 503 })
    const result = await checkSiteStatus(postDev.id, project.id, "https://mon-site.test")

    expect(result.isUp).toBe(false)
    expect(result.statusCode).toBe(503)
    expect(await prisma.monitoringCheck.count({ where: { postDevId: postDev.id } })).toBe(1)
  })

  it("renouvellements : ajout puis suppression, scopés au projet", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    await upsertPostDev(project.id, "ignored", { prodUrl: "https://mon-site.test" })
    const postDev = await prisma.postDev.findFirstOrThrow({ where: { projectId: project.id } })

    await addRenewal(postDev.id, project.id, { name: "Nom de domaine", type: "DOMAIN", expiresAt: "2027-01-31" })
    const renewal = await prisma.renewal.findFirstOrThrow({ where: { postDevId: postDev.id } })
    expect(renewal.name).toBe("Nom de domaine")

    await deleteRenewal(renewal.id, project.id)
    expect(await prisma.renewal.count({ where: { id: renewal.id } })).toBe(0)
  })
})
