import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"


const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  emitterBlock: {
    flex: 1,
  },
  emitterName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  recipientBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
    marginBottom: 4,
  },
  docNumber: {
    fontSize: 11,
    color: "#64748b",
  },
  divider: {
    borderBottom: 1,
    borderColor: "#e2e8f0",
    marginVertical: 16,
  },
  metaRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 24,
  },
  metaBlock: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    padding: "8 10",
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: "7 10",
    borderBottom: 1,
    borderColor: "#f1f5f9",
  },
  col5: { flex: 5 },
  col1h: { flex: 1.5, textAlign: "right" },
  col2: { flex: 2, textAlign: "right" },
  col1: { flex: 1, textAlign: "center" },
  headerText: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  totalSection: {
    alignItems: "flex-end",
    marginTop: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 220,
    paddingVertical: 3,
  },
  totalLabel: {
    color: "#64748b",
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
  },
  totalNet: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
  },
  tvaNote: {
    fontSize: 8,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "right",
  },
  conditions: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  conditionsLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  notes: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    color: "#92400e",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
  },
})

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
    iban?: string | null
    bic?: string | null
  }
  client: { name: string; company?: string | null; email?: string | null; address?: string | null }
  lines: Line[]
  notes?: string | null
  generalConditions?: string | null
  totalHT: number
}

function fmtDate(d: Date | null | undefined) {
  return d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—"
}

