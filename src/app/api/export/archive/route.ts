import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { exportAllData } from "@/actions/export"
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf"
import JSZip from "jszip"

// Nettoie un libellé pour servir de nom de fichier / dossier dans le ZIP.
function safe(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "sans-nom"
}

function extFromUrl(url: string, fallback: string): string {
  const path = url.split("?")[0]
  const ext = path.split(".").pop()
  return ext && ext.length <= 5 ? ext : fallback
}

async function fetchToBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  const userId = session.user.id

  const zip = new JSZip()

  // 1. Données métier (même JSON que l'export standard, compatible import).
  const json = await exportAllData()
  zip.file("data.json", json)

  const docs = zip.folder("documents")!

  // 2. Factures — PDF figé (Blob) si émise, sinon rendu à la volée.
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    select: { id: true, number: true, pdfUrl: true, status: true },
  })
  const facturesDir = docs.folder("factures")!
  for (const inv of invoices) {
    let buffer: Buffer | null = null
    if (inv.pdfUrl) buffer = await fetchToBuffer(inv.pdfUrl)
    if (!buffer) {
      try {
        buffer = await buildInvoicePdfBuffer(inv.id, userId)
      } catch {
        buffer = null
      }
    }
    if (buffer) facturesDir.file(`${safe(inv.number)}.pdf`, buffer)
  }

  // 3. Devis signés téléversés.
  const quotes = await prisma.quote.findMany({
    where: { userId, signedFileUrl: { not: null } },
    select: { number: true, signedFileUrl: true },
  })
  if (quotes.length) {
    const devisDir = docs.folder("devis-signes")!
    for (const q of quotes) {
      const buffer = await fetchToBuffer(q.signedFileUrl!)
      if (buffer) devisDir.file(`${safe(q.number)}.${extFromUrl(q.signedFileUrl!, "pdf")}`, buffer)
    }
  }

  // 4. Fichiers clients téléversés, regroupés par client.
  const clientFiles = await prisma.clientFile.findMany({
    where: { client: { userId } },
    select: { name: true, fileUrl: true, client: { select: { name: true } } },
  })
  if (clientFiles.length) {
    const filesDir = docs.folder("fichiers-clients")!
    for (const f of clientFiles) {
      const buffer = await fetchToBuffer(f.fileUrl)
      if (buffer) {
        const clientDir = filesDir.folder(safe(f.client.name))!
        clientDir.file(safe(f.name) || `fichier.${extFromUrl(f.fileUrl, "bin")}`, buffer)
      }
    }
  }

  const content = await zip.generateAsync({ type: "nodebuffer" })
  const date = new Date().toISOString().slice(0, 10)

  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="erp-archive-${date}.zip"`,
    },
  })
}
