import * as TaskManager from "expo-task-manager";
import {
  COURIER_BACKGROUND_LOCATION_TASK,
  courierLocationTracking,
} from "./courierLocationService";

/**
 * Tarea de ubicación en background (expo-location + expo-task-manager).
 *
 * Se encarga de recibir las actualizaciones de ubicación mientras la app está
 * en segundo plano (p. ej. cuando el conductor navega con Waze u otra app de
 * mapas) y de enrutarlas al mismo pipeline de courierLocationService:
 *
 *   onBackgroundLocation() -> handleLocationUpdate() -> sendLocationToBackend()
 *
 * De este modo se reaprovechan el throttling (15s / 10m) y el evento
 * `courier.location.update` sin tocar el protocolo del backend.
 *
 * IMPORTANTE: TaskManager.defineTask debe ejecutarse en el scope de nivel
 * superior del módulo. Por eso este archivo se importa desde app/_layout.tsx,
 * para que la task quede registrada siempre que el JS se cargue (incluyendo
 * los arranques en background por el foreground service de Android).
 */
TaskManager.defineTask(
  COURIER_BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error(
        "[BackgroundLocationTask] Error recibido:",
        error.message,
        error,
      );
      return;
    }

    const locations = (data as { locations?: any[] } | undefined)?.locations;
    if (!locations || locations.length === 0) {
      return;
    }

    for (const location of locations) {
      if (!location?.coords) {
        continue;
      }
      courierLocationTracking.onBackgroundLocation(location);
    }
  },
);
