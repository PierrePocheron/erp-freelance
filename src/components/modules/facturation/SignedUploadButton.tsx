"use client"

import { useRef, useState, useTransition } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignedUploadButton({ action }: { action: (fileUrl: string) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "signed-quotes")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!json.url) throw new Error("Upload failed")

      startTransition(async () => {
        await action(json.url)
      })
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const busy = uploading || isPending

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleChange}
        disabled={busy}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="border-teal-500/50 text-teal-600 hover:bg-teal-500/10"
      >
        {busy ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{uploading ? "Envoi…" : "Enregistrement…"}</>
        ) : (
          <><Upload className="h-3.5 w-3.5 mr-1.5" />Uploader le devis signé</>
        )}
      </Button>
      <span className="text-xs text-muted-foreground">PDF, PNG ou JPG</span>
    </div>
  )
}
