import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/Themed';
import { FontAwesome } from '@expo/vector-icons';
import { CustomColors } from '@/constants/CustomColors';
import { AssignmentType } from '@/utils/enum';
import {
  AvailableDeliveryItem,
  AvailableShipmentGroup,
} from '@/interfaces/delivery/available';

interface AvailableShipmentGroupCardProps {
  group: AvailableShipmentGroup;
  claiming?: boolean;
  onClaim: (shipmentId: string) => void;
}

function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function JourneyRow({ item }: { item: AvailableDeliveryItem }) {
  const isPickup = item.type === AssignmentType.PICKUP;

  return (
    <View style={styles.journeyRow}>
      <View
        style={[
          styles.typeIndicator,
          isPickup ? styles.pickupIndicator : styles.deliveryIndicator,
        ]}
      >
        <Text
          style={[
            styles.typeText,
            isPickup ? styles.pickupTypeText : styles.deliveryTypeText,
          ]}
        >
          {isPickup ? 'Recogida' : 'Entrega'}
        </Text>
      </View>
      <View style={styles.journeyInfo}>
        <Text style={styles.journeyAddress} numberOfLines={2}>
          {item.deliveryAddress}
        </Text>
        {item.scheduledAt && (
          <Text style={styles.journeyScheduled}>
            Programada: {formatDate(item.scheduledAt)}
          </Text>
        )}
      </View>
    </View>
  );
}

export const AvailableShipmentGroupCard: React.FC<
  AvailableShipmentGroupCardProps
> = ({ group, claiming = false, onClaim }) => {
  const distance = formatDistance(group.distanceMeters);
  const incompatible = !group.vehicleCompatible;
  const tripCount = group.items.length;
  const [first] = group.items;
  const title =
    first?.clientTitle || first?.contact || `Envío ${group.shipmentId}`;

  return (
    <View style={styles.groupContainer}>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.clientText} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.tripCountBadge}>
            <Text style={styles.tripCountText}>
              {tripCount} viaje{tripCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {distance && (
            <View style={styles.metaBadge}>
              <FontAwesome
                name="map-marker"
                size={13}
                color={CustomColors.info}
              />
              <Text style={styles.metaBadgeText}>{distance}</Text>
            </View>
          )}

          <View style={styles.metaBadge}>
            <FontAwesome name="star" size={13} color={CustomColors.warning} />
            <Text style={styles.metaBadgeText}>{group.score}</Text>
          </View>
        </View>

        <View style={styles.journeyList}>
          {group.items.map((item) => (
            <JourneyRow key={item.id} item={item} />
          ))}
        </View>

        {incompatible && (
          <View style={styles.warningRow}>
            <FontAwesome
              name="exclamation-triangle"
              size={13}
              color={CustomColors.warning}
            />
            <Text style={styles.warningText}>
              No recomendada para tu vehículo
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={[
          styles.claimButton,
          claiming && styles.claimButtonDisabled,
          incompatible && styles.claimButtonBlocked,
        ]}
        onPress={() => onClaim(group.shipmentId)}
        disabled={claiming || incompatible}
      >
        {claiming ? (
          <ActivityIndicator size="small" color={CustomColors.textLight} />
        ) : (
          <Text style={styles.claimButtonText}>
            {incompatible
              ? 'No disponible'
              : `Reclamar envío (${tripCount} viaje${tripCount !== 1 ? 's' : ''})`}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 2,
    marginBottom: 12,
    backgroundColor: CustomColors.backgroundDark,
    borderLeftWidth: 4,
    borderLeftColor: CustomColors.secondary,
    boxShadow: '0px 3px 5px rgba(0,0,0,0.12)',
    gap: 12,
  },
  contentContainer: {
    flex: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  clientText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: CustomColors.textLight,
  },
  tripCountBadge: {
    backgroundColor: CustomColors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tripCountText: {
    color: CustomColors.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CustomColors.backgroundDarkest,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  metaBadgeText: {
    color: CustomColors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  journeyList: {
    gap: 8,
    backgroundColor: CustomColors.backgroundDarkest,
    borderRadius: 14,
    padding: 10,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  journeyInfo: {
    flex: 1,
    gap: 2,
  },
  journeyAddress: {
    color: CustomColors.textLight,
    fontSize: 14,
    opacity: 0.85,
  },
  journeyScheduled: {
    color: CustomColors.neutralLight,
    fontSize: 12,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningText: {
    color: CustomColors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  claimButton: {
    backgroundColor: CustomColors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonBlocked: {
    backgroundColor: CustomColors.neutralLight,
  },
  claimButtonText: {
    color: CustomColors.textLight,
    fontSize: 15,
    fontWeight: '700',
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
});
