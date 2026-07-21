"use client"

import { useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { TrendingUp, Send, MessageSquare, Reply, MessagesSquare, CheckCircle2, XCircle, AtSign, Phone } from "lucide-react"
import { ALL_STATUSES } from "./status-config"
import type { ProspectStatus } from "@/generated/prisma/enums"

type Counts = {
  active: number
  toContact: number
  contacted: number
  replied: number
  inDiscussion: number
  won: number
  lost: number
  withEmail: number
  withPhone: number
}

/**
 * Cartes stats de la prospection. Les cartes de statut pilotent le filtre du
 * tableau via le paramètre d'URL `?statut=` en **shallow routing**
 * (history.replaceState) : pas de rechargement serveur, et le tableau — qui lit
 * le même paramètre — se met à jour instantanément (comme ses propres pills).
 */
export function ProspectionStats({ counts }: { counts: Counts }) {
  const searchParams = useSearchParams()
  const raw = searchParams.get("statut")
  const current = raw && (ALL_STATUSES as string[]).includes(raw) ? (raw as ProspectStatus) : null

  const setStatus = useCallback((status: ProspectStatus | null) => {
    const params = new URLSearchParams(window.location.search)
    if (status === null) params.delete("statut")
    else params.set("statut", status)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [])

  // Bascule : recliquer la carte active repasse à « tous »
  const toggle = (s: ProspectStatus) => setStatus(current === s ? null : s)

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-9">
      <Tile icon={<TrendingUp className="h-4 w-4 text-amber-500" />}     label="Actifs"        value={counts.active}       active={!current}                  onClick={() => setStatus(null)} />
      <Tile icon={<Send className="h-4 w-4 text-blue-500" />}            label="À contacter"   value={counts.toContact}    active={current === "TO_CONTACT"}   onClick={() => toggle("TO_CONTACT")} />
      <Tile icon={<MessageSquare className="h-4 w-4 text-sky-500" />}    label="Contactés"     value={counts.contacted}    active={current === "CONTACTED"}    onClick={() => toggle("CONTACTED")} />
      <Tile icon={<Reply className="h-4 w-4 text-teal-500" />}           label="A répondu"     value={counts.replied}      active={current === "REPLIED"}      onClick={() => toggle("REPLIED")} />
      <Tile icon={<MessagesSquare className="h-4 w-4 text-violet-500" />} label="En discussion" value={counts.inDiscussion} active={current === "IN_DISCUSSION"} onClick={() => toggle("IN_DISCUSSION")} />
      <Tile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Gagnés"        value={counts.won}          active={current === "WON"}          onClick={() => toggle("WON")}  variant="success" />
      <Tile icon={<XCircle className="h-4 w-4 text-red-400" />}          label="Perdus"        value={counts.lost}         active={current === "LOST"}         onClick={() => toggle("LOST")} variant="muted" />
      <Tile icon={<AtSign className="h-4 w-4 text-muted-foreground" />}  label="Avec email"    value={counts.withEmail} />
      <Tile icon={<Phone className="h-4 w-4 text-muted-foreground" />}   label="Avec téléphone" value={counts.withPhone} />
    </div>
  )
}

function Tile({
  icon, label, value, active, onClick, variant,
}: {
  icon: React.ReactNode
  label: string
  value: number
  active?: boolean
  onClick?: () => void
  variant?: "success" | "muted"
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span className="truncate">{label}</span></div>
      <p className={`text-xl font-bold tabular-nums ${variant === "success" ? "text-emerald-600" : variant === "muted" ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
    </>
  )
  // Carte simple (non filtrante) quand aucun onClick n'est fourni
  if (!onClick) {
    return <div className="rounded-xl border border-border/50 bg-card p-3 space-y-0.5">{inner}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border bg-card p-3 space-y-0.5 transition-colors ${
        active ? "border-primary" : "border-border/50 hover:border-border"
      }`}
    >
      {inner}
    </button>
  )
}
