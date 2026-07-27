-- Erreur de distribution notée manuellement sur un brouillon envoyé (email rejeté / non distribué).
ALTER TABLE "EmailDraft" ADD COLUMN     "deliveryError" TEXT;
