"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Download, Loader2, FileJson, FileArchive, Upload,
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react"
import { exportAllData } from "@/actions/export"
import { importData, type ImportResult } from "@/actions/import-data"
import { toast } from "sonner"

interface Props {
  stats: {
    clients: number
    projects: number
    tasks: number
    quotes: number
    invoices: number
    interactions: number
    timeEntries: number
  }
}

export function ExportSection({ stats }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      setIsExporting(true)
      const json = await exportAllData()
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `erp-export-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Export téléchargé avec succès")
    } catch {
      toast.error("Erreur lors de l'export")
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportArchive() {
    try {
      setIsArchiving(true)
      const res = await fetch("/api/export/archive")
      if (!res.ok) throw new Error("archive failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `erp-archive-${date}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Archive complète téléchargée")
    } catch {
      toast.error("Erreur lors de la création de l'archive")
    } finally {
      setIsArchiving(false)
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".json")) {
      toast.error("Le fichier doit être au format .json")
      return
    }
    setSelectedFile(file)
    setImportResult(null)
  }

  async function handleImport() {
    if (!selectedFile) return
    try {
      setIsImporting(true)
      setImportResult(null)
      const text = await selectedFile.text()
      const result = await importData(text)
      setImportResult(result)
      if (result.success) {
        toast.success(`Import terminé — ${result.total} enregistrements importés`)
      } else {
        toast.error(result.error ?? "Erreur lors de l'import")
      }
    } catch {
      toast.error("Erreur inattendue lors de l'import")
    } finally {
      setIsImporting(false)
    }
  }

  function resetImport() {
    setSelectedFile(null)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const statItems = [
    { label: "Clients", value: stats.clients },
    { label: "Projets", value: stats.projects },
    { label: "Tâches", value: stats.tasks },
    { label: "Devis", value: stats.quotes },
    { label: "Factures", value: stats.invoices },
    { label: "Interactions", value: stats.interactions },
    { label: "Temps", value: stats.timeEntries },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Export & Import des données</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {"Sauvegarde ou restaure l'intégralité de tes données — utile pour changer d'hébergeur, migrer vers un nouveau compte, ou garder une copie de sécurité."}
        </p>
      </div>

      {/* ── Export ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Exporter mes données</h3>
        </div>

        {/* Stats actuelles */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {statItems.map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/40 p-2.5 text-center">
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            Les tokens OAuth, sessions et logs sont exclus — seules tes données métier sont exportées.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleExport} disabled={isExporting || isArchiving} className="gap-2">
            {isExporting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            {isExporting ? "Préparation..." : "Télécharger mes données (JSON)"}
          </Button>
          <Button
            onClick={handleExportArchive}
            disabled={isExporting || isArchiving}
            variant="outline"
            className="gap-2"
          >
            {isArchiving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileArchive className="h-4 w-4" />}
            {isArchiving ? "Création de l'archive..." : "Archive complète (ZIP)"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Le JSON sert à la restauration (import). L&apos;archive ZIP ajoute les documents :
          PDF des factures émises (figés), devis signés et fichiers clients téléversés.
        </p>
      </div>

      {/* ── Import ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Importer des données</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Sélectionne un fichier export généré par cette application. Les données existantes
          ne seront pas écrasées — seuls les enregistrements manquants seront ajoutés.
        </p>

        {/* Zone de sélection de fichier */}
        {!importResult && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
              id="import-file"
            />

            {!selectedFile ? (
              <label
                htmlFor="import-file"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer p-8"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Cliquer pour sélectionner un fichier</span>
                <span className="text-xs text-muted-foreground">erp-export-YYYY-MM-DD.json</span>
              </label>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <FileJson className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} Ko
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetImport}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  Changer
                </Button>
              </div>
            )}

            {selectedFile && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="gap-2"
                >
                  {isImporting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Upload className="h-4 w-4" />}
                  {isImporting ? "Import en cours..." : "Lancer l'import"}
                </Button>
                {isImporting && (
                  <p className="text-xs text-muted-foreground">
                    Cela peut prendre quelques secondes...
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Résultat de l'import */}
        {importResult && (
          <div className="space-y-3">
            {/* En-tête résultat */}
            <div className={`flex items-center gap-3 rounded-lg p-4 ${
              importResult.success
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}>
              {importResult.success
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
              <div>
                <p className={`font-medium text-sm ${
                  importResult.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}>
                  {importResult.success
                    ? `Import réussi — ${importResult.total} enregistrements importés`
                    : "Erreur lors de l'import"}
                </p>
                {importResult.error && (
                  <p className="text-xs text-red-600 mt-0.5">{importResult.error}</p>
                )}
              </div>
            </div>

            {/* Détail par catégorie */}
            {importResult.success && Object.keys(importResult.counts).length > 0 && (
              <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                {Object.entries(importResult.counts).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {importResult.success && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Recharge la page pour voir tes données mises à jour.</span>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={resetImport}>
              Importer un autre fichier
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
