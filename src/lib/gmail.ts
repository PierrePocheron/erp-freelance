/**
 * Ouverture/copie d'un mail vers Gmail pour l'envoi manuel (pas de Resend).
 *
 * Deux chemins, car Gmail a une limite : l'URL de composition ne transporte
 * que du **texte brut** (`&body=`), impossible d'y injecter du gras.
 *  - `gmailComposeUrl` : lien 1-clic, corps pré-rempli en texte brut (les
 *    marqueurs `**gras**` sont retirés pour ne pas s'afficher en dur).
 *  - `copyEmailBody` : copie enrichie (text/html + text/plain) — collée dans
 *    Gmail (Cmd/Ctrl+V), la mise en forme gras est conservée.
 */
import { bodyToHtml, stripMarkdown } from "@/lib/email-template"

/** URL Gmail « compose » pré-remplie (destinataire, objet, corps en texte brut). */
export function gmailComposeUrl({ to, subject, body }: { to: string; subject: string; body: string }): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body: stripMarkdown(body), // une URL Gmail ne porte que du texte brut
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

/**
 * Copie le corps du mail en conservant la mise en forme (gras) au collage dans
 * Gmail : ClipboardItem text/html + text/plain, avec repli texte brut.
 * Retourne `true` si la copie a réussi.
 */
export async function copyEmailBody(body: string): Promise<boolean> {
  const html = bodyToHtml(body)
  const plain = stripMarkdown(body)
  try {
    if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ])
    } else {
      await navigator.clipboard.writeText(plain)
    }
    return true
  } catch {
    try { await navigator.clipboard.writeText(plain); return true }
    catch { return false }
  }
}
