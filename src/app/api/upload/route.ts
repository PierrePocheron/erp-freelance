import { auth } from "@/lib/auth"
import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"

// SVG volontairement exclu : un SVG peut embarquer du JavaScript (XSS si ouvert
// directement). On se limite aux formats raster + PDF.
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
]
const ALLOWED_FOLDERS = ["logos", "signatures", "uploads"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// Extension canonique dérivée du type réel détecté (jamais du nom fourni par le client).
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
}

// Détection par signature (magic bytes) : `file.type` est déclaré par le client
// et donc falsifiable. On confirme le type réel à partir du contenu.
function sniffMimeType(bytes: Uint8Array): string | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b)
  const ascii = (s: string, offset = 0) => [...s].every((c, i) => bytes[offset + i] === c.charCodeAt(0))

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (ascii("GIF87a") || ascii("GIF89a")) return "image/gif"
  if (ascii("RIFF") && ascii("WEBP", 8)) return "image/webp"
  if (ascii("%PDF-")) return "application/pdf"
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Rate limit : 20 uploads/min par utilisateur
  if (!(await checkRateLimit(`upload:${session.user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const folderRaw = (formData.get("folder") as string) || "uploads"

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 })
  }

  // Validate MIME type (garde-fou rapide sur le type déclaré)
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
  }

  // Validation faisant autorité : on lit les premiers octets et on confirme que la
  // signature réelle correspond à un type autorisé (le type déclaré est falsifiable).
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const detectedType = sniffMimeType(header)
  if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
  }

  // Validate folder (prevent path traversal)
  const folder = ALLOWED_FOLDERS.includes(folderRaw) ? folderRaw : "uploads"

  // Extension dérivée du type réel détecté, pas du nom de fichier fourni.
  const ext = EXT_BY_TYPE[detectedType]
  const filename = `${folder}/${session.user.id}/${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: "public" })
  return NextResponse.json({ url: blob.url })
}
