"use client"

import { useEffect, useState } from "react"
import { checkNewModules, useModules, type ModuleId, type NewModulesInfo } from "@/hooks/use-modules"
import { APP_VERSION } from "@/lib/app-version"
import { NewModulesDialog } from "./NewModulesDialog"

export function NewModulesGate() {
  const { activeModules, setModules } = useModules()
  const [info, setInfo] = useState<NewModulesInfo | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(checkNewModules(APP_VERSION))
  }, [])

  if (!info) return null

  return (
    <NewModulesDialog
      info={info}
      onValidate={(enabledIds: ModuleId[]) => {
        setModules([...activeModules, ...enabledIds])
        setInfo(null)
      }}
    />
  )
}
