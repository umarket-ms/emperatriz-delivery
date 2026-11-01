import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Evento emitido por el módulo nativo cuando la app entra o sale de PiP.
 */
export type PipModeChangedEvent = {
  isInPipMode: boolean;
};

type ExpoPipModule = {
  isAvailable(): Promise<boolean>;
  isInPipMode(): Promise<boolean>;
  setAutoEnterEnabled(enabled: boolean): Promise<void>;
  enterPip(width: number, height: number): Promise<void>;
  addListener(
    eventName: 'onPipModeChanged',
    listener: (event: PipModeChangedEvent) => void
  ): { remove(): void };
};

/**
 * Aspecto (ancho:alto) de la ventana flotante: 2:3 (0.667).
 *
 * Elegido así por tres razones:
 *  1. Android exige que el aspecto esté entre 1:2.39 y 2.39:1; fuera de ese
 *     rango la app CRASHEA (documentado por Google en "PiP setup").
 *  2. La altura real la fija `<layout android:minHeight="360dp">` (vía config
 *     plugin); este aspecto la acompaña dando una ventana 240dp de ancho
 *     (67% del ancho de pantalla — buen mapa visible).
 *  3. Respaldo: si el sistema ignora el <layout>, el suelo mínimo de AOSP
 *     (220dp) / 0.667 ≈ 330dp de alto = aún ≥3x de los 108dp originales.
 *
 * Medido en el dispositivo de prueba (Xiaomi, 720×1650@2.0):
 * ventana original 16:9 = 192×108dp → objetivo 3x = 324dp → se fija 360dp.
 */
export const PIP_ASPECT_RATIO = { width: 2, height: 3 } as const;

/**
 * En iOS/web el módulo no existe: `requireOptionalNativeModule` devuelve null
 * y toda la API se degrada a no-ops, para que el resto del código no necesite
 * guardas por plataforma.
 */
const ExpoPip: ExpoPipModule | null =
  Platform.OS === 'android'
    ? (requireOptionalNativeModule('ExpoPip') as ExpoPipModule | null)
    : null;

/** Indica si el dispositivo y la plataforma soportan PiP. */
export function isPipAvailable(): boolean {
  return ExpoPip != null;
}

/** Comprueba en el lado nativo si PiP está soportado en este dispositivo. */
export async function isPipSupportedAsync(): Promise<boolean> {
  if (!ExpoPip) return false;
  try {
    return await ExpoPip.isAvailable();
  } catch {
    return false;
  }
}

/** Estado actual de la ventana flotante. */
export async function isInPipModeAsync(): Promise<boolean> {
  if (!ExpoPip) return false;
  try {
    return await ExpoPip.isInPipMode();
  } catch {
    return false;
  }
}

/**
 * Activa o desactiva la entrada automática a PiP al pulsar Home.
 * Solo debe activarse cuando hay un viaje activo (sino la app se minimizaría
 * siempre a ventanita, incluso en el login).
 */
export async function setPipAutoEnterEnabled(enabled: boolean): Promise<void> {
  if (!ExpoPip) return;
  try {
    await ExpoPip.setAutoEnterEnabled(enabled);
  } catch (error) {
    console.warn('[ExpoPip] setAutoEnterEnabled falló:', error);
  }
}

/**
 * Entra manualmente a la ventana flotante.
 * @param width  Ancho del aspecto (por defecto 100 → vertical, ver PIP_ASPECT_RATIO)
 * @param height Alto del aspecto (por defecto 230)
 */
export async function enterPipMode(
  width: number = PIP_ASPECT_RATIO.width,
  height: number = PIP_ASPECT_RATIO.height
): Promise<void> {
  if (!ExpoPip) return;
  try {
    await ExpoPip.enterPip(width, height);
  } catch (error) {
    console.warn('[ExpoPip] enterPip falló:', error);
  }
}

/** Se suscribe a los cambios de modo PiP y devuelve el estado actual. */
export function useIsInPipMode(): boolean {
  const [isInPipMode, setIsInPipMode] = useState(false);

  useEffect(() => {
    if (!ExpoPip) {
      console.log('[ExpoPip] módulo nativo no disponible (iOS/web o sin rebuild)');
      return;
    }

    // Estado inicial (el evento de OnStartObserving también lo manda, pero
    // cubrimos el caso en que el listener tarde en registrar).
    let mounted = true;
    isInPipModeAsync()
      .then((initial) => {
        console.log(`[ExpoPip] estado inicial isInPipMode=${initial}`);
        if (mounted) setIsInPipMode(initial);
      })
      .catch(() => {});

    const subscription = ExpoPip.addListener('onPipModeChanged', (event) => {
      const next = !!event?.isInPipMode;
      console.log(`[ExpoPip] evento recibido: isInPipMode=${next}`);
      if (mounted) setIsInPipMode(next);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return isInPipMode;
}
