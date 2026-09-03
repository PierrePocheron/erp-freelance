"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"
import { Check, ExternalLink, Users } from "lucide-react"

/**
 * Réglages › Intégrations — accès en lecture à Google Contacts (+ « Autres contacts » Gmail)
 * pour rapprocher/enrichir les contacts de l'ERP. Même mécanisme d'autorisation incrémentale
 * que Google Agenda : le compte est déjà connecté, on ajoute seulement 2 scopes lecture seule.
 */
export function GoogleContactsSection({ hasScope }: { hasScope: boolean }) {
  function handleConnect() {
    signIn("google", { callbackUrl: "/settings" }, {
      scope: [
        "openid", "email", "profile",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/contacts.other.readonly",
      ].join(" "),
      include_granted_scopes: "true",   // conserve agenda & co.
      prompt: "consent",                // refresh_token + consentement explicite
      access_type: "offline",
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Google Contacts</h2>
      </div>

      {hasScope ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Check className="h-4 w-4" />
            <span>Lecture de vos contacts Google autorisée</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Depuis <Link href="/contacts/import" className="underline underline-offset-2 hover:text-foreground">Contacts › Importer</Link>,
            l&apos;ERP compare vos contacts Google (carnet + adresses enregistrées automatiquement par Gmail)
            avec ceux de l&apos;application et vous <strong>propose</strong> les emails et téléphones manquants.
            Rien n&apos;est écrit sans votre validation, et rien n&apos;est modifié côté Google.
          </p>
          <button type="button" onClick={handleConnect} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1">
            Réautoriser l&apos;accès <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Autorisez la <strong>lecture</strong> de vos contacts Google pour retrouver automatiquement
            les emails et téléphones de vos contacts ERP. Votre compte Google est déjà connecté —
            il s&apos;agit seulement d&apos;accorder l&apos;accès aux contacts.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />Carnet Google Contacts + « Autres contacts » (adresses mémorisées par Gmail)</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />Lecture seule — aucune écriture côté Google</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />Chaque rapprochement est validé par vous avant écriture dans l&apos;ERP</li>
          </ul>
          <button type="button" onClick={handleConnect} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Autoriser Google Contacts
          </button>
        </div>
      )}
    </div>
  )
}
