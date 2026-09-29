"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react"
import { addClientFile, deleteClientFile } from "@/actions/crm"
import { useArmedDelete } from "@/hooks/use-armed-delete"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ClientFileRow = { id: string; name: string; fileUrl: string; type: string; createdAt: string }

const TYPE_LABELS: Record<string, string> = { BRIEF: "Brief", CONTRACT: "Contrat", LOGO: "Logo", OTHER: "Autre" }

/** Onglet « Fichiers » d'un contact (#28) : dépôt (PDF, images) et liste des fichiers. */
export function ClientFilesPanel({ clientId, files }: { clientId: string; files: ClientFileRow[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState("OTHER")
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { isArmed, confirmFirst } = useArmedDelete()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // re-sélection du même fichier possible après un échec
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error("Fichier trop volumineux (5 Mo max)"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "uploads")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error(res.status === 400 ? "Format non accepté (PDF, JPG, PNG, WebP, GIF)" : `Dépôt échoué (HTTP ${res.status})`)
      const { url } = await res.json()
      await addClientFile(clientId, { name: file.name, fileUrl: url, type })
      toast.success("Fichier ajouté")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message.startsWith("Format") ? err.message : "Échec du dépôt du fichier")
    } finally {
      setUploading(false)
    }
  }

  function remove(id: string) {
    if (!confirmFirst(id)) return
    startTransition(async () => {
      try {
        await deleteClientFile(id)
        router.refresh()
      } catch {
        toast.error("Échec de la suppression")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Type du fichier"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={onFile} aria-label="Choisir un fichier" />
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Dépôt…" : "Déposer un fichier"}
        </Button>
        <span className="text-xs text-muted-foreground">PDF ou image, 5 Mo max</span>
      </div>

      {files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Aucun fichier — brief, contrat, logo…
        </div>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/50 bg-card">
          {files.map((f) => (
            <li key={f.id} className="group flex items-center gap-3 px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-medium hover:underline">
                  <span className="truncate" title={f.name}>{f.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABELS[f.type] ?? f.type} · {new Date(f.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={isPending}
                aria-label={isArmed(f.id) ? `Confirmer la suppression de ${f.name}` : `Supprimer ${f.name}`}
                title={isArmed(f.id) ? "Confirmer la suppression" : "Supprimer"}
                className={cn(
                  "p-2 -m-1.5 transition-opacity focus:opacity-100 group-hover:opacity-100 hover:text-destructive disabled:opacity-40",
                  isArmed(f.id) ? "text-destructive" : "pointer-fine:opacity-0 text-muted-foreground",
                )}
              >
                {isArmed(f.id) ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
