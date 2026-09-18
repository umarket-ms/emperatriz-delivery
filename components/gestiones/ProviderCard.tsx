import React from 'react';
import { StyleSheet, Pressable, View as RNView } from 'react-native';
import { Text } from '@/components/Themed';
import { CustomColors } from '@/constants/CustomColors';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '@/utils/currency';

export interface FacturaCXP {
  id: number;
  invoice_number: string;
  provider: {
    id: number;
    title: string;
    bank?: { title: string };
    bankAccountType?: { title: string };
    bank_account_number?: string;
  };
  issue_date: string;
  due_date: string;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
  outstanding_balance: number;
  invoice_status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  concept?: string;
}

export interface ProveedorRow {
  proveedorId: number;
  provider: string;
  saldoPendiente: number;
  documentos: number;
  bankInfo: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ProviderCardProps {
  row: ProveedorRow;
  isExpanded: boolean;
  invoices: FacturaCXP[];
  onToggle: () => void;
  onPay: (provider: ProveedorRow) => void;
  onCreditNote: (provider: ProveedorRow) => void;
  isSaving: boolean;
}

export function ProviderCard({ row, isExpanded, invoices, onToggle, onPay, onCreditNote, isSaving }: ProviderCardProps) {
  return (
    <RNView style={styles.providerCard}>
      <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.providerHeader]} onPress={onToggle}>
        <RNView style={styles.providerInfo}>
          <RNView style={styles.providerNameRow}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={CustomColors.neutralLight}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.providerName}>{row.provider}</Text>
          </RNView>
          <Text style={styles.bankInfo}>{row.bankInfo}</Text>
        </RNView>
        <RNView style={styles.providerMeta}>
          <Text style={styles.providerBalance}>{formatMoney(row.saldoPendiente)}</Text>
          <Text style={styles.providerDocs}>{row.documentos} docs</Text>
        </RNView>
      </Pressable>

      {isExpanded && (
        <RNView style={styles.invoiceSubTable}>
          {invoices.length === 0 ? (
            <Text style={styles.emptySubText}>No hay documentos para este proveedor.</Text>
          ) : (
            invoices.map((inv) => (
              <RNView key={inv.id} style={styles.invoiceRow}>
                <RNView style={styles.invoiceRowHeader}>
                  <Text style={styles.invoiceNumber}>#{inv.invoice_number}</Text>
                  <RNView style={[styles.statusBadge, {
                    backgroundColor: inv.invoice_status === 'paid' ? `${CustomColors.success}20` : inv.invoice_status === 'overdue' ? `${CustomColors.error}20` : `${CustomColors.warning}20`,
                  }]}>
                    <Text style={[styles.statusText, {
                      color: inv.invoice_status === 'paid' ? CustomColors.success : inv.invoice_status === 'overdue' ? CustomColors.error : CustomColors.warning,
                    }]}>
                      {inv.invoice_status === 'pending' ? 'Pendiente' : inv.invoice_status === 'paid' ? 'Pagada' : inv.invoice_status === 'overdue' ? 'Vencida' : 'Cancelada'}
                    </Text>
                  </RNView>
                </RNView>
                <RNView style={styles.invoiceDetails}>
                  <Text style={styles.invoiceDetailText}>Concepto: {inv.concept || '-'}</Text>
                  <Text style={styles.invoiceDetailText}>Emisión: {formatDate(inv.issue_date)}</Text>
                  <Text style={styles.invoiceDetailText}>Vencimiento: {formatDate(inv.due_date)}</Text>
                </RNView>
                <RNView style={styles.invoiceAmounts}>
                  <Text style={styles.invoiceAmountLabel}>Saldo pendiente:</Text>
                  <Text style={styles.invoiceAmountValue}>{formatMoney(inv.outstanding_balance)}</Text>
                  <Text style={styles.invoiceAmountLabel}>Total:</Text>
                  <Text style={styles.invoiceAmountValue}>{formatMoney(inv.total_amount)}</Text>
                </RNView>
              </RNView>
            ))
          )}
        </RNView>
      )}

      <RNView style={styles.providerActions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => onPay(row)}
          disabled={isSaving}
        >
          <Ionicons name="card-outline" size={16} color={CustomColors.success} />
          <Text style={[styles.actionButtonText, { color: CustomColors.success }]}>Pagar</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => onCreditNote(row)}
          disabled={isSaving}
        >
          <Ionicons name="document-text-outline" size={16} color={CustomColors.secondary} />
          <Text style={[styles.actionButtonText, { color: CustomColors.secondary }]}>N. Crédito</Text>
        </Pressable>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  providerCard: {
    backgroundColor: CustomColors.backgroundMedium,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.2)',
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  providerInfo: {
    flex: 1,
    marginRight: 12,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700',
    color: CustomColors.textLight,
    textTransform: 'capitalize',
  },
  bankInfo: {
    fontSize: 11,
    color: CustomColors.neutralLight,
    marginTop: 4,
  },
  providerMeta: {
    alignItems: 'flex-end',
  },
  providerBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: CustomColors.secondary,
  },
  providerDocs: {
    fontSize: 11,
    color: CustomColors.neutralLight,
    marginTop: 2,
  },
  invoiceSubTable: {
    backgroundColor: CustomColors.backgroundDark,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: CustomColors.divider,
  },
  invoiceRow: {
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  invoiceRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: CustomColors.textLight,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  invoiceDetails: {
    marginBottom: 8,
  },
  invoiceDetailText: {
    fontSize: 12,
    color: CustomColors.neutralLight,
    marginBottom: 2,
  },
  invoiceAmounts: {
    borderTopWidth: 1,
    borderTopColor: CustomColors.divider,
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  invoiceAmountLabel: {
    fontSize: 12,
    color: CustomColors.neutralLight,
    width: '45%',
  },
  invoiceAmountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: CustomColors.textLight,
    width: '45%',
    textAlign: 'right',
  },
  emptySubText: {
    color: CustomColors.neutralLight,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  providerActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: CustomColors.divider,
    padding: 10,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: CustomColors.backgroundDark,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ProviderCard;
