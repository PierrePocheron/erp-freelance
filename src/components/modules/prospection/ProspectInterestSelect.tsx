"use client"

import { useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { setProspectInterest } from "@/actions/prospection"
import { INTEREST_LEVELS, INTEREST_ORDER } from "@/lib/prospect-interest"
import { cn } from "@/lib/utils"

/**
 * Badge d'intérêt/priorité cliquable → dropdown de changement rapide (inline).
 * Même pattern que ProspectStatusSelect (portail + position fixe pour ne pas
 * être rogné par le conteneur overflow-x-auto du tableau).
 */
export function ProspectInterestSelect({
  clientId,
  value,
}: {
  clientId: string
  value: number | null
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isPending, startTransition] = useTransition()

  const current = value && INTEREST_LEVELS[value] ? INTEREST_LEVELS[value] : null

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuHeight = 180
      const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        zIndex: 9999,
      })
    }
    setOpen((v) => !v)
  }

  function pick(next: number | null) {
    if (next === value) { setOpen(false); return }
    startTransition(async () => {
      await setProspectInterest(clientId, next)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openMenu}
        disabled={isPending}
        className={cn(
          "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-75 disabled:opacity-50 whitespace-nowrap",
          current ? current.cls : "border-dashed border-input text-muted-foreground/60"
        )}
      >
        {current ? current.short : "À évaluer"} ▾
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div aria-hidden="true" className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div style={menuStyle} className="rounded-lg border border-border bg-popover shadow-md p-1 min-w-44" onClick={(e) => e.stopPropagation()}>
            {INTEREST_ORDER.map((lvl) => (
              <button
                key={lvl}
                onClick={() => pick(lvl)}
                className={cn(
                  "w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2",
                  lvl === value && "font-semibold"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", INTEREST_LEVELS[lvl].dot)} />
                {lvl} — {INTEREST_LEVELS[lvl].label}
              </button>
            ))}
            <button
              onClick={() => pick(null)}
              className="w-full text-left px-2 py-1 mt-0.5 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground border-t border-border/50 pt-1.5"
            >
              Non évalué
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