function fmtMoney(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtTaxLabel(rate: number) {
  return rate === 0 ? "0%" : `${String(rate).replace(".", ",")}%`
}

export function InvoicePDF({
  type,
  number,
  createdAt,
  expiresAt,
  dueDate,
  depositPercent,
  depositDeducted,
  emitter,
  client,
  lines,
  notes,
  generalConditions,
  totalHT,
}: DocProps) {
  const displayName = emitter.companyName || emitter.name

  // Compute TVA breakdown
  const byRate: Record<number, number> = {}
  for (const l of lines) {
    byRate[l.taxRate] = (byRate[l.taxRate] ?? 0) + l.total * (l.taxRate / 100)
  }
  const totalTVA = Object.values(byRate).reduce((s, v) => s + v, 0)
  const totalTTC = totalHT + totalTVA
  const allZeroTax = totalTVA === 0

  const netAmount = totalHT - (depositDeducted ?? 0)
  const isFacture = type === "FACTURE"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.emitterBlock}>
            <Text style={styles.emitterName}>{displayName}</Text>
            {emitter.companyName && (
              <Text style={{ color: "#64748b", fontSize: 9 }}>{emitter.name}</Text>
            )}
            <Text style={{ color: "#64748b", fontSize: 9 }}>{emitter.email}</Text>
            {emitter.phone && <Text style={{ color: "#64748b", fontSize: 9 }}>{emitter.phone}</Text>}
            {emitter.address && (
              <Text style={{ color: "#64748b", fontSize: 9 }}>
                {emitter.address}
                {emitter.postalCode || emitter.city
                  ? `, ${emitter.postalCode ?? ""} ${emitter.city ?? ""}`.trim()
                  : ""}
              </Text>
            )}
            {emitter.siret && (
              <Text style={{ color: "#94a3b8", fontSize: 8 }}>SIRET : {emitter.siret}</Text>
            )}
          </View>
          <View style={styles.recipientBlock}>
            <Text style={styles.docTitle}>{type}</Text>
            <Text style={styles.docNumber}>{number}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{client.company ?? client.name}</Text>
            {client.company && <Text style={{ fontSize: 9, color: "#64748b" }}>{client.name}</Text>}
            {client.email && <Text style={{ fontSize: 9, color: "#64748b" }}>{client.email}</Text>}
            {client.address && <Text style={{ fontSize: 9, color: "#64748b" }}>{client.address}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date d'émission</Text>
            <Text style={styles.metaValue}>{fmtDate(createdAt)}</Text>
          </View>
          {expiresAt && !isFacture && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Valable jusqu'au</Text>
              <Text style={styles.metaValue}>{fmtDate(expiresAt)}</Text>
            </View>
          )}
          {dueDate && isFacture && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Échéance</Text>
              <Text style={styles.metaValue}>{fmtDate(dueDate)}</Text>
            </View>
          )}
          {depositPercent && depositPercent > 0 && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Acompte</Text>
              <Text style={styles.metaValue}>{depositPercent}%</Text>
            </View>
          )}
        </View>

        {/* Tableau */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.col5]}>Prestation</Text>
          <Text style={[styles.headerText, styles.col1h]}>Qté</Text>
          <Text style={[styles.headerText, styles.col2]}>Prix unit. HT</Text>
          <Text style={[styles.headerText, styles.col1]}>TVA</Text>
          <Text style={[styles.headerText, styles.col2]}>Total HT</Text>
        </View>

        {lines.map((line, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={styles.col5}>
              <Text>{line.description}</Text>
              {line.detail ? (
                <Text style={{ fontSize: 8, color: "#64748b", marginTop: 2 }}>{line.detail}</Text>
              ) : null}
            </View>
            <Text style={[styles.col1h, { color: "#64748b" }]}>{line.quantity}</Text>
            <Text style={[styles.col2, { color: "#64748b" }]}>{fmtMoney(line.unitPrice)}</Text>
            <Text style={[styles.col1, { color: "#64748b" }]}>{fmtTaxLabel(line.taxRate)}</Text>
            <Text style={[styles.col2, { fontFamily: "Helvetica-Bold" }]}>{fmtMoney(line.total)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmtMoney(totalHT)}</Text>
          </View>

          {allZeroTax ? (
            <Text style={styles.tvaNote}>TVA non applicable — art. 293B du CGI</Text>
          ) : (
            <>
              {Object.entries(byRate)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rate, amount]) => (
                  <View key={rate} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TVA {fmtTaxLabel(Number(rate))}</Text>
                    <Text style={styles.totalLabel}>{fmtMoney(amount)}</Text>
                  </View>
                ))}
              <View style={[styles.totalRow, { borderTop: 1, borderColor: "#e2e8f0", paddingTop: 6, marginTop: 2 }]}>
                <Text style={{ ...styles.totalLabel, fontFamily: "Helvetica-Bold" }}>
                  {isFacture && (depositDeducted ?? 0) > 0 ? "Total TTC" : "Total TTC"}
                </Text>
                <Text style={styles.totalNet}>{fmtMoney(totalTTC)}</Text>
              </View>
            </>
          )}

          {/* Acompte déduit (factures) */}
          {isFacture && (depositDeducted ?? 0) > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Acompte déduit</Text>
                <Text style={styles.totalLabel}>- {fmtMoney(depositDeducted!)}</Text>
              </View>
              <View style={[styles.totalRow, { borderTop: 1, borderColor: "#e2e8f0", paddingTop: 6, marginTop: 2 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Net à payer</Text>
                <Text style={styles.totalNet}>{fmtMoney(netAmount + totalTVA)}</Text>
              </View>
            </>
          )}
        </View>

        {/* IBAN */}
        {emitter.iban && isFacture && (
          <View style={{ marginTop: 16, padding: 10, backgroundColor: "#f8fafc", borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
              Coordonnées bancaires
            </Text>
            <Text style={{ fontSize: 9 }}>IBAN : {emitter.iban}</Text>
            {emitter.bic && <Text style={{ fontSize: 9 }}>BIC : {emitter.bic}</Text>}
          </View>
        )}

        {/* Conditions générales */}
        {generalConditions && (
          <View style={styles.conditions}>
            <Text style={styles.conditionsLabel}>Conditions générales</Text>
            <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.4 }}>{generalConditions}</Text>
          </View>
        )}

        {/* Notes internes → non affichées dans le PDF (uniquement conditions générales) */}

        {/* Footer */}
        <Text style={styles.footer}>
          {displayName} · {emitter.email}
          {emitter.siret ? ` · SIRET ${emitter.siret}` : ""}
          {" · Auto-entrepreneur"}
        </Text>
      </Page>
    </Document>
  )
}
