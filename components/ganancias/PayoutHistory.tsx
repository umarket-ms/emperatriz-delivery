import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CustomColors } from '@/constants/CustomColors';
import { PaidInvoice } from '@/core/actions/ganancias-actions';
import { useCurrency } from '@/core/hooks/useCurrency';

const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PayoutCard = ({ item, index }: { item: PaidInvoice; index: number }) => {
    const { formatPrice } = useCurrency();
    const slideAnim = useSharedValue(30);
    const opacityAnim = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacityAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    useEffect(() => {
        slideAnim.value = withDelay(120 * index, withTiming(0, { duration: 500 }));
        opacityAnim.value = withDelay(120 * index, withTiming(1, { duration: 500 }));
    }, []);

    return (
        <Animated.View style={[styles.cardWrapper, animatedStyle]}>
            <View style={styles.card}>
                <View style={styles.accentBar} />
                <View style={styles.cardLeft}>
                    <Text style={styles.weekLabel}>{item.invoiceNumber}</Text>
                    <Text style={styles.amount}>{formatPrice(item.totalAmount)}</Text>
                    <Text style={styles.dateText}>{formatDate(item.issueDate)}</Text>
                </View>
                <View style={styles.cardRight}>
                    <View style={styles.statusBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={CustomColors.success} />
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

interface PayoutHistoryProps {
    items?: PaidInvoice[];
    isLoading?: boolean;
}

const EMPTY_ITEMS: PaidInvoice[] = [];

const PayoutHistory = ({ items = EMPTY_ITEMS, isLoading = false }: PayoutHistoryProps) => {
    const { formatPrice } = useCurrency();
    const fadeAnim = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
    }));

    useEffect(() => {
        fadeAnim.value = withTiming(1, { duration: 600 });
    }, []);

    const totalPaid = items.reduce((sum, i) => sum + i.totalAmount, 0);
    const avgPaid = items.length > 0 ? totalPaid / items.length : 0;

    return (
        <Animated.View style={animatedStyle}>
            {/* Summary card */}
            <View style={styles.summaryWrapper}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>TOTAL PAGADO ({items.length} FACTURAS)</Text>
                    <Text style={styles.summaryAmount}>
                        {isLoading ? '—' : formatPrice(totalPaid)}
                    </Text>
                    <View style={styles.summaryRow}>
                        <Ionicons name="trending-up" size={14} color={CustomColors.success} />
                        <Text style={styles.summarySubtext}>
                            {items.length} pago{items.length !== 1 ? 's' : ''} procesado{items.length !== 1 ? 's' : ''}
                            {items.length > 0 ? ` · Promedio ${formatPrice(avgPaid)}` : ''}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Historial de pagos</Text>
                <Text style={styles.sectionSubtitle}>Facturas pagadas</Text>
            </View>

            {/* Payout list */}
            {isLoading ? (
                <ActivityIndicator color={CustomColors.primary} style={{ marginVertical: 16 }} />
            ) : items.length === 0 ? (
                <Text style={styles.emptyText}>Sin pagos registrados</Text>
            ) : (
                <View style={styles.list}>
                    {items.map((item, index) => (
                        <PayoutCard key={item.id} item={item} index={index} />
                    ))}
                </View>
            )}
        </Animated.View>
    );
};

export default PayoutHistory;

const styles = StyleSheet.create({
    summaryWrapper: {
        marginHorizontal: 2,
        marginBottom: 24,
        borderRadius: 20,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
    },
    summaryCard: {
        borderRadius: 20,
        padding: 24,
        backgroundColor: CustomColors.backgroundDark,
        borderWidth: 1,
        borderColor: CustomColors.divider,
        borderLeftWidth: 4,
        borderLeftColor: CustomColors.success,
    },
    summaryLabel: {
        fontSize: 10,
        color: CustomColors.textLight,
        opacity: 0.5,
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    summaryAmount: {
        fontSize: 36,
        fontWeight: '800',
        color: CustomColors.textLight,
        letterSpacing: -1,
        marginBottom: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    summarySubtext: {
        fontSize: 12,
        color: CustomColors.textLight,
        opacity: 0.6,
    },
    sectionHeader: {
        marginHorizontal: 20,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: CustomColors.textLight,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: CustomColors.textLight,
        opacity: 0.5,
    },
    list: {
        gap: 12,
        paddingHorizontal: 20,
    },
    cardWrapper: {
        borderRadius: 16,
        boxShadow: '0px 2px 8px rgba(0,0,0,0.06)',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: CustomColors.backgroundDark,
        borderWidth: 1,
        borderColor: CustomColors.divider,
    },
    accentBar: {
        width: 4,
        alignSelf: 'stretch',
        backgroundColor: CustomColors.primary,
    },
    cardLeft: {
        flex: 1,
        padding: 16,
    },
    weekLabel: {
        fontSize: 11,
        color: CustomColors.textLight,
        opacity: 0.5,
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    amount: {
        fontSize: 20,
        fontWeight: '800',
        color: CustomColors.textLight,
        marginBottom: 4,
    },
    dateText: {
        fontSize: 12,
        color: CustomColors.textLight,
        opacity: 0.5,
    },
    cardRight: {
        paddingHorizontal: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: `${CustomColors.success}1F`,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${CustomColors.success}40`,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: CustomColors.success,
    },
    emptyText: {
        fontSize: 13,
        color: CustomColors.textLight,
        opacity: 0.4,
        textAlign: 'center',
        paddingVertical: 16,
        marginHorizontal: 20,
    },
});
