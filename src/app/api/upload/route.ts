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

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
  }

  // Validate folder (prevent path traversal)
  const folder = ALLOWED_FOLDERS.includes(folderRaw) ? folderRaw : "uploads"

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin"
  const filename = `${folder}/${session.user.id}/${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: "public" })
  return NextResponse.json({ url: blob.url })
}
