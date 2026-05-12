import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TimerBanner } from "@/components/layout/TimerBanner"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { ensureSelfClient } from "@/actions/user"
import { getRunningTimer } from "@/actions/timetracking"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id
  await ensureSelfClient(userId)

  const runningTimer = await getRunningTimer(userId)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TimerBanner initialTimer={runningTimer} userId={userId} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  )
}
