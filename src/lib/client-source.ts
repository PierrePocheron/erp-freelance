// Sources d'un contact/prospect — libellés partagés (une seule source de
// vérité, importable côté serveur et client, pas de directive).
export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  PROSPECTION:   "Prospection",
  WORD_OF_MOUTH: "Bouche à oreille",
  FAMILY:        "Famille",
  FRIENDS:       "Amis",
  LINKEDIN:      "LinkedIn",
  WEBSITE:       "Site web",
  INBOUND:       "Entrant",
  OTHER:         "Autre",
}

// Ordre d'affichage dans les sélecteurs
export const CLIENT_SOURCES = Object.keys(CLIENT_SOURCE_LABELS)
