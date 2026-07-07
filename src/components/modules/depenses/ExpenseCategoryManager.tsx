"use client"

import { useState, useTransition, useRef } from "react"
import { Plus, Loader2, X } from "lucide-react"
import { createExpenseCategory, deleteExpenseCategory } from "@/actions/expense"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export type ExpenseCategory = { id: string; name: string; color: string }

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#64748b",
]

export function ExpenseCategoryManager({
  initialCategories,
}: {
  initialCategories: ExpenseCategory[]
}) {
  const [categories, setCategories] = useState(initialCategories)
  const [name, setName] = useState("")
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [isPending, startTransition] = useTransition()
  const submittingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n || submittingRef.current) return
    if (categories.find((c) => c.name.toLowerCase() === n.toLowerCase())) return
    submittingRef.current = true
    const optimistic: ExpenseCategory = { id: `tmp-${Date.now()}`, name: n, color }
    setCategories((prev) => [...prev, optimistic])
    setName("")
    startTransition(async () => {
      await createExpenseCategory(n, color)
      submittingRef.current = false
      inputRef.current?.focus()
    })
  }

  function handleDelete(category: ExpenseCategory) {
    setCategories((prev) => prev.filter((c) => c.id !== category.id))
    startTransition(() => deleteExpenseCategory(category.id))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {categories.map((category) => (
        <div key={category.id} className="flex items-center gap-1 group/cat">
          <span
            className="text-xs font-medium rounded-full px-2 py-0.5 leading-none"
            style={{ backgroundColor: `${category.color}22`, color: category.color, border: `1px solid ${category.color}44` }}
          >
            {category.name}
          </span>
          <button
            type="button"
            onClick={() => handleDelete(category)}
            className="opacity-0 group-hover/cat:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            title="Supprimer la catégorie"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <form onSubmit={handleCreate} className="flex items-center gap-1.5">
        <div className="flex gap-1">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-4 w-4 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? c : "transparent",
                boxShadow: color === c ? `0 0 0 1px white, 0 0 0 2px ${c}` : "none",
              }}
            />
          ))}
        </div>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nouvelle catégorie"
          className="h-7 text-xs w-32"
          disabled={isPending}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending || !name.trim()}
          className="h-7 px-2 text-xs gap-1"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </form>
    </div>
  )
}
