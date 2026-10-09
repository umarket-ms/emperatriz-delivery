import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { CustomColors } from "@/constants/CustomColors";
import { ScheduledDeliveryItem } from "../hooks/useScheduledDeliveries";

interface ScheduledDeliveriesPanelProps {
  scheduledDeliveries: ScheduledDeliveryItem[];
}

/**
 * Panel "Programadas del día": entregas con hora pactada con el cliente que
 * aún no se liberan (las reactiva el cron a su hora). No aparecen en el mapa;
 * este panel es el recordatorio con countdown para el repartidor.
 */
const ScheduledDeliveriesPanel: React.FC<ScheduledDeliveriesPanelProps> = ({
  scheduledDeliveries,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  if (scheduledDeliveries.length === 0) return null;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`${scheduledDeliveries.length} entregas programadas. ${expanded ? "Contraer" : "Expandir"}`}
      >
        <Text style={styles.headerTitle}>
          🕐 Programadas ({scheduledDeliveries.length})
        </Text>
        <Text style={styles.headerChevron}>{expanded ? "▾" : "▴"}</Text>
      </Pressable>

      {expanded && (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {scheduledDeliveries.map((item) => (
            <View
              key={item.delivery.id}
              style={[styles.item, item.isDue && styles.itemDue]}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemAddress} numberOfLines={1}>
                  {item.delivery.deliveryAddress || item.delivery.title}
                </Text>
                <View
                  style={[
                    styles.countdownBadge,
                    item.isDue && styles.countdownBadgeDue,
                  ]}
                >
                  <Text
                    style={[
                      styles.countdownText,
                      item.isDue && styles.countdownTextDue,
                    ]}
                  >
                    {item.countdown}
                  </Text>
                </View>
              </View>

              <Text style={styles.itemMeta} numberOfLines={1}>
                {item.delivery.client}
                {item.delivery.phone ? ` · ${item.delivery.phone}` : ""}
              </Text>

              {item.formattedHour && (
                <Text style={styles.itemHour}>
                  Programada: {item.formattedHour}
                </Text>
              )}
            </View>
          ))}

          <Text style={styles.footerHint}>
            Se liberarán automáticamente a su hora y se insertarán en la ruta.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 72,
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0px 2px 4px rgba(0,0,0,0.3)",
    zIndex: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: CustomColors.teal + "33",
    borderLeftWidth: 4,
    borderLeftColor: CustomColors.teal,
  },
  headerTitle: {
    color: CustomColors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
  headerChevron: {
    color: CustomColors.textLight,
    fontSize: 14,
    opacity: 0.8,
  },
  list: {
    maxHeight: 200,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: CustomColors.textLight + "14",
  },
  itemDue: {
    backgroundColor: CustomColors.warning + "22",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemAddress: {
    flex: 1,
    color: CustomColors.textLight,
    fontSize: 13,
    fontWeight: "600",
  },
  countdownBadge: {
    backgroundColor: CustomColors.teal,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countdownBadgeDue: {
    backgroundColor: CustomColors.warning,
  },
  countdownText: {
    color: CustomColors.textLight,
    fontSize: 11,
    fontWeight: "bold",
  },
  countdownTextDue: {
    color: CustomColors.black,
  },
  itemMeta: {
    color: CustomColors.textLight,
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  itemHour: {
    color: CustomColors.teal,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  footerHint: {
    color: CustomColors.textLight,
    fontSize: 11,
    opacity: 0.6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontStyle: "italic",
  },
});

export default ScheduledDeliveriesPanel;
