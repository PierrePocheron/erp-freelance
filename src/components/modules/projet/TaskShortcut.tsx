"use client"

import { useEffect } from "react"

export function TaskShortcut() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== "Enter") return
      const tag = (e.target as HTMLElement).tagName
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return
      if ((e.target as HTMLElement).isContentEditable) return
      e.preventDefault()
      document.dispatchEvent(new CustomEvent("erp:new-task"))
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return null
}
