import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Themed';
import React from 'react';
import { CustomColors } from '@/constants/CustomColors';
import { AssignmentType } from '@/utils/enum';
import { DeliveryItemAdapter } from '@/interfaces/delivery/deliveryAdapters';

interface HistorialItemProps {
  item: DeliveryItemAdapter;
}

function formatDate(dateString: Date | string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const HistorialItem: React.FC<HistorialItemProps> = ({ item }) => {
  return (
    <View
      style={[
        styles.itemContainer,
        item.type === AssignmentType.PICKUP ? styles.pickupContainer : styles.deliveryContainer,
      ]}
    >
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <View style={styles.infoColumn}>
            <View style={styles.metaRow}>
              <Text style={styles.clientText}>
                {item.client}
              </Text>
              <View
                style={[
                  styles.typeIndicator,
                  item.type === AssignmentType.PICKUP ? styles.pickupIndicator : styles.deliveryIndicator,
                ]}
              >
                <Text
                  style={[
                    styles.typeText,
                    item.type === AssignmentType.PICKUP
                      ? styles.pickupTypeText
                      : styles.deliveryTypeText,
                  ]}
                >
                  {item.type === AssignmentType.PICKUP ? 'Recogida' : 'Entrega'}
                </Text>
              </View>
            </View>

            <Text style={styles.addressText}>
              {item.deliveryAddress}
            </Text>

            {item.completedAt && (
              <Text style={styles.completedText}>
                Completado: {formatDate(item.completedAt)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 2,
    marginBottom: 6,
    backgroundColor: CustomColors.backgroundDark,
    boxShadow: '0px 3px 5px rgba(0,0,0,0.12)',
  },
  pickupContainer: {
    backgroundColor: CustomColors.cardBackground,
    borderLeftWidth: 4,
    borderLeftColor: CustomColors.textLight,
  },
  deliveryContainer: {
    backgroundColor: CustomColors.backgroundDark,
    borderLeftWidth: 4,
    borderLeftColor: CustomColors.secondary,
  },
  contentContainer: {
    flex: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoColumn: {
    flex: 1,
    gap: 6,
  },
  clientText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CustomColors.textLight,
  },
  addressText: {
    color: CustomColors.textLight,
    fontSize: 14,
    opacity: 0.78,
  },
  completedText: {
    color: CustomColors.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  typeIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  pickupIndicator: {
    backgroundColor: CustomColors.textLight,
  },
  deliveryIndicator: {
    backgroundColor: CustomColors.secondary,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickupTypeText: {
    color: CustomColors.textDark,
  },
  deliveryTypeText: {
    color: CustomColors.textLight,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
});
