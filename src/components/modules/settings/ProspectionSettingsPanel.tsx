"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveProspectionSettings } from "@/actions/settings"
import { toast } from "sonner"

type Tmpl = { id: string; name: string }

export function ProspectionSettingsPanel({
  initial,
  templates,
}: {
  initial: { followUpDelayDays: number; followUpTemplateId: string | null }
  templates: Tmpl[]
}) {
  const router = useRouter()
  const [days, setDays] = useState(String(initial.followUpDelayDays))
  const [templateId, setTemplateId] = useState(initial.followUpTemplateId ?? "")
  const [isPending, start] = useTransition()

  function save() {
    start(async () => {
      await saveProspectionSettings({
        followUpDelayDays: parseInt(days, 10) || 7,
        followUpTemplateId: templateId || null,
      })
      toast.success("Réglages de prospection enregistrés")
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold">Relances</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Rappels automatiques pour ne pas oublier de relancer vos prospects.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Délai avant de proposer une relance (jours)</label>
        <Input
          type="number" min={1} max={90}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-28"
        />
        <p className="text-[11px] text-muted-foreground/70">
          Un prospect contacté sans réponse apparaît dans « Relances à faire » passé ce délai.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Modèle de relance par défaut</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">— Aucun (je choisis à chaque fois) —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <p className="text-[11px] text-muted-foreground/70">
          Pré-rempli automatiquement quand vous relancez un prospect depuis la carte « Relances à faire ».
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
