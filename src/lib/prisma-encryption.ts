/**
 * Prisma Client Extension : chiffre/déchiffre de manière transparente une
 * liste de champs sensibles, quel que soit le point d'appel (actions,
 * PrismaAdapter de NextAuth...). Un seul choix de champs à maintenir ici —
 * aucun site d'écriture/lecture existant n'a besoin d'être modifié.
 *
 * Limite connue : n'intercepte que les requêtes faites directement sur le
 * modèle concerné (ex. `prisma.account.findFirst`). Un `include`/`select`
 * imbriqué qui remonterait ces champs depuis un modèle parent (ex.
 * `prisma.user.findFirst({ include: { accounts: true } })`) ne serait PAS
 * déchiffré — vérifié qu'aucun code du repo ne fait ça aujourd'hui (grep),
 * à re-vérifier si un tel include est ajouté un jour.
 */

import { Prisma } from "@/generated/prisma/client"
import { encrypt, decrypt } from "@/lib/crypto"

const ENCRYPTED_FIELDS: Record<string, string[]> = {
  UserProfile: ["iban", "bic"],
  EmitterProfile: ["iban", "bic"],
  Account: ["access_token", "refresh_token", "id_token"],
}

function encryptFields(data: unknown, fields: string[]) {
  if (!data || typeof data !== "object") return
  const record = data as Record<string, unknown>
  for (const field of fields) {
    if (typeof record[field] === "string") {
      record[field] = encrypt(record[field] as string)
    }
  }
}

function decryptFields(result: unknown, fields: string[]) {
  if (!result || typeof result !== "object") return
  if (Array.isArray(result)) {
    for (const item of result) decryptFields(item, fields)
    return
  }
  const record = result as Record<string, unknown>
  for (const field of fields) {
    if (typeof record[field] === "string") {
      record[field] = decrypt(record[field] as string)
    }
  }
}

export const fieldEncryption = Prisma.defineExtension({
  name: "field-encryption",
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        const fields = model ? ENCRYPTED_FIELDS[model] : undefined
        if (!fields) return query(args)

        // create/update : `data` (objet ou tableau pour createMany)
        // upsert : `create`/`update` séparés, pas de `data` au niveau racine
        const a = args as { data?: unknown; create?: unknown; update?: unknown }
        if (Array.isArray(a.data)) {
          for (const item of a.data) encryptFields(item, fields)
        } else if (a.data !== undefined) {
          encryptFields(a.data, fields)
        }
        if (a.create !== undefined) encryptFields(a.create, fields)
        if (a.update !== undefined) encryptFields(a.update, fields)

        const result = await query(args)
        decryptFields(result, fields)
        return result
      },
    },
  },
})
