// Template PDF des devis/factures — style « Pedro Dev » (repris des factures
// Canva de Pierre) : fond crème encadré d'un filet noir, logo texte avec point
// coloré, type de document en énorme, table soulignée au filet noir et pied en
// deux colonnes RÈGLEMENT / TERMES & CONDITIONS.
//
// Personnalisation via UserProfile (logo texte, sous-titre, fond, banque,
// couleur d'accent) — résolue en amont par resolveEmitter / les routes.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import { computeTaxBreakdown, netAmount } from "@/lib/money"
import { pdfFont, pdfLogoFont, registerPdfFonts } from "@/lib/pdf-fonts"

const DEFAULT_ACCENT = "#6366f1"
const DEFAULT_BACKGROUND = "#FAF6EE"
const DEFAULT_LOGO_TEXT = "PP"
const DEFAULT_LOGO_SUBTEXT = "PEDRO DEV"
const INK = "#111111"

// Polices enregistrées au chargement du module (fallback Helvetica géré).
registerPdfFonts()

function makeStyles(accent: string, background: string) {
  return StyleSheet.create({
    page: {
      ...pdfFont(400),
      fontSize: 9,
      color: INK,
      backgroundColor: background,
      paddingTop: 42,
      paddingBottom: 64,
      paddingHorizontal: 44,
    },
    // Cadre intérieur fin, répété sur chaque page.
    frame: {
      position: "absolute",
      top: 16,
      left: 16,
      right: 16,
      bottom: 16,
      borderWidth: 1,
      borderColor: INK,
    },
    // ── En-tête ──────────────────────────────────────────────────────────
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    logoText: {
      // Barbra Semi Condensed = la vraie police du logo Canva (fallback Poppins)
      ...pdfLogoFont(),
      fontSize: 40,
      lineHeight: 1,
      letterSpacing: -1,
    },
    logoDot: {
      color: accent,
    },
    logoSubtext: {
      ...pdfFont(600),
      fontSize: 8,
      letterSpacing: 3,
      textTransform: "uppercase",
      marginTop: 4,
    },
    titleBlock: {
      flex: 1,
      alignItems: "flex-end",
      paddingLeft: 16,
    },
    docTitle: {
      ...pdfFont(800),
      lineHeight: 1,
      textTransform: "uppercase",
      textAlign: "right",
    },
    docNumber: {
      ...pdfFont(800),
      fontSize: 12,
      marginTop: 8,
    },
    docDate: {
      ...pdfFont(600),
      fontSize: 8.5,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginTop: 6,
    },
    // ── Émetteur / destinataire ─────────────────────────────────────────
    parties: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 40,
      gap: 24,
    },
    partyLabel: {
      ...pdfFont(800),
      fontSize: 9.5,
      marginBottom: 5,
    },
    partyLine: {
      fontSize: 9,
      lineHeight: 1.55,
    },
    partyBold: {
      ...pdfFont(600),
    },
    recipient: {
      alignItems: "flex-end",
    },
    recipientLine: {
      fontSize: 9,
      lineHeight: 1.55,
      textAlign: "right",
    },
    // ── Table ────────────────────────────────────────────────────────────
    table: {
      marginTop: 34,
      borderBottomWidth: 1,
      borderBottomColor: INK,
    },
    tableHeader: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: INK,
      paddingBottom: 6,
      gap: 8,
    },
    tableHeaderText: {
      ...pdfFont(800),
      fontSize: 9,
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 10,
      gap: 8,
    },
    colDesc: { flex: 5 },
    colQty: { flex: 1.5, textAlign: "right" },
    colUnit: { flex: 2, textAlign: "right" },
    colTax: { flex: 1.1, textAlign: "right" },
    colTotal: { flex: 2, textAlign: "right" },
    lineHeading: {
      ...pdfFont(600),
      fontSize: 9.5,
      lineHeight: 1.4,
    },
    lineHeadingFollow: {
      marginTop: 6,
    },
    bulletRow: {
      flexDirection: "row",
      marginTop: 3,
      paddingLeft: 4,
    },
    bulletGlyph: {
      width: 10,
      fontSize: 9,
      lineHeight: 1.4,
    },
    bulletText: {
      flex: 1,
      fontSize: 9,
      lineHeight: 1.4,
    },
    cellValue: {
      fontSize: 9.5,
      lineHeight: 1.4,
    },
    cellValueBold: {
      ...pdfFont(600),
    },
    // ── Totaux ───────────────────────────────────────────────────────────
    totalsBlock: {
      alignSelf: "flex-end",
      marginTop: 24,
      width: 270,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "baseline",
      paddingVertical: 3,
    },
    totalLabel: {
      ...pdfFont(600),
      fontSize: 10.5,
      textAlign: "right",
    },
    totalValue: {
      ...pdfFont(800),
      fontSize: 10.5,
      width: 110,
      textAlign: "right",
    },
    totalNote: {
      fontSize: 7.5,
      textAlign: "right",
      marginTop: 4,
      color: "#444444",
    },
    totalMeta: {
      ...pdfFont(600),
      fontSize: 8.5,
      textAlign: "right",
      marginTop: 8,
    },
    // ── Pied : règlement / conditions ────────────────────────────────────
    footerColumns: {
      flexDirection: "row",
      gap: 28,
      marginTop: 34,
    },
    footerColLeft: {
      width: "40%",
    },
    footerColRight: {
      flex: 1,
    },
    footerHeading: {
      ...pdfFont(800),
      fontSize: 10,
      marginBottom: 7,
    },
    paymentLine: {
      fontSize: 9,
      lineHeight: 1.6,
    },
    paymentBold: {
      ...pdfFont(600),
    },
    conditionsText: {
      fontSize: 7.5,
      lineHeight: 1.5,
    },
    signatureBox: {
      marginTop: 4,
      height: 56,
    },
    // ── Bas de page fixe ─────────────────────────────────────────────────
    pageFooter: {
      position: "absolute",
      bottom: 26,
      left: 44,
      right: 44,
      textAlign: "center",
      fontSize: 7,
      color: "#555555",
    },
  })
}

