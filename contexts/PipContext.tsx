import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Dimensions } from 'react-native';
import {
  enterPipMode,
  isPipAvailable,
  isPipSupportedAsync,
  setPipAutoEnterEnabled,
  useIsInPipMode,
} from '@/modules/expo-pip-local/src';

type PipContextValue = {
  /** true si la app está dentro de la ventana flotante (PiP). */
  isInPipMode: boolean;
  /** true si la plataforma/soporte permite PiP (solo Android con dev build). */
  isPipAvailable: boolean;
  /** Entra manualmente a la ventana flotante (usa PIP_ASPECT_RATIO). */
  minimizeToPip: () => Promise<void>;
  /**
   * Activa/desactiva la entrada automática a PiP al pulsar Home.
   * Debe llamarse solo cuando hay un viaje activo.
   */
  setAutoEnterEnabled: (enabled: boolean) => void;
};

const PipContext = createContext<PipContextValue | undefined>(undefined);

/**
 * Proveedor global del estado de Picture-in-Picture.
 *
 * Se monta en app/_layout.tsx para que tanto la pantalla del viaje como la
 * barra de pestañas puedan reaccionar (layout compacto, ocultar tab bar).
 */
export function PipProvider({ children }: { children: React.ReactNode }) {
  const isInPipMode = useIsInPipMode();
  const [pipSupported, setPipSupported] = useState(false);
  const [autoEnterRequested, setAutoEnterRequested] = useState(false);

  useEffect(() => {
    if (!isPipAvailable()) return;

    let mounted = true;
    isPipSupportedAsync()
      .then((supported) => {
        if (mounted) setPipSupported(supported);
      })
      .catch(() => {
        if (mounted) setPipSupported(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Propaga el flag al módulo nativo cada vez que cambia. El módulo es un no-op
  // en plataformas sin soporte.
  useEffect(() => {
    setPipAutoEnterEnabled(autoEnterRequested);
  }, [autoEnterRequested]);

  // Log de calibración de tamaño (solo al entrar a PiP): reporta la altura real
  // de la ventana en dp. Se consulta tras un delay porque la transición de
  // tamaño de la ventana aún no ha terminado al recibir el evento. El objetivo
  // es ≥3x la altura de la ventana original 16:9 (108dp en el dispositivo de
  // prueba Xiaomi → 324dp; se fija 360dp): si no cuadra, el número a ajustar
  // es PIP_MIN_HEIGHT_DP en modules/expo-pip-local/plugin/withPictureInPicture.js.
  useEffect(() => {
    if (!isInPipMode) return;
    const timer = setTimeout(() => {
      const { width, height } = Dimensions.get('window');
      console.log(
        `[ExpoPip] ventana PiP: ${Math.round(width)}x${Math.round(height)}dp` +
          ` (objetivo ~360dp de alto = 3.3x de 108dp)`
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [isInPipMode]);

  const setAutoEnterEnabled = useCallback((enabled: boolean) => {
    setAutoEnterRequested((prev) => (prev === enabled ? prev : enabled));
  }, []);

  const minimizeToPip = useCallback(async () => {
    // Sin argumentos: usa PIP_ASPECT_RATIO (100:230 vertical) del módulo.
    await enterPipMode();
  }, []);

  const value = useMemo<PipContextValue>(
    () => ({
      isInPipMode,
      isPipAvailable: pipSupported,
      minimizeToPip,
      setAutoEnterEnabled,
    }),
    [isInPipMode, pipSupported, minimizeToPip, setAutoEnterEnabled]
  );

  return <PipContext.Provider value={value}>{children}</PipContext.Provider>;
}

/**
 * @throws si se usa fuera de PipProvider.
 */
export function usePip(): PipContextValue {
  const context = useContext(PipContext);
  if (!context) {
    throw new Error('usePip debe usarse dentro de <PipProvider>');
  }
  return context;
}
