"use client"

import { useState, useEffect, useTransition } from "react"
import { Timer, Square } from "lucide-react"
import { stopTimer } from "@/actions/timetracking"
import Link from "next/link"

type RunningTimer = {
  id: string
  startedAt: Date | string
  task: { id: string; title: string; projectId: string | null }
}

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`
  if (m > 0) return `${m}m${String(sec).padStart(2, "0")}s`
  return `${sec}s`
}

export function TimerBanner({
  initialTimer,
  userId,
}: {
  initialTimer: RunningTimer | null
  userId: string
}) {
  const [elapsed, setElapsed] = useState(0)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initialTimer) { setElapsed(0); return }
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(initialTimer.startedAt).getTime()) / 1000))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [initialTimer?.id])

  if (!initialTimer) return null

  function handleStop() {
    startTransition(async () => {
      await stopTimer(initialTimer!.id, userId, initialTimer!.task.projectId ?? "")
    })
  }

  return (
    <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/8 px-6 py-2 text-sm shrink-0">
      <Timer className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
      <span className="text-amber-700 dark:text-amber-400 font-medium">Chrono actif ·</span>
      <Link
        href={initialTimer.task.projectId ? `/projets/${initialTimer.task.projectId}/dev` : "/taches"}
        className="text-amber-700 dark:text-amber-400 hover:underline truncate flex-1"
      >
        {initialTimer.task.title}
      </Link>
      <span className="font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums shrink-0">
        {fmt(elapsed)}
      </span>
      <button
        onClick={handleStop}
        disabled={isPending}
        title="Arrêter le chrono"
        className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-red-500 transition-colors shrink-0"
      >
        <Square className="h-3.5 w-3.5" />
        Stop
      </button>
    </div>
  )
}