type Line = {
  description: string
  detail?: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
}

type DocProps = {
  type: "DEVIS" | "FACTURE"
  number: string
  createdAt: Date
  expiresAt?: Date | null
  dueDate?: Date | null
  sentAt?: Date | null
  acceptedAt?: Date | null
  depositPercent?: number
  depositDeducted?: number
  // Type précis de la facture (Invoice.type) — "DEPOSIT" affiche FACTURE D'ACOMPTE.
  invoiceType?: "DEPOSIT" | "FINAL" | "RECURRING" | "STANDALONE" | null
  accentColor?: string | null
  // Branding PDF (UserProfile) — défauts « Pedro Dev » si absents.
  logoText?: string | null
  logoSubtext?: string | null
  backgroundColor?: string | null
  emitter: {
    name: string
    email: string
    companyName?: string | null
    address?: string | null
    postalCode?: string | null
    city?: string | null
    siret?: string | null
    phone?: string | null
    website?: string | null
    bankName?: string | null
    iban?: string | null
    bic?: string | null
  }
  client: {
    name: string
    company?: string | null
    email?: string | null
    address?: string | null
    postalCode?: string | null
    city?: string | null
    siret?: string | null
  }
  lines: Line[]
  notes?: string | null
  generalConditions?: string | null
  totalHT: number
}

function fmtDateShort(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—"
}

// « 27 MAI 2026 » — date exacte en capitales, comme sur les factures Canva.
function fmtDateCaps(d: Date) {
  return new Date(d)
    .toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase()
}

// Espaces insécables (fines) remplacées : tous les poids de Poppins n'ont pas
// le glyphe U+202F et @react-pdf rendrait un carré.
function fmtMoney(n: number) {
  return (
    n
      .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(/[  ]/g, " ") + "€"
  )
}

