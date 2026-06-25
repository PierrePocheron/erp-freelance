import { cookies } from "next/headers"
import { ALL_MODULE_IDS, MODULE_DEFS, MODULES_COOKIE, type ModuleId } from "@/hooks/use-modules"

const DEFAULT_ACTIVE_IDS = MODULE_DEFS.filter(m => m.defaultActive).map(m => m.id) as ModuleId[]

export async function getActiveModules(): Promise<Set<ModuleId>> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(MODULES_COOKIE)
  if (!cookie) return new Set(DEFAULT_ACTIVE_IDS)
  try {
    const parsed = JSON.parse(decodeURIComponent(cookie.value)) as ModuleId[]
    const valid  = parsed.filter(id => ALL_MODULE_IDS.includes(id)) as ModuleId[]
    if (valid.length === 0) return new Set(DEFAULT_ACTIVE_IDS)
    return new Set(valid)
  } catch {
    return new Set(DEFAULT_ACTIVE_IDS)
  }
}
