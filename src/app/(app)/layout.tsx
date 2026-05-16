import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TimerBanner } from "@/components/layout/TimerBanner"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { NotificationBell } from "@/components/modules/notifications/NotificationBell"
import { ensureSelfClient } from "@/actions/user"
import { getRunningTimer } from "@/actions/timetracking"
import { prisma } from "@/lib/prisma"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id
  await ensureSelfClient(userId)

  const [runningTimer, notifications] = await Promise.all([
    getRunningTimer(userId),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TimerBanner initialTimer={runningTimer} userId={userId} />
        <div className="flex items-center justify-end px-6 py-2 border-b border-border/50">
          <NotificationBell userId={userId} notifications={notifications} />
        </div>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  )
}
