import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Text,
  Platform,
  AppState,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CustomColors } from "@/constants/CustomColors";
import { courierLocationTracking } from "@/services/courierLocationService";

const SHOWN_FLAG_KEY = "bg_location_permission_prompt_shown_at";
// No volver a martillear al usuario al menos cada 90 días
const REPROMPT_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export interface BackgroundLocationPermissionModalProps {
  /** Dispara el chequeo/mostrado del modal (p. ej. tras autenticarse) */
  trigger: boolean;
}

/**
 * Modal de consentimiento informado para el permiso de ubicación en background
 * ("Permitir todo el tiempo").
 *
 * En Android 11+ la llamada a requestBackgroundPermissionsAsync() abre la
 * pantalla de ajustes del sistema directamente (no hay diálogo), así que este
 * modal explica al conductor POR QUÉ se necesita el permiso antes de saltar a
 * ajustes: para que su ubicación se siga registrando aunque navegue con Waze
 * u otra app de mapas en primer plano.
 *
 * Si el usuario acepta, se llama a courierLocationTracking.requestBackgroundPermissions().
 * Si pulsa "Ahora no", se continúa con tracking solo en foreground (degradado).
 */
export default function BackgroundLocationPermissionModal({
  trigger,
}: BackgroundLocationPermissionModalProps) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const shouldOfferPrompt = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      return false;
    }
    try {
      // Si ya tiene el permiso, no hay nada que preguntar
      const alreadyGranted =
        await courierLocationTracking.hasBackgroundPermissions();
      if (alreadyGranted) {
        return false;
      }

      const shownAt = await AsyncStorage.getItem(SHOWN_FLAG_KEY);
      if (shownAt) {
        const elapsed = Date.now() - parseInt(shownAt, 10);
        if (elapsed < REPROMPT_COOLDOWN_MS) {
          return false;
        }
      }
      return true;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    (async () => {
      const offer = await shouldOfferPrompt();
      if (!cancelled && offer) {
        setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trigger, shouldOfferPrompt]);

  // Si el usuario vuelve de ajustes con el permiso otorgado, arrancar las
  // background updates ya (handleAppStateChange del servicio también lo hace,
  // pero aquí aseguramos el feedback inmediato).
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      (async () => {
        const granted = await courierLocationTracking.hasBackgroundPermissions();
        if (granted) {
          setVisible(false);
        }
      })();
    });
    return () => sub.remove();
  }, [visible]);

  const markShown = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SHOWN_FLAG_KEY, Date.now().toString());
    } catch {
      // best-effort
    }
  }, []);

  const handleAccept = useCallback(async () => {
    setRequesting(true);
    await markShown();
    try {
      await courierLocationTracking.requestBackgroundPermissions();
    } finally {
      setRequesting(false);
      // Cerramos el modal: en Android 11+ quedamos en ajustes del sistema y,
      // al volver, el AppState listener/verificación del servicio se encarga.
      setVisible(false);
    }
  }, [markShown]);

  const handleDismiss = useCallback(async () => {
    await markShown();
    setVisible(false);
  }, [markShown]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.icon}>📍</Text>
          <Text style={styles.title}>Mantén tu ubicación activa</Text>

          <Text style={styles.body}>
            Para que tu posición se registre mientras entregas, aun cuando
            navegues con <Text style={styles.bold}>Waze</Text> u otra app de
            mapas en primer plano, necesitamos permiso para acceder a tu
            ubicación en segundo plano.
          </Text>

          <Text style={styles.body}>
            Android mostrará una notificación persistente mientras la app esté
            rastreando tu ubicación.
          </Text>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              En el siguiente paso, Android abrirá la pantalla de ajustes.
              Selecciona{" "}
              <Text style={styles.bold}>“Permitir todo el tiempo”</Text>.
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={handleDismiss}
              disabled={requesting}
            >
              <Text style={styles.secondaryButtonText}>Ahora no</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={handleAccept}
              disabled={requesting}
            >
              <Text style={styles.primaryButtonText}>
                {requesting ? "Abriendo…" : "Configurar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: CustomColors.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  container: {
    width: "100%",
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: CustomColors.border,
  },
  icon: {
    fontSize: 40,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    color: CustomColors.white,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    color: CustomColors.neutralLight,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  bold: {
    color: CustomColors.white,
    fontWeight: "700",
  },
  noteBox: {
    backgroundColor: CustomColors.backgroundMedium,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noteText: {
    color: CustomColors.white,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: CustomColors.primary,
  },
  primaryButtonText: {
    color: CustomColors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: CustomColors.backgroundMedium,
    borderWidth: 1,
    borderColor: CustomColors.border,
  },
  secondaryButtonText: {
    color: CustomColors.white,
    fontWeight: "600",
    fontSize: 15,
  },
});
