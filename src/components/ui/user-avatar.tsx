"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type Size = "xs" | "sm" | "md" | "lg"
type Variant = "primary" | "muted"

const sizeClass: Record<Size, string> = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
}

const variantClass: Record<Variant, string> = {
  primary: "bg-primary/20 text-primary",
  muted:   "bg-muted text-muted-foreground",
}

export function UserAvatar({
  name,
  email,
  image,
  size = "sm",
  variant = "muted",
  withRing = false,
  title,
  className,
}: {
  name?: string | null
  email?: string | null
  image?: string | null
  size?: Size
  variant?: Variant
  /** Ajoute border-2 border-background (pour les stacks d'avatars) */
  withRing?: boolean
  title?: string
  className?: string
}) {
  const [imgError, setImgError] = useState(false)

  const label    = name ?? email ?? "?"
  const initials = label.slice(0, 1).toUpperCase()
  const ringCls  = withRing ? "border-2 border-background" : ""
  const base     = cn(sizeClass[size], "rounded-full shrink-0", ringCls, className)

  if (image && !imgError) {
    return (
      <img
        src={image}
        alt={label}
        title={title}
        onError={() => setImgError(true)}
        className={cn(base, "object-cover")}
      />
    )
  }

  return (
    <div
      title={title}
      className={cn(base, variantClass[variant], "font-semibold flex items-center justify-center")}
    >
      {initials}
    </div>
  )
}
