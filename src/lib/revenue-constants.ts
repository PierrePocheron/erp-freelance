export const REVENUE_TYPE_LABELS: Record<string, string> = {
  SALARY:        "Salaire",
  FREELANCE:     "Freelance / AE",
  STUDY:         "Étude rémunérée",
  INVESTMENT:    "Investissement",
  RENTAL:        "Locatif",
  PLATFORM:      "Plateforme",
  REIMBURSEMENT: "Remboursement",
  OTHER:         "Autre",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VIREMENT:     "Virement",
  WERO:         "Wero",
  ESPECES:      "Espèces",
  CHEQUE:       "Chèque",
  CARTE:        "Carte",
  PAYPAL:       "PayPal",
  CARTE_CADEAU: "Carte cadeau",
  OTHER:        "Autre",
}

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS)
export const REVENUE_TYPES   = Object.keys(REVENUE_TYPE_LABELS)
