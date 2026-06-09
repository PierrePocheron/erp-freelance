"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Settings, Trash2, AlertTriangle, UserPlus, UserMinus, ChevronDown, Shield, Eye, User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  addProjectMember, removeProjectMember, updateProjectMemberRole, deleteProject,
} from "@/actions/projet"

type Member = {
  userId: string
  role: string
  user: { name: string | null; email: string; image: string | null }
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MEMBER: "Membre",
  VIEWER: "Lecteur",
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  ADMIN: <Shield className="h-3 w-3" />,
  MEMBER: <User className="h-3 w-3" />,
  VIEWER: <Eye className="h-3 w-3" />,
}


export function ProjectSettingsDialog({
  projectId,
  userId,
  projectName,
  members,
  ownerName,
  ownerEmail,
  ownerImage,
}: {
  projectId: string
  userId: string
  projectName: string
  members: Member[]
  ownerName: string | null
  ownerEmail: string
  ownerImage: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"members" | "danger">("members")

  // Invite
  const [email, setEmail] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [isPendingInvite, startInvite] = useTransition()

  // Role update
  const [isPendingRole, startRole] = useTransition()

  // Remove
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [isPendingRemove, startRemove] = useTransition()

  // Delete
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [isPendingDelete, startDelete] = useTransition()

  function handleInvite() {
    if (!email.trim()) return
    setInviteError("")
    startInvite(async () => {
      const res = await addProjectMember(projectId, userId, email.trim())
      if (res.error) {
        setInviteError(res.error)
      } else {
        setEmail("")
      }
    })
  }

  function handleRoleChange(memberId: string, role: string) {
    if (role !== "MEMBER" && role !== "VIEWER") return
    startRole(async () => {
      await updateProjectMemberRole(projectId, userId, memberId, role)
    })
  }

  function handleRemove(memberId: string) {
    startRemove(async () => {
      await removeProjectMember(projectId, userId, memberId)
      setConfirmRemove(null)
    })
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteProject(projectId, userId)
      router.push("/projets")
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setTab("members") }}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Réglages du projet"
      >
        <Settings className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEmail(""); setInviteError(""); setDeleteConfirmed(false) } }}>
        <DialogContent className="sm:max-w-md p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base">Réglages — {projectName}</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border mt-4 px-5">
            {(["members", "danger"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`pb-2.5 px-1 mr-5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "members" ? "Collaborateurs" : "Danger"}
              </button>
            ))}
          </div>

          <div className="px-5 py-5 space-y-5">

            {tab === "members" && (
              <>
                {/* Owner */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Propriétaire</p>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={ownerName} image={ownerImage} size="md" variant="primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ownerName ?? ownerEmail}</p>
                      <p className="text-xs text-muted-foreground truncate">{ownerEmail}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  </div>
                </div>

                {/* Members list */}
                {members.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collaborateurs</p>
                    <div className="space-y-1">
                      {members.map((m) => (
                        <div key={m.userId} className="flex items-center gap-2.5 py-1">
                          <UserAvatar name={m.user.name} image={m.user.image} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.user.name ?? m.user.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                          </div>

                          {/* Role selector */}
                          <div className="relative shrink-0">
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                              disabled={isPendingRole}
                              className="appearance-none flex h-7 items-center gap-1 rounded-md border border-border bg-background pl-2 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="MEMBER">Membre</option>
                              <option value="VIEWER">Lecteur</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
                          </div>

                          {/* Remove */}
                          {confirmRemove === m.userId ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRemove(m.userId)}
                                disabled={isPendingRemove}
                                className="text-xs text-red-500 hover:text-red-600 font-medium"
                              >
                                Retirer
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemove(null)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(m.userId)}
                              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                              title="Retirer l'accès"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite form */}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" />
                    Inviter par email
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setInviteError("") }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInvite() } }}
                      placeholder="collaborateur@example.com"
                      className="h-8 flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPendingInvite || !email.trim()}
                      onClick={handleInvite}
                      className="shrink-0"
                    >
                      {isPendingInvite ? "…" : "Inviter"}
                    </Button>
                  </div>
                  {inviteError && (
                    <p className="text-xs text-red-500">{inviteError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    L&apos;utilisateur doit déjà avoir un compte sur l&apos;application.
                  </p>
                </div>
              </>
            )}

            {tab === "danger" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-600">Supprimer le projet</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le projet <span className="font-semibold text-foreground">{projectName}</span> sera supprimé définitivement avec toutes ses données : tâches, jalons, livrables, notes, time tracking, liens utiles.
                  </p>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-destructive"
                    />
                    <span className="text-xs">Je comprends que cette action est irréversible</span>
                  </label>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!deleteConfirmed || isPendingDelete}
                    onClick={handleDelete}
                    className="w-full"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isPendingDelete ? "Suppression…" : "Supprimer définitivement"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
