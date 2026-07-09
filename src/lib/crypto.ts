/**
 * Chiffrement réversible (AES-256-GCM) pour les champs sensibles au repos
 * (IBAN/BIC, tokens OAuth) — pas du hachage : ces valeurs doivent être
 * relues en clair pour être utilisées (PDF de facture, appel API Google).
 *
 * Format des valeurs chiffrées : "enc:v1:<iv>:<authTag>:<ciphertext>" (base64).
 * decrypt() sur une valeur sans ce préfixe la retourne telle quelle
 * (compatibilité ascendante avec les lignes déjà en clair en base — elles
 * seront rechiffrées à leur prochaine écriture, pas de migration bloquante).
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const PREFIX = "enc:v1:"
const IV_LENGTH = 12

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error("ENCRYPTION_KEY manquante — générer avec `openssl rand -base64 32`")
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY doit décoder en 32 octets (sortie de `openssl rand -base64 32`)")
  return key
}

export function encrypt(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext === null || plaintext === undefined) return plaintext
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`
}

export function decrypt(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value
  if (!value.startsWith(PREFIX)) return value

  const [ivB64, authTagB64, ciphertextB64] = value.slice(PREFIX.length).split(":")
  if (!ivB64 || !authTagB64 || !ciphertextB64) return value

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()])
  return plaintext.toString("utf8")
}
