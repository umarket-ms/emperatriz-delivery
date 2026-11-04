import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../tripMapStyles";
import { CustomColors } from "@/constants/CustomColors";

interface SimulationControlsProps {
  isManualSimulation: boolean;
  onToggle: () => void;
}

const SimulationControls: React.FC<SimulationControlsProps> = React.memo(
  ({ isManualSimulation, onToggle }) => {
    return (
      <Pressable
        style={[
          styles.fabMenuItem,
          isManualSimulation && styles.simulationButtonActive,
        ]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={
          isManualSimulation ? "Pausar simulación de ruta" : "Iniciar simulación de ruta"
        }
      >
        <Ionicons
          name={isManualSimulation ? "pause" : "play"}
          size={22}
          color={CustomColors.textDark}
        />
      </Pressable>
    );
  },
);

SimulationControls.displayName = "SimulationControls";
export default SimulationControls;
