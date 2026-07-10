"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileSpreadsheet, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { parseCsv, type ParsedCsv } from "@/lib/csv"
import { importProspects, type ImportProspectRow } from "@/actions/prospection"
import { toast } from "sonner"

// Champs cibles mappables depuis une colonne CSV.
const TARGET_FIELDS = [
  { value: "",                    label: "— Ignorer —" },
  { value: "name",                label: "Nom complet *" },
  { value: "firstName",           label: "Prénom" },
  { value: "lastName",            label: "Nom de famille" },
  { value: "email",               label: "Email" },
  { value: "phone",               label: "Téléphone" },
  { value: "companyName",         label: "Société" },
  { value: "websiteUrl",          label: "URL du site" },
  { value: "websitePagesApprox",  label: "Nb pages (approx.)" },
  { value: "businessDescription", label: "Description business" },
  { value: "city",                label: "Ville" },
  { value: "region",              label: "Région" },
  { value: "notes",               label: "Notes" },
] as const

// Devine le champ cible depuis l'entête CSV normalisée.
function guessField(header: string): string {
  const h = header.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")
  if (/^(nomcomplet|name|fullname|contact)$/.test(h)) return "name"
  if (/^(prenom|firstname)$/.test(h)) return "firstName"
  if (/^(nom|lastname|nomdefamille)$/.test(h)) return "lastName"
  if (/(email|mail|courriel)/.test(h)) return "email"
  if (/(phone|telephone|tel|portable|mobile)/.test(h)) return "phone"
  if (/(societe|company|entreprise|raisonsociale|business$)/.test(h)) return "companyName"
  if (/(site|url|website|lien|web)/.test(h)) return "websiteUrl"
  if (/(page)/.test(h)) return "websitePagesApprox"
  if (/(description|activite|secteur)/.test(h)) return "businessDescription"
  if (/^(ville|city)$/.test(h)) return "city"
  if (/(region|departement)/.test(h)) return "region"
  if (/(note|commentaire|remarque)/.test(h)) return "notes"
  if (h === "nom") return "name"
  return ""
}

export function ImportCsvDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [fileName, setFileName] = useState("")
  const [mapping, setMapping] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null)

  function reset() {
    setStep(1)
    setParsed(null)
    setFileName("")
    setMapping([])
    setResult(null)
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const p = parseCsv(String(reader.result ?? ""))
      if (p.headers.length === 0 || p.rows.length === 0) {
        toast.error("Fichier vide ou illisible")
        return
      }
      setParsed(p)
      setFileName(file.name)
      setMapping(p.headers.map(guessField))
      setStep(2)
    }
    reader.readAsText(file)
  }

  // Convertit les lignes CSV en lignes d'import selon le mapping courant.
  const importRows: ImportProspectRow[] = useMemo(() => {
    if (!parsed) return []
    return parsed.rows.map((row) => {
      const rec: Record<string, string> = {}
      mapping.forEach((field, i) => {
        if (field && row[i]?.trim()) rec[field] = row[i].trim()
      })
      // Nom : colonne "name" mappée, sinon prénom+nom, sinon société
      const name = rec.name || [rec.firstName, rec.lastName].filter(Boolean).join(" ") || rec.companyName || ""
      return {
        name,
        firstName: rec.firstName || null,
        lastName: rec.lastName || null,
        email: rec.email || null,
        phone: rec.phone || null,
        companyName: rec.companyName || null,
        websiteUrl: rec.websiteUrl || null,
        websitePagesApprox: rec.websitePagesApprox ? parseInt(rec.websitePagesApprox, 10) || null : null,
        businessDescription: rec.businessDescription || null,
        city: rec.city || null,
        region: rec.region || null,
        notes: rec.notes || null,
      }
    }).filter((r) => r.name)
  }, [parsed, mapping])

  function handleImport() {
    startTransition(async () => {
      const res = await importProspects(importRows)
      setResult(res)
      setStep(3)
      toast.success(`${res.imported} prospect${res.imported > 1 ? "s" : ""} importé${res.imported > 1 ? "s" : ""}`)
      router.refresh()
    })
  }

  const hasNameMapping = mapping.some((m) => ["name", "firstName", "lastName", "companyName"].includes(m))

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
        <Upload className="h-3.5 w-3.5" />
        Importer CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Importer des prospects (CSV)" : step === 2 ? "Associer les colonnes" : "Import terminé"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Étape 1 : fichier ── */}
        {step === 1 && (
          <div className="space-y-3">
            <label
              htmlFor="csv-file"
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer p-10"
            >
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Cliquer pour sélectionner un fichier CSV</span>
              <span className="text-xs text-muted-foreground">Export de scraping, Excel, Google Sheets… (séparateur , ou ; auto-détecté)</span>
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}

        {/* ── Étape 2 : mapping + préview ── */}
        {step === 2 && parsed && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> — {parsed.rows.length} ligne{parsed.rows.length > 1 ? "s" : ""}.
              Associez chaque colonne du fichier à un champ prospect (deviné automatiquement, à corriger si besoin).
            </p>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40">
              {parsed.headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{header || `Colonne ${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      ex : {parsed.rows[0]?.[i] || "—"}
                    </p>
                  </div>
                  <select
                    value={mapping[i] ?? ""}
                    onChange={(e) => setMapping((prev) => prev.map((m, j) => (j === i ? e.target.value : m)))}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                  >
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!hasNameMapping && (
              <p className="text-xs text-amber-600">
                Associez au moins une colonne à «&nbsp;Nom complet&nbsp;», «&nbsp;Prénom&nbsp;»/«&nbsp;Nom&nbsp;» ou «&nbsp;Société&nbsp;» pour pouvoir importer.
              </p>
            )}
            {hasNameMapping && (
              <p className="text-xs text-muted-foreground">
                {importRows.length} prospect{importRows.length > 1 ? "s" : ""} prêt{importRows.length > 1 ? "s" : ""} à importer.
                Les doublons (même email qu&apos;un contact existant) seront ignorés.
              </p>
            )}

            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Changer de fichier
              </Button>
              <Button size="sm" onClick={handleImport} disabled={isPending || !hasNameMapping || importRows.length === 0} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                {isPending ? "Import…" : `Importer ${importRows.length > 0 ? importRows.length : ""}`.trim()}
              </Button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : rapport ── */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {result.imported} prospect{result.imported > 1 ? "s" : ""} importé{result.imported > 1 ? "s" : ""}
                {result.skipped.length > 0 && ` · ${result.skipped.length} ignoré${result.skipped.length > 1 ? "s" : ""} (déjà présent${result.skipped.length > 1 ? "s" : ""})`}
              </p>
            </div>
            {result.skipped.length > 0 && (
              <div className="rounded-lg border border-border/50 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Doublons ignorés :</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {result.skipped.map((email) => <li key={email}>{email}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setOpen(false); reset() }}>Fermer</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
