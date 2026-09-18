import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { Text } from '@/components/Themed';
import { CustomColors } from '@/constants/CustomColors';
import { formatMoney } from '@/utils/currency';

interface SummaryCardsProps {
  totalPendiente: number;
  totalVencidas: number;
  totalPorVencer: number;
  totalVigentes: number;
}

export function SummaryCards({ totalPendiente, totalVencidas, totalPorVencer, totalVigentes }: SummaryCardsProps) {
  return (
    <RNView style={styles.cardsGrid}>
      <RNView style={styles.card}>
        <Text style={styles.cardLabel}>Total por pagar</Text>
        <Text style={styles.cardValue}>{formatMoney(totalPendiente)}</Text>
      </RNView>
      <RNView style={[styles.card, styles.cardOverdue]}>
        <Text style={styles.cardLabel}>Vencidas</Text>
        <Text style={[styles.cardValue, { color: CustomColors.error }]}>{formatMoney(totalVencidas)}</Text>
      </RNView>
      <RNView style={[styles.card, styles.cardDueSoon]}>
        <Text style={styles.cardLabel}>Por vencer</Text>
        <Text style={[styles.cardValue, { color: CustomColors.warning }]}>{formatMoney(totalPorVencer)}</Text>
      </RNView>
      <RNView style={[styles.card, styles.cardCurrent]}>
        <Text style={styles.cardLabel}>Vigentes</Text>
        <Text style={[styles.cardValue, { color: CustomColors.success }]}>{formatMoney(totalVigentes)}</Text>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  card: {
    width: '48%',
    backgroundColor: CustomColors.backgroundMedium,
    borderRadius: 12,
    padding: 14,
    boxShadow: '0px 2px 3px rgba(0,0,0,0.2)',
  },
  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: CustomColors.error,
  },
  cardDueSoon: {
    borderLeftWidth: 3,
    borderLeftColor: CustomColors.warning,
  },
  cardCurrent: {
    borderLeftWidth: 3,
    borderLeftColor: CustomColors.success,
  },
  cardLabel: {
    fontSize: 12,
    color: CustomColors.neutralLight,
    marginBottom: 4,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: CustomColors.textLight,
  },
});

export default SummaryCards;
