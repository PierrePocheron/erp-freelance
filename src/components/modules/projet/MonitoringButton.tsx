"use client"

import { useState, useTransition } from "react"
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import { checkSiteStatus } from "@/actions/postdev"
import { Button } from "@/components/ui/button"

export function MonitoringButton({
  postDevId,
  projectId,
  url,
}: {
  postDevId: string
  projectId: string
  url: string
}) {
  const [result, setResult] = useState<{ isUp: boolean; statusCode: number | null; responseTimeMs: number | null } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCheck() {
    startTransition(async () => {
      const r = await checkSiteStatus(postDevId, projectId, url)
      setResult(r)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleCheck} disabled={isPending} size="sm" variant="outline">
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Vérification..." : "Vérifier maintenant"}
      </Button>
      {result && (
        <div className={`flex items-center gap-1.5 text-sm font-medium ${result.isUp ? "text-emerald-600" : "text-red-500"}`}>
          {result.isUp
            ? <CheckCircle2 className="h-4 w-4" />
            : <XCircle className="h-4 w-4" />}
          {result.isUp ? "En ligne" : "Hors ligne"}
          {result.statusCode && <span className="text-muted-foreground font-normal text-xs">({result.statusCode})</span>}
          {result.responseTimeMs && <span className="text-muted-foreground font-normal text-xs">{result.responseTimeMs}ms</span>}
        </div>
      )}
    </div>
  )
}
