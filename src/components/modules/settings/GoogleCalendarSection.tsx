"use client"

import { signIn } from "next-auth/react"
import { Calendar, Check, ExternalLink } from "lucide-react"

export function GoogleCalendarSection({ hasScope }: { hasScope: boolean }) {
  function handleConnect() {
    // Le compte Google est déjà connecté (seul provider de connexion).
    // On demande uniquement l'autorisation incrémentale d'accès à l'agenda.
    signIn("google", { callbackUrl: "/settings" }, {
      scope: [
        "openid",
        "email",
        "profile",
        // Scope complet requis pour créer l'agenda dédié "ERP Freelance"
        // (englobe calendar.readonly + calendar.events)
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ].join(" "),
      // conserve les scopes déjà accordés (autorisation incrémentale)
      include_granted_scopes: "true",
      // Force le consentement pour avoir le refresh_token
      prompt: "consent",
      access_type: "offline",
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Google Calendar</h2>
      </div>

      {hasScope ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Check className="h-4 w-4" />
            <span>Accès à Google Agenda autorisé</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vos événements Google Calendar sont synchronisables depuis le module Calendrier
            via le bouton <strong>Sync Google</strong>. Les événements créés dans l&apos;ERP
            sont automatiquement poussés dans un agenda dédié <strong>ERP Freelance</strong>.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            Réautoriser l&apos;accès
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Autorisez l&apos;accès à votre Google Agenda pour synchroniser vos événements dans l&apos;ERP.
            Votre compte Google est déjà connecté — il s&apos;agit seulement d&apos;accorder l&apos;accès au calendrier.
            Aucune donnée n&apos;est modifiée automatiquement — seule la <strong>lecture</strong> se déclenche
            toute seule à l&apos;ouverture du calendrier (fenêtre limitée à 1 mois passé, extensible en navigant).
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
              Lecture de votre calendrier principal (Google → ERP)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
              Push des événements ERP dans un agenda dédié (ERP → Google)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
              Lecture auto à l&apos;ouverture du calendrier, sync manuelle aussi disponible
            </li>
          </ul>
          <button
            type="button"
            onClick={handleConnect}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Autoriser Google Agenda
          </button>
        </div>
      )}
    </div>
  )
}
