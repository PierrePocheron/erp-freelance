import { beforeEach, afterAll, vi } from "vitest"

// ── Session pilotable ─────────────────────────────────────────────────────────
// vi.hoisted pour pouvoir être référencé dans la factory de vi.mock (hoistée).
// On NE peut PAS exporter directement une variable hoistée → on garde l'état
// local et on n'expose que le setter.
const sessionState = vi.hoisted(() => ({ userId: "test-user" }))

export function setTestUser(userId: string) {
  sessionState.userId = userId
}

// ── Mocks des frontières externes ─────────────────────────────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: sessionState.userId } })),
}))

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (path: string) => ({ url: `https://blob.test/${path}` })),
  del: vi.fn(async () => {}),
  list: vi.fn(async () => ({ blobs: [] })),
}))

// Évite de tirer @react-pdf/renderer (lourd) dans les tests d'intégration.
vi.mock("@/lib/invoice-pdf", () => ({
  buildInvoicePdfBuffer: vi.fn(async () => Buffer.from("%PDF-1.4 test")),
}))

// ── Reset de la base entre chaque test ────────────────────────────────────────
import { prisma } from "@/lib/prisma"

beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(", ")
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
  }
  sessionState.userId = "test-user"
})

afterAll(async () => {
  await prisma.$disconnect()
})