function fmtQty(n: number) {
  return n.toLocaleString("fr-FR").replace(/[  ]/g, " ")
}

function fmtTaxLabel(rate: number) {
  return `${String(rate).replace(".", ",")}%`
}

// ── Description riche ────────────────────────────────────────────────────
// Une ligne de document peut contenir plusieurs lignes de texte :
//   - « - xxx » (ou « • xxx ») → puce
//   - « xxx : » ou ligne sans préfixe → sous-titre gras
// Le champ detail (secondaire) devient des puces par défaut.
type RichLine = { kind: "heading" | "bullet"; text: string }

function parseRichText(
  text: string | null | undefined,
  fallback: RichLine["kind"]
): RichLine[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const bullet = l.match(/^[-•*]\s+(.*)$/)
      if (bullet) return { kind: "bullet" as const, text: bullet[1] }
      if (l.endsWith(":")) return { kind: "heading" as const, text: l }
      return { kind: fallback, text: l }
    })
}

export function InvoicePDF({
  type,
  number,
  createdAt,
  expiresAt,
  dueDate,
  depositPercent,
  depositDeducted,
  invoiceType,
  accentColor,
  logoText,
  logoSubtext,
  backgroundColor,
  emitter,
  client,
  lines,
  generalConditions,
  totalHT,
}: DocProps) {
  const accent = accentColor || DEFAULT_ACCENT
  const styles = makeStyles(accent, backgroundColor || DEFAULT_BACKGROUND)
  const displayName = emitter.companyName || emitter.name
  const brandText = (logoText || DEFAULT_LOGO_TEXT).trim()
  const brandSubtext = (logoSubtext || DEFAULT_LOGO_SUBTEXT).trim()

  // Ventilation TVA + net (logique centralisée et testée dans @/lib/money).
  const { byRate, totalTVA, totalTTC, allZeroTax } = computeTaxBreakdown(lines, totalHT)
  const net = netAmount(totalHT, depositDeducted ?? 0)
  const isFacture = type === "FACTURE"
  const isDeposit = isFacture && invoiceType === "DEPOSIT"

  const docTitle = isDeposit ? "FACTURE D'ACOMPTE" : type
  const numberLabel = isDeposit ? "N°" : `${type} N°`

  const emitterCityLine = [emitter.postalCode, emitter.city].filter(Boolean).join(" - ")
  const clientCityLine = [client.postalCode, client.city].filter(Boolean).join(" ")

  // La raison sociale n'est répétée dans le bloc émetteur que si elle diffère
  // de la marque du logo (sinon elle ferait doublon avec « PEDRO DEV »).
  const showCompanyLine =
    !!emitter.companyName &&
    emitter.companyName.trim().toUpperCase() !== brandSubtext.toUpperCase()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame} fixed />

        {/* En-tête : logo texte + type de document */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>
              {brandText}
              <Text style={styles.logoDot}>.</Text>
            </Text>
            {brandSubtext ? <Text style={styles.logoSubtext}>{brandSubtext}</Text> : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.docTitle, { fontSize: docTitle.length > 8 ? 26 : 40 }]}>
              {docTitle}
            </Text>
            <Text style={styles.docNumber}>
              {numberLabel} : {number}
            </Text>
            <Text style={styles.docDate}>{fmtDateCaps(createdAt)}</Text>
          </View>
        </View>

        {/* Émetteur / destinataire */}
        <View style={styles.parties}>
          <View>
            <Text style={styles.partyLabel}>ÉMETTEUR :</Text>
            {showCompanyLine && (
              <Text style={[styles.partyLine, styles.partyBold]}>{emitter.companyName}</Text>
            )}
            <Text style={styles.partyLine}>{emitter.name}</Text>
            {emitter.email ? <Text style={styles.partyLine}>{emitter.email}</Text> : null}
            {emitter.phone ? <Text style={styles.partyLine}>{emitter.phone}</Text> : null}
            {emitter.address ? <Text style={styles.partyLine}>{emitter.address}</Text> : null}
            {emitterCityLine ? <Text style={styles.partyLine}>{emitterCityLine}</Text> : null}
            {emitter.siret ? (
              <Text style={styles.partyLine}>
                <Text style={styles.partyBold}>SIRET</Text> : {emitter.siret}
              </Text>
            ) : null}
          </View>
          <View style={styles.recipient}>
            <Text style={styles.partyLabel}>DESTINATAIRE :</Text>
            <Text style={styles.recipientLine}>{client.company ?? client.name}</Text>
            {!!client.company &&
              client.company.trim().toUpperCase() !== client.name.trim().toUpperCase() && (
                <Text style={styles.recipientLine}>{client.name}</Text>
              )}
            {client.address ? <Text style={styles.recipientLine}>{client.address}</Text> : null}
            {clientCityLine ? <Text style={styles.recipientLine}>{clientCityLine}</Text> : null}
            {client.email ? <Text style={styles.recipientLine}>{client.email}</Text> : null}
            {client.siret ? (
              <Text style={styles.recipientLine}>
                <Text style={styles.partyBold}>SIRET</Text> : {client.siret}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Table des prestations */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>DESCRIPTION :</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>QUANTITÉ :</Text>
            <Text style={[styles.tableHeaderText, styles.colUnit]}>PRIX UNITAIRE HT :</Text>
            {!allZeroTax && <Text style={[styles.tableHeaderText, styles.colTax]}>TVA :</Text>}
            <Text style={[styles.tableHeaderText, styles.colTotal]}>TOTAL HT :</Text>
          </View>

          {lines.map((line, i) => {
            const rich = [
              ...parseRichText(line.description, "heading"),
              ...parseRichText(line.detail, "bullet"),
            ]
            // Ligne purement informative (tout à zéro) : on n'affiche pas les
            // « 0 » — comme sur les factures Canva où seule la première ligne
            // porte les montants.
            const isInfoLine = line.quantity === 0 && line.unitPrice === 0 && line.total === 0
            let headingSeen = false
            return (
              <View key={i} style={styles.tableRow} wrap={false}>
                <View style={styles.colDesc}>
                  {rich.map((rl, j) => {
                    if (rl.kind === "heading") {
                      const followUp = headingSeen
                      headingSeen = true
                      return (
                        <Text
                          key={j}
                          style={[styles.lineHeading, ...(followUp ? [styles.lineHeadingFollow] : [])]}
                        >
                          {rl.text}
                        </Text>
                      )
                    }
                    headingSeen = true
                    return (
                      <View key={j} style={styles.bulletRow}>
                        <Text style={styles.bulletGlyph}>•</Text>
                        <Text style={styles.bulletText}>{rl.text}</Text>
                      </View>
                    )
                  })}
                </View>
                <Text style={[styles.cellValue, styles.colQty]}>
                  {isInfoLine ? "" : fmtQty(line.quantity)}
                </Text>
                <Text style={[styles.cellValue, styles.colUnit]}>
                  {isInfoLine ? "" : fmtMoney(line.unitPrice)}
                </Text>
                {!allZeroTax && (
                  <Text style={[styles.cellValue, styles.colTax]}>
                    {isInfoLine ? "" : fmtTaxLabel(line.taxRate)}
                  </Text>
                )}
                <Text style={[styles.cellValue, styles.cellValueBold, styles.colTotal]}>
                  {isInfoLine ? "" : fmtMoney(line.total)}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Totaux */}
        <View style={styles.totalsBlock} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL HT :</Text>
            <Text style={styles.totalValue}>{fmtMoney(totalHT)}</Text>
          </View>

          {allZeroTax ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA :</Text>
              <Text style={styles.totalValue}>{fmtMoney(0)}</Text>
            </View>
          ) : (
            Object.entries(byRate)
              .filter(([, v]) => v > 0)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([rate, amount]) => (
                <View key={rate} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TVA {fmtTaxLabel(Number(rate))} :</Text>
                  <Text style={styles.totalValue}>{fmtMoney(amount)}</Text>
                </View>
              ))
          )}

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 12 }]}>TOTAL TTC :</Text>
            <Text style={[styles.totalValue, { fontSize: 12 }]}>{fmtMoney(totalTTC)}</Text>
          </View>

          {/* Acompte déjà facturé, déduit sur la facture de solde */}
          {isFacture && (depositDeducted ?? 0) > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>ACOMPTE DÉDUIT :</Text>
                <Text style={styles.totalValue}>- {fmtMoney(depositDeducted!)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { fontSize: 12 }]}>NET À PAYER :</Text>
                <Text style={[styles.totalValue, { fontSize: 12 }]}>
                  {fmtMoney(net + totalTVA)}
                </Text>
              </View>
            </>
          )}

          {allZeroTax && (
            <Text style={styles.totalNote}>TVA non applicable (Art. 293B du CGI)</Text>
          )}

          {!isFacture && expiresAt && (
            <Text style={styles.totalMeta}>
              DATE DE VALIDITÉ DU DEVIS : {fmtDateShort(expiresAt)}
            </Text>
          )}
          {isFacture && dueDate && (
            <Text style={styles.totalMeta}>ÉCHÉANCE : {fmtDateShort(dueDate)}</Text>
          )}
        </View>

        {/* Pied : règlement + termes & conditions / bon pour accord */}
        <View style={styles.footerColumns} wrap={false}>
          <View style={styles.footerColLeft}>
            <Text style={styles.footerHeading}>RÈGLEMENT :</Text>
            {!isFacture && (depositPercent ?? 0) > 0 && (
              <Text style={styles.paymentLine}>
                Acompte de {fmtQty(depositPercent!)}% à la commande, solde à la livraison.
              </Text>
            )}
            {emitter.iban ? (
              <>
                <Text style={[styles.paymentLine, styles.paymentBold]}>
                  Par virement bancaire :
                </Text>
                {emitter.bankName ? (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentBold}>Banque</Text> : {emitter.bankName}
                  </Text>
                ) : null}
                {emitter.siret ? (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentBold}>SIRET</Text> : {emitter.siret}
                  </Text>
                ) : null}
                <Text style={styles.paymentLine}>
                  <Text style={styles.paymentBold}>IBAN</Text> : {emitter.iban}
                </Text>
                {emitter.bic ? (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentBold}>BIC</Text> : {emitter.bic}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={styles.footerColRight}>
            {isFacture ? (
              generalConditions ? (
                <>
                  <Text style={styles.footerHeading}>TERMES & CONDITIONS</Text>
                  <Text style={styles.conditionsText}>{generalConditions}</Text>
                </>
              ) : null
            ) : (
              <>
                <Text style={styles.footerHeading}>BON POUR ACCORD</Text>
                <Text style={styles.paymentLine}>À retourner daté et signé :</Text>
                <View style={styles.signatureBox} />
              </>
            )}
          </View>
        </View>

        {/* Conditions du devis, en pleine largeur sous le bon pour accord */}
        {!isFacture && generalConditions && (
          <View style={{ marginTop: 18 }} wrap={false}>
            <Text style={styles.footerHeading}>TERMES & CONDITIONS</Text>
            <Text style={styles.conditionsText}>{generalConditions}</Text>
          </View>
        )}

        {/* Bas de page (répété sur chaque page) */}
        <Text style={styles.pageFooter} fixed>
          {[
            `${displayName} — ${emitter.name}`,
            [emitter.address, emitterCityLine].filter(Boolean).join(" "),
            emitter.siret ? `SIRET ${emitter.siret}` : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
      </Page>
    </Document>
  )
}
