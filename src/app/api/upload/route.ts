import { auth } from "@/lib/auth"
import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const folder = (formData.get("folder") as string) || "uploads"

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ext = file.name.split(".").pop()
  const filename = `${folder}/${session.user.id}/${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: "public" })
  return NextResponse.json({ url: blob.url })
}
