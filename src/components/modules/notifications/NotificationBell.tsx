"use client"

import { useState, useTransition } from "react"
import { Bell, X, CheckCheck } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications"
import { useRouter } from "next/navigation"

type Notification = {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  isRead: boolean
  createdAt: Date | string
}

function fmtDate(d: Date | string) {
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `Il y a ${days}j`
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function NotificationBell({
  userId,
  notifications,
}: {
  userId: string
  notifications: Notification[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const unreadCount = notifications.filter((n) => !n.isRead).length

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id, userId)
      router.refresh()
    })
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead(userId)
      router.refresh()
    })
  }

  function handleNotifClick(notif: Notification) {
    if (!notif.isRead) handleMarkRead(notif.id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
          open ? "bg-accent" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tout lire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune notification
                </div>
              ) : (
                <div>
                  {notifications.map((notif) => {
                    const inner = (
                      <div
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
                          !notif.isRead && "bg-primary/5",
                          notif.href && "hover:bg-muted/40 cursor-pointer"
                        )}
                      >
                        <div className="mt-1 shrink-0">
                          {!notif.isRead && (
                            <span className="block h-2 w-2 rounded-full bg-primary" />
                          )}
                          {notif.isRead && (
                            <span className="block h-2 w-2 rounded-full bg-transparent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{notif.body}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(notif.createdAt)}</p>
                        </div>
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkRead(notif.id) }}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                            title="Marquer comme lu"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )

                    return notif.href ? (
                      <Link
                        key={notif.id}
                        href={notif.href}
                        onClick={() => handleNotifClick(notif)}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div key={notif.id}>{inner}</div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
