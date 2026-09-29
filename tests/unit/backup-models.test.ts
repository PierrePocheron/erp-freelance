import { describe, it, expect } from "vitest"
import { Prisma } from "@/generated/prisma/client"
import { BACKUP_MODELS, EXCLUDED_MODELS } from "@/lib/backup-models"

describe("sauvegarde : inventaire complet des modèles (#7)", () => {
  it("chaque modèle du schéma est sauvegardé ou explicitement exclu", () => {
    const covered = new Set([...Object.values(BACKUP_MODELS), ...Object.keys(EXCLUDED_MODELS)])
    const missing = Object.values(Prisma.ModelName).filter((m) => !covered.has(m))
    expect(missing, "modèle absent de src/lib/backup-models.ts").toEqual([])
  })

  it("aucun modèle à la fois sauvegardé et exclu, aucun nom inconnu", () => {
    const all = new Set<string>(Object.values(Prisma.ModelName))
    const saved = Object.values(BACKUP_MODELS)
    expect(saved.filter((m) => m in EXCLUDED_MODELS)).toEqual([])
    expect([...saved, ...Object.keys(EXCLUDED_MODELS)].filter((m) => !all.has(m))).toEqual([])
  })
})
