"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle({ expanded }: { expanded: boolean }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex h-9 items-center gap-3 rounded-xl px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        expanded ? "w-full" : "w-10 justify-center"
      )}
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      {dark
        ? <Sun className="h-4 w-4 shrink-0" />
        : <Moon className="h-4 w-4 shrink-0" />
      }
      {expanded && <span className="text-sm truncate">{dark ? "Mode clair" : "Mode sombre"}</span>}
    </button>
  )
}
