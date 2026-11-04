import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../tripMapStyles";
import { CustomColors } from "@/constants/CustomColors";
import { Coordinate } from "../types";

interface CenterLocationButtonProps {
  currentPosition: Coordinate | null;
  onCenter: () => void;
}

const CenterLocationButton: React.FC<CenterLocationButtonProps> = React.memo(
  ({ currentPosition, onCenter }) => {
    return (
      <Pressable
        style={[
          styles.fabMenuItem,
          !currentPosition && { opacity: 0.4 },
        ]}
        onPress={onCenter}
        accessibilityRole="button"
        accessibilityLabel="Centrar en mi ubicación"
      >
        <Ionicons name="locate" size={22} color={CustomColors.textDark} />
      </Pressable>
    );
  },
);

CenterLocationButton.displayName = "CenterLocationButton";
export default CenterLocationButton;
