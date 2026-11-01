import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CustomColors } from "@/constants/CustomColors";
import { courierLocationTracking } from "@/services/courierLocationService";

export interface ManualLocationOption {
  label: string;
  latitude: number;
  longitude: number;
}

export const MANUAL_LOCATIONS: ManualLocationOption[] = [
  { label: "Santo Domingo", latitude: 18.4861, longitude: -69.9312 },
  { label: "Santiago", latitude: 19.4792, longitude: -70.6931 },
];

interface ManualLocationControlsProps {
  sendToMap: (data: object) => void;
}

const ManualLocationControls: React.FC<ManualLocationControlsProps> = React.memo(
  ({ sendToMap }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [activeLocation, setActiveLocation] = useState<
      ManualLocationOption | null
    >(() => {
      const manual = courierLocationTracking.getManualLocation();
      if (!manual) return null;
      return (
        MANUAL_LOCATIONS.find(
          (o) => o.latitude === manual.lat && o.longitude === manual.lng,
        ) ?? null
      );
    });

    const handleSelect = (option: ManualLocationOption) => {
      courierLocationTracking.setManualLocation(
        option.latitude,
        option.longitude,
      );
      setActiveLocation(option);
      console.log(
        `[ManualLocation] ${option.label} activada para todos los envíos`,
      );
      sendToMap({
        type: "SET_VIEW",
        latitude: option.latitude,
        longitude: option.longitude,
        zoom: 15,
      });
      setIsOpen(false);
    };

    const handleClear = () => {
      courierLocationTracking.clearManualLocation();
      setActiveLocation(null);
      console.log("[ManualLocation] Volviendo a GPS real");
      setIsOpen(false);
    };

    const isActive = activeLocation !== null;

    return (
      <View style={styles.container}>
        <Pressable
          style={[styles.button, isActive && styles.buttonActive]}
          onPress={() => setIsOpen((prev) => !prev)}
        >
          <Text style={styles.buttonText}>📍</Text>
        </Pressable>

        {isOpen && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Simular ubicación</Text>
            {MANUAL_LOCATIONS.map((option) => {
              const isSelected =
                activeLocation?.label === option.label;
              return (
                <Pressable
                  key={option.label}
                  style={styles.option}
                  onPress={() => handleSelect(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextActive,
                    ]}
                  >
                    {isSelected ? "● " : "○ "}
                    {option.label}
                  </Text>
                  <Text style={styles.optionCoords}>
                    {option.latitude.toFixed(4)}, {option.longitude.toFixed(4)}
                  </Text>
                </Pressable>
              );
            })}
            {isActive && (
              <Pressable style={styles.option} onPress={handleClear}>
                <Text style={styles.optionClear}>📡 Usar GPS real</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  },
);

ManualLocationControls.displayName = "ManualLocationControls";
export default ManualLocationControls;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 178,
    right: 16,
    alignItems: "flex-end",
    zIndex: 10,
  },
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: CustomColors.textLight,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 2px 4px rgba(17,24,39,0.35)",
  },
  buttonActive: {
    backgroundColor: CustomColors.warning,
  },
  buttonText: {
    fontSize: 20,
    lineHeight: 24,
  },
  panel: {
    marginTop: 8,
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 210,
    boxShadow: "0px 2px 8px rgba(17,24,39,0.5)",
  },
  panelTitle: {
    color: CustomColors.textLight,
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 6,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: CustomColors.divider,
  },
  optionText: {
    color: CustomColors.textLight,
    fontSize: 15,
    fontWeight: "600",
  },
  optionTextActive: {
    color: CustomColors.warning,
  },
  optionCoords: {
    color: CustomColors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  optionClear: {
    color: CustomColors.info,
    fontSize: 14,
    fontWeight: "600",
  },
});