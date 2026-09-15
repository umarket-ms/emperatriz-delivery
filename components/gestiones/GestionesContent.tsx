import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View as RNView,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Text } from '@/components/Themed';
import { CustomColors } from '@/constants/CustomColors';
import { Ionicons } from '@expo/vector-icons';
import { api, extractDataFromResponse, getApiUrl } from '@/services/api';
import { useToast } from 'react-native-toast-notifications';
import { ProviderCard, type FacturaCXP, type ProveedorRow } from './ProviderCard';
import { SummaryCards } from './SummaryCards';
import { ApiEndpoints } from '@/utils/api-endpoints';
import { useCurrency } from '@/core/hooks/useCurrency';

type FilterValue = 'todas' | 'vencidas' | 'por_vencer' | 'vigentes';

function aggregateByProveedor(data: FacturaCXP[]): ProveedorRow[] {
  const map = new Map<number, ProveedorRow>();

  for (const inv of data) {
    const id = inv.provider?.id;
    if (!id) continue;

    const current = map.get(id) || {
      proveedorId: id,
      provider: inv.provider?.title || 'N/D',
      saldoPendiente: 0,
      documentos: 0,
      bankInfo: `${inv.provider?.bank?.title || 'N/D'} - ${inv.provider?.bankAccountType?.title || 'N/D'} - ${inv.provider?.bank_account_number || 'N/D'}`,
    };

    current.saldoPendiente += Number(inv.outstanding_balance) || 0;
    current.documentos += 1;
    map.set(id, current);
  }

  return Array.from(map.values()).sort((a, b) => b.saldoPendiente - a.saldoPendiente);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function GestionesContent() {
  const toast = useToast();

  const [invoices, setInvoices] = useState<FacturaCXP[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [totalPendiente, setTotalPendiente] = useState(0);
  const [totalVencidas, setTotalVencidas] = useState(0);
  const [totalPorVencer, setTotalPorVencer] = useState(0);
  const [totalVigentes, setTotalVigentes] = useState(0);

  const [allProveedores, setAllProveedores] = useState<ProveedorRow[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>('todas');

  const [expandedProviderId, setExpandedProviderId] = useState<number | null>(null);

  const [creditNoteDialogVisible, setCreditNoteDialogVisible] = useState(false);
  const [selectedProviderForCN, setSelectedProviderForCN] = useState<ProveedorRow | null>(null);
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteDescription, setCreditNoteDescription] = useState('');

  const [payAllDialogVisible, setPayAllDialogVisible] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const result = await api.get<FacturaCXP[]>(getApiUrl(ApiEndpoints.CxpInvoices));
      const data = extractDataFromResponse<FacturaCXP[]>(result) || [];
      setInvoices(data);
      computeStats(data);
      computeAllProveedores(data);
    } catch (err) {
      console.log('Error loading invoices:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  const computeStats = (data: FacturaCXP[]) => {
    const today = new Date();
    let vencidas = 0;
    let porVencer = 0;
    let vigentes = 0;
    let total = 0;

    for (const inv of data) {
      const balance = Number(inv.outstanding_balance) || 0;
      total += balance;
      const dueDate = new Date(inv.due_date);

      if (inv.invoice_status === 'overdue' || (inv.invoice_status === 'pending' && dueDate < today)) {
        vencidas += balance;
      } else if (inv.invoice_status === 'pending') {
        const days = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        days <= 15 ? (porVencer += balance) : (vigentes += balance);
      }
    }

    setTotalPendiente(total);
    setTotalVencidas(vencidas);
    setTotalPorVencer(porVencer);
    setTotalVigentes(vigentes);
  };

  const computeAllProveedores = (data: FacturaCXP[]) => {
    setAllProveedores(aggregateByProveedor(data));
  };

  const getProviderInvoices = (providerId: number): FacturaCXP[] => {
    return invoices
      .filter(inv => inv.provider?.id === providerId)
      .sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime());
  };

  const toggleExpand = (providerId: number) => {
    setExpandedProviderId(prev => (prev === providerId ? null : providerId));
  };

  const payDebt = async (providerData: ProveedorRow) => {
    const pendingInvoices = invoices.filter(
      inv => inv.provider?.id === providerData.proveedorId && inv.invoice_status === 'pending'
    );

    if (pendingInvoices.length === 0) {
      toast.show(`El proveedor ${providerData.provider} no tiene facturas pendientes`, { type: 'info', duration: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      if (pendingInvoices.length === 1) {
        const invoiceId = pendingInvoices[0].id;
        const result = await api.patch(getApiUrl(ApiEndpoints.CxpInvoicesPay, { id: String(invoiceId) }), {});
        if (!result.error) {
          toast.show(`Se ha pagado la factura del proveedor ${providerData.provider}`, { type: 'success', duration: 3000 });
        }
      } else {
        const invoiceIds = pendingInvoices.map(inv => inv.id);
        const result = await api.post(getApiUrl(ApiEndpoints.CxpInvoicesBulkPay), invoiceIds);
        if (!result.error) {
          toast.show(`Se han pagado ${invoiceIds.length} facturas de ${providerData.provider}`, { type: 'success', duration: 3000 });
        }
      }
      loadInvoices();
    } catch (err) {
      toast.show('Error al pagar la deuda', { type: 'danger', duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  };

  const showPayAllDialog = () => setPayAllDialogVisible(true);

  const executePayAllDebts = async () => {
    const pendingIds = invoices.reduce<number[]>((acc, inv) => {
      if (inv.invoice_status === 'pending') acc.push(inv.id);
      return acc;
    }, []);

    if (pendingIds.length === 0) {
      toast.show('No hay facturas pendientes para pagar', { type: 'info', duration: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.post(getApiUrl(ApiEndpoints.CxpInvoicesBulkPay), pendingIds);
      if (!result.error) {
        toast.show(`Se han pagado ${pendingIds.length} facturas`, { type: 'success', duration: 3000 });
        loadInvoices();
      }
    } catch (err) {
      toast.show('Error al pagar las deudas', { type: 'danger', duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmPayAll = () => {
    setPayAllDialogVisible(false);
    executePayAllDebts();
  };

  const openCreditNoteDialog = (providerData: ProveedorRow) => {
    setSelectedProviderForCN(providerData);
    setCreditNoteAmount('');
    setCreditNoteDescription('');
    setCreditNoteDialogVisible(true);
  };

  const hideCreditNoteDialog = () => {
    setCreditNoteDialogVisible(false);
    setSelectedProviderForCN(null);
    setCreditNoteAmount('');
    setCreditNoteDescription('');
  };

  const submitCreditNote = async () => {
    if (!selectedProviderForCN || !creditNoteAmount || Number(creditNoteAmount) <= 0) {
      toast.show('Por favor ingrese un monto válido', { type: 'warning', duration: 3000 });
      return;
    }

    const pendingInvoice = invoices.find(
      inv => inv.provider?.id === selectedProviderForCN.proveedorId && inv.invoice_status === 'pending'
    );

    if (!pendingInvoice) {
      toast.show(`No se encontró una factura pendiente para ${selectedProviderForCN.provider}`, { type: 'warning', duration: 3000 });
      hideCreditNoteDialog();
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.post(getApiUrl(ApiEndpoints.CxpCreditNotesForInvoice, { invoiceId: String(pendingInvoice.id) }), {
        amount: Number(creditNoteAmount),
        description: creditNoteDescription || `Nota de crédito para proveedor ${selectedProviderForCN.provider}`,
      });
      if (!result.error) {
        toast.show(`Nota de crédito creada por ${Number(creditNoteAmount).toFixed(2)} para ${selectedProviderForCN.provider}`, { type: 'success', duration: 3000 });
        hideCreditNoteDialog();
        loadInvoices();
      }
    } catch (err) {
      toast.show('Error al crear nota de crédito', { type: 'danger', duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  };

  const getPendingCount = () => invoices.filter(inv => inv.invoice_status === 'pending').length;

  if (loading) {
    return (
      <RNView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={CustomColors.secondary} />
      </RNView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CustomColors.secondary} />}
      >
        <SummaryCards
          totalPendiente={totalPendiente}
          totalVencidas={totalVencidas}
          totalPorVencer={totalPorVencer}
          totalVigentes={totalVigentes}
        />

        {/* Pay All Button */}
        <RNView style={styles.actionBar}>
          <Pressable
            style={[styles.payAllButton, isSaving && { opacity: 0.6 }]}
            onPress={showPayAllDialog}
            disabled={isSaving}
          >
            <Ionicons name="cash-outline" size={18} color={CustomColors.textLight} style={{ marginRight: 6 }} />
            <Text style={styles.payAllButtonText}>Pagar deudas</Text>
          </Pressable>
        </RNView>

        {/* Providers Section */}
        <Text style={styles.sectionTitle}>Todos los proveedores por pagar</Text>

        {allProveedores.length === 0 ? (
          <RNView style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={CustomColors.neutralLight} />
            <Text style={styles.emptyText}>No hay facturas pendientes</Text>
          </RNView>
        ) : (
          allProveedores.map((row) => (
            <ProviderCard
              key={row.proveedorId}
              row={row}
              isExpanded={expandedProviderId === row.proveedorId}
              invoices={getProviderInvoices(row.proveedorId)}
              onToggle={() => toggleExpand(row.proveedorId)}
              onPay={payDebt}
              onCreditNote={openCreditNoteDialog}
              isSaving={isSaving}
            />
          ))
        )}

        <RNView style={{ height: 40 }} />
      </ScrollView>

      <CreditNoteDialog
        visible={creditNoteDialogVisible}
        provider={selectedProviderForCN}
        amount={creditNoteAmount}
        description={creditNoteDescription}
        onAmountChange={setCreditNoteAmount}
        onDescChange={setCreditNoteDescription}
        onSubmit={submitCreditNote}
        onClose={hideCreditNoteDialog}
        isSaving={isSaving}
      />

      <PayAllConfirmDialog
        visible={payAllDialogVisible}
        pendingCount={getPendingCount()}
        totalPendiente={totalPendiente}
        onConfirm={confirmPayAll}
        onClose={() => setPayAllDialogVisible(false)}
        isSaving={isSaving}
      />
    </>
  );
}

interface CreditNoteDialogProps {
  visible: boolean;
  provider: ProveedorRow | null;
  amount: string;
  description: string;
  onAmountChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSaving: boolean;
}

function CreditNoteDialog({ visible, provider, amount, description, onAmountChange, onDescChange, onSubmit, onClose, isSaving }: CreditNoteDialogProps) {
  const { formatPrice } = useCurrency();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <RNView style={styles.modalOverlay}>
        <RNView style={styles.modalContent}>
          <Text style={styles.modalTitle}>Crear Nota de Crédito</Text>
          {provider && (
            <RNView style={styles.modalProviderInfo}>
              <Text style={styles.modalProviderName}>{provider.provider}</Text>
              <Text style={styles.modalProviderBalance}>Saldo pendiente: {formatPrice(provider.saldoPendiente)}</Text>
            </RNView>
          )}
          <Text style={styles.inputLabel}>Monto *</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={CustomColors.neutralLight} value={amount} onChangeText={onAmountChange} />
          <Text style={styles.inputLabel}>Descripción</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Ingrese una descripción (opcional)" placeholderTextColor={CustomColors.neutralLight} value={description} onChangeText={onDescChange} multiline maxLength={500} />
          <RNView style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.modalConfirmBtn, (!amount || Number(amount) <= 0) && { opacity: 0.5 }]} onPress={onSubmit} disabled={!amount || Number(amount) <= 0 || isSaving}>
              {isSaving ? <ActivityIndicator size="small" color={CustomColors.textLight} /> : <Text style={styles.modalConfirmText}>Crear Nota de Crédito</Text>}
            </Pressable>
          </RNView>
        </RNView>
      </RNView>
    </Modal>
  );
}

interface PayAllConfirmDialogProps {
  visible: boolean;
  pendingCount: number;
  totalPendiente: number;
  onConfirm: () => void;
  onClose: () => void;
  isSaving: boolean;
}

function PayAllConfirmDialog({ visible, pendingCount, totalPendiente, onConfirm, onClose, isSaving }: PayAllConfirmDialogProps) {
  const { formatPrice } = useCurrency();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <RNView style={styles.modalOverlay}>
        <RNView style={styles.modalContent}>
          <RNView style={styles.warningIconContainer}>
            <Ionicons name="warning-outline" size={40} color={CustomColors.warning} />
          </RNView>
          <Text style={styles.modalTitle}>¿Está seguro de que desea pagar todas las deudas?</Text>
          <Text style={styles.modalDescription}>
            Esta acción marcará como pagadas todas las facturas pendientes de todos los proveedores. Esta operación no se puede deshacer.
          </Text>
          <RNView style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              <Text style={{ fontWeight: 'bold' }}>Facturas pendientes:</Text> {pendingCount}{'\n'}
              <Text style={{ fontWeight: 'bold' }}>Total a pagar:</Text> {formatPrice(totalPendiente)}
            </Text>
          </RNView>
          <RNView style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.modalConfirmBtnDanger} onPress={onConfirm} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color={CustomColors.textLight} /> : <Text style={styles.modalConfirmText}>Sí, pagar todas las deudas</Text>}
            </Pressable>
          </RNView>
        </RNView>
      </RNView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  scrollContent: {
    padding: 16,
  },
  actionBar: {
    marginBottom: 16,
  },
  payAllButton: {
    backgroundColor: CustomColors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
  },
  payAllButtonText: {
    color: CustomColors.textLight,
    fontWeight: 'bold',
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: CustomColors.backgroundDark,
    borderWidth: 1,
    borderColor: CustomColors.divider,
  },
  filterPillActive: {
    backgroundColor: CustomColors.primary,
    borderColor: CustomColors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: CustomColors.neutralLight,
  },
  filterPillTextActive: {
    color: CustomColors.textLight,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CustomColors.textLight,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: CustomColors.backgroundMedium,
    borderRadius: 12,
  },
  emptyText: {
    color: CustomColors.neutralLight,
    fontSize: 14,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: CustomColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: CustomColors.backgroundMedium,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CustomColors.textLight,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 13,
    color: CustomColors.neutralLight,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalProviderInfo: {
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalProviderName: {
    fontSize: 15,
    fontWeight: '700',
    color: CustomColors.textLight,
    textTransform: 'capitalize',
  },
  modalProviderBalance: {
    fontSize: 12,
    color: CustomColors.neutralLight,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CustomColors.neutralLight,
    marginBottom: 6,
  },
  input: {
    backgroundColor: CustomColors.inputBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: CustomColors.textLight,
    borderWidth: 1,
    borderColor: CustomColors.divider,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CustomColors.divider,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: CustomColors.neutralLight,
  },
  modalConfirmBtn: {
    backgroundColor: CustomColors.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmBtnDanger: {
    backgroundColor: CustomColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: CustomColors.textLight,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryBox: {
    backgroundColor: `${CustomColors.warning}15`,
    borderWidth: 1,
    borderColor: `${CustomColors.warning}40`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 13,
    color: CustomColors.warning,
    lineHeight: 20,
  },
});

export default GestionesContent;
