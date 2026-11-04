import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CustomColors } from "@/constants/CustomColors";

interface FabMenuProps {
  /**
   * Ítems del menú. Se recibe como función para que cada acción pueda cerrar
   * el menú tras ejecutarse (recibe `close`). Los ítems permanentes se
   * renderizan primero y las opciones después.
   */
  children: (close: () => void) => React.ReactNode;
  accessibilityLabel?: string;
}

/**
 * FAB que reemplaza la columna de botones de la esquina superior derecha del
 * mapa. Colapsado es un solo botón; al tocarlo despliega los controles hacia
 * abajo y al tocarlo de nuevo (o tras ejecutar una acción) los vuelve a ocultar.
 */
const FabMenu: React.FC<FabMenuProps> = ({
  children,
  accessibilityLabel = "Opciones del mapa",
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={styles.fab}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
      >
        <Ionicons
          name={open ? "close" : "ellipsis-vertical"}
          size={22}
          color={CustomColors.white}
        />
      </Pressable>

      {open && (
        <View style={styles.menu} pointerEvents="box-none">
          {children(close)}
        </View>
      )}
    </View>
  );
};

FabMenu.displayName = "FabMenu";
export default FabMenu;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 16,
    right: 16,
    alignItems: "flex-end",
    zIndex: 15,
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: CustomColors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: CustomColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  menu: {
    marginTop: 8,
    gap: 8,
    alignItems: "flex-end",
  },
});
