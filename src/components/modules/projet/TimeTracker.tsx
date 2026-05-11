"use client"

import { useState, useEffect, useTransition } from "react"
import { Timer, Square, Clock } from "lucide-react"
import { startTimer, stopTimer } from "@/actions/timetracking"
import { cn } from "@/lib/utils"

type TimeEntry = {
  id: string
  startedAt: Date
  endedAt: Date | null
  duration: number | null
}

type Props = {
  taskId: string
  userId: string
  projectId: string
  timeEntries: TimeEntry[]
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`
  return `${s}s`
}

export function TimeTracker({ taskId, userId, projectId, timeEntries }: Props) {
  const runningEntry = timeEntries.find((e) => !e.endedAt)
  const [isPending, startTransition] = useTransition()
  const [elapsed, setElapsed] = useState(0)

  const totalPast = timeEntries
    .filter((e) => e.endedAt && e.duration)
    .reduce((s, e) => s + (e.duration ?? 0), 0)

  useEffect(() => {
    if (!runningEntry) { setElapsed(0); return }
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(runningEntry.startedAt).getTime()) / 1000))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [runningEntry?.id])

  const totalSeconds = totalPast + elapsed
  const isRunning = !!runningEntry

  function handleToggle() {
    startTransition(async () => {
      if (isRunning && runningEntry) {
        await stopTimer(runningEntry.id, userId, projectId)
      } else {
        await startTimer(taskId, userId, projectId)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {totalSeconds > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDuration(totalSeconds)}
        </span>
      )}
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={isRunning ? "Arrêter le chrono" : "Démarrer le chrono"}
        className={cn(
          "rounded p-0.5 transition-colors",
          isRunning
            ? "text-red-500 hover:text-red-600 animate-pulse"
            : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        {isRunning ? <Square className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
      </button>
    </div>
  )
}
