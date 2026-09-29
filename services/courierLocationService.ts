import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";
import { socketService } from "./websocketService";

/**
 * Interface para la ubicación del mensajero
 */
interface CourierLocation {
  courierId: number;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

/**
 * Configuración del servicio de ubicación
 */
interface LocationTrackingConfig {
  /**
   * Intervalo mínimo entre actualizaciones en milisegundos
   * Por defecto: 15000ms (15 segundos)
   */
  updateInterval: number;

  /**
   * Distancia mínima de movimiento en metros para enviar actualización
   * Por defecto: 10 metros
   */
  minDistance: number;

  /**
   * Si debe iniciar automáticamente al conectarse el WebSocket
   * Por defecto: true
   */
  autoStart: boolean;
}

// Configuración estándar de tracking: 15 segundos y 10 metros de distancia mínima
const DEFAULT_CONFIG: LocationTrackingConfig = {
  updateInterval: 15000, // 15 segundos
  minDistance: 10, // 10 metros
  autoStart: true,
};

/**
 * Servicio para gestionar el tracking de ubicación del mensajero
 * Obtiene la ubicación GPS y la envía al backend vía WebSocket
 *
 * Características:
 * - Throttling para evitar consumo excesivo de batería
 * - Solo envía si el WebSocket está conectado
 * - Maneja permisos de ubicación
 * - Control de frecuencia de envío
 */
class CourierLocationTrackingService {
  private isTracking: boolean = false;
  private lastSentLocation: Location.LocationObject | null = null;
  private lastSentTime: number = 0;
  private config: LocationTrackingConfig = DEFAULT_CONFIG;
  private locationSubscription: Location.LocationSubscription | null = null;
  private appStateSubscription: { remove(): void } | null = null;
  private lastBackgroundTime: number = 0;
  private fallbackTimerId: ReturnType<typeof setInterval> | null = null;
  private lastGpsCallbackAt: number = 0;
  private permissionCheckTimerId: ReturnType<typeof setInterval> | null = null;
  private userId: number | null = null;
  private isFetchingLocation: boolean = false;
  private manualLocationOverride: { lat: number; lng: number; accuracy: number } | null = null;

  /**
   * Inicializa el servicio con la configuración
   */
  initialize(config?: Partial<LocationTrackingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // console.log('[LocationTracking] Inicializado con config:', this.config);

    // Registrar listeners para respuestas del backend
    socketService.on("courier.location.ack", (data: any) => {
      // console.log('[LocationTracking] ✅ ACK recibido del backend:', data);
    });

    socketService.on("courier.location.error", (error: any) => {
      // console.error('[LocationTracking] ❌ Error recibido del backend:', error);
    });

    // Escuchar solicitudes de refresco de ubicación del backend (para asignación automática)
    socketService.on("courier.location.refresh", async (_payload: any) => {
      console.log(
        "[LocationTracking] 🔄 Solicitud de refresco de ubicación recibida del backend",
      );
      // Enviar última ubicación conocida inmediatamente
      if (this.lastSentLocation && this.userId) {
        const cachedPayload: CourierLocation = {
          courierId: this.userId,
          lat: this.lastSentLocation.coords.latitude,
          lng: this.lastSentLocation.coords.longitude,
          accuracy: this.lastSentLocation.coords.accuracy || 0,
          timestamp: new Date(this.lastSentLocation.timestamp).toISOString(),
          speed: this.lastSentLocation.coords.speed ?? undefined,
          heading: this.lastSentLocation.coords.heading ?? undefined,
        };
        socketService.emit("courier.location.update", cachedPayload);
      }
      // Luego intentar fresh GPS
      const location = await this.getCurrentLocation();
      if (location) {
        this.sendLocationToBackend(location);
      }
    });
  }

  /**
   * Establece el ID del usuario/mensajero
   */
  setUserId(userId: number) {
    this.userId = userId;
    // console.log('[LocationTracking] User ID establecido:', userId);
  }

  /**
   * Solicita permisos de ubicación
   * @returns true si los permisos fueron otorgados, false en caso contrario
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // console.log('[LocationTracking] Solicitando permisos de ubicación...');

      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== "granted") {
        // console.warn('[LocationTracking] Permisos de ubicación denegados');
        return false;
      }

      // console.log('[LocationTracking] Permisos de ubicación otorgados');
      return true;
    } catch (error: any) {
      // console.error('[LocationTracking] Error al solicitar permisos:', error);
      return false;
    }
  }

  /**
   * Verifica si los permisos de ubicación están otorgados
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === "granted";
    } catch (error: any) {
      // console.error('[LocationTracking] Error al verificar permisos:', error);
      return false;
    }
  }

  /**
   * Inicia el tracking de ubicación
   */
  async startTracking(): Promise<boolean> {
    try {
      // console.log('[LocationTracking] startTracking() llamado');

      if (this.isTracking) {
        // console.log('[LocationTracking] Ya está en tracking');
        return true;
      }

      if (!this.userId) {
        // console.warn('[LocationTracking] ❌ No se puede iniciar tracking sin userId');
        return false;
      }
      // console.log('[LocationTracking] ✅ userId configurado:', this.userId);

      // Verificar permisos
      const hasPermissions = await this.hasPermissions();
      // console.log('[LocationTracking] hasPermissions:', hasPermissions);

      if (!hasPermissions) {
        // console.log('[LocationTracking] Solicitando permisos...');
        const granted = await this.requestPermissions();
        if (!granted) {
          // console.warn('[LocationTracking] ❌ No se puede iniciar sin permisos');
          return false;
        }
        // console.log('[LocationTracking] ✅ Permisos otorgados');
      }

      // Verificar que el WebSocket esté conectado
      const isSocketConnected = socketService.isConnected();
      // console.log('[LocationTracking] WebSocket conectado:', isSocketConnected);

      if (!isSocketConnected) {
        // console.warn('[LocationTracking] ❌ WebSocket no conectado, no se inicia tracking');
        return false;
      }

      // console.log('[LocationTracking] Iniciando tracking de ubicación...');
      // console.log('[LocationTracking] Config:', {
      //   timeInterval: this.config.updateInterval,
      //   distanceInterval: this.config.minDistance,
      //   accuracy: 'Balanced'
      // });

      // Iniciar tracking de ubicación
      // Limpiar suscripción anterior si existe (prevenir leak por race condition)
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: this.config.updateInterval,
          distanceInterval: this.config.minDistance,
        },
        (location) => {
          console.log('[LocationTracking] 📍 GPS callback fired');
          this.lastGpsCallbackAt = Date.now();
          // Deduplicación: reiniciar fallback timer si el GPS se disparó
          if (this.fallbackTimerId !== null) {
            this.stopFallbackTimer();
            this.startFallbackTimer();
          }
          this.handleLocationUpdate(location);
        },
      );

      // Fallback timer: si el GPS no dispara en 20s, fetch manual
      this.startFallbackTimer();

      this.isTracking = true;
      // console.log('[LocationTracking] ✅ Tracking iniciado correctamente');

      // Registrar listener de AppState para manejar foreground/background
      if (!this.appStateSubscription) {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      }

      // Verificar permisos periódicamente
      this.startPermissionCheck();

      return true;
    } catch (error: any) {
      // console.error('[LocationTracking] ❌ Error al iniciar tracking:', error);
      this.isTracking = false;
      return false;
    }
  }

  /**
   * Detiene el tracking de ubicación
   */
  async stopTracking(): Promise<void> {
    try {
      if (!this.isTracking) {
        return;
      }

      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      this.stopFallbackTimer();
      this.stopPermissionCheck();

      this.isTracking = false;
      this.lastSentLocation = null;
      this.lastSentTime = 0;
    } catch (error: any) {
      // console.error('[LocationTracking] Error al detener tracking:', error);
    }
  }

  /**
   * Reinicia el tracking de ubicación (limpiar + re-crear suscripción GPS)
   */
  async restartTracking(): Promise<boolean> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.isTracking = false;
    await new Promise((r) => setTimeout(r, 500));
    return this.startTracking();
  }

  /**
   * Maneja cambios de estado de la app (foreground/background)
   */
  private handleAppStateChange = async (state: AppStateStatus) => {
    if (state === "active") {
      // Reanudar fallback timer si estaba pausado
      if (this.isTracking && this.fallbackTimerId === null) {
        this.startFallbackTimer();
      }
      const timeInBackground = Date.now() - this.lastBackgroundTime;
      if (this.isTracking && timeInBackground > 30000) {
        console.log(
          "[LocationTracking] App volvió a foreground, reiniciando tracking",
        );
        await this.restartTracking();
      }
    } else if (state === "background") {
      this.lastBackgroundTime = Date.now();
      // Pausar fallback timer en background
      this.stopFallbackTimer();
    }
  };

  /**
   * Inicia timer de fallback para enviar ubicación periódicamente
   * incluso si watchPositionAsync no dispara callbacks
   */
  private startFallbackTimer(): void {
    this.stopFallbackTimer();
    this.fallbackTimerId = setInterval(async () => {
      if (!this.isTracking || !socketService.isConnected()) return;
      const now = Date.now();
      const timeSinceLastSent = now - this.lastSentTime;
      if (timeSinceLastSent >= this.config.updateInterval) {
        console.log('[LocationTracking] ⏰ Fallback timer disparado, enviando ubicación');
        const location = await this.getCurrentLocation();
        if (location) {
          this.sendLocationToBackend(location);
        }
      }
    }, this.config.updateInterval);
  }

  private stopFallbackTimer(): void {
    if (this.fallbackTimerId !== null) {
      clearInterval(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }
  }

  /**
   * Verifica periódicamente si los permisos de ubicación siguen otorgados
   */
  private startPermissionCheck(): void {
    this.stopPermissionCheck();
    this.permissionCheckTimerId = setInterval(async () => {
      if (!this.isTracking) return;
      const hasPermissions = await this.hasPermissions();
      if (!hasPermissions) {
        console.warn('[LocationTracking] ⚠️ Permisos de ubicación revocados, intentando re-solicitar');
        const regranted = await this.requestPermissions();
        if (!regranted) {
          console.error('[LocationTracking] ❌ Permisos denegados definitivamente, deteniendo tracking');
          this.stopTracking();
        }
      }
    }, 60000);
  }

  private stopPermissionCheck(): void {
    if (this.permissionCheckTimerId !== null) {
      clearInterval(this.permissionCheckTimerId);
      this.permissionCheckTimerId = null;
    }
  }

  /**
   * Maneja las actualizaciones de ubicación
   */
  private handleLocationUpdate(location: Location.LocationObject) {
    try {
      // console.log('[LocationTracking] 🔄 handleLocationUpdate() llamado');
      // console.log('[LocationTracking] Coordenadas:', {
      //   lat: location.coords.latitude.toFixed(6),
      //   lng: location.coords.longitude.toFixed(6),
      //   accuracy: location.coords.accuracy?.toFixed(1)
      // });

      // Verificar que el WebSocket esté conectado
      if (!socketService.isConnected()) {
        // console.log('[LocationTracking] ⚠️ WebSocket desconectado, no se envía ubicación');
        return;
      }

      const now = Date.now();
      const timeSinceLastSent = now - this.lastSentTime;

      // console.log('[LocationTracking] Verificando condiciones de envío:', {
      //   timeSinceLastSent: `${(timeSinceLastSent / 1000).toFixed(1)}s`,
      //   updateInterval: `${(this.config.updateInterval / 1000).toFixed(1)}s`,
      //   minDistance: `${this.config.minDistance}m`
      // });

      let distance = 0;
      if (this.lastSentLocation) {
        distance = this.calculateDistance(
          this.lastSentLocation.coords.latitude,
          this.lastSentLocation.coords.longitude,
          location.coords.latitude,
          location.coords.longitude,
        );

        // console.log('[LocationTracking] Verificando distancia:', {
        //   distance: `${distance.toFixed(1)}m`,
        //   minDistance: `${this.config.minDistance}m`
        // });
      }

      const shouldSendByDistance =
        !this.lastSentLocation || distance >= this.config.minDistance;
      const shouldSendByTime = timeSinceLastSent >= this.config.updateInterval;

      if (!shouldSendByDistance && !shouldSendByTime) {
        // console.log('[LocationTracking] ⏭️ No cumple distancia ni tiempo de envío, omitiendo');
        return;
      }

      // Enviar ubicación al backend
      // console.log('[LocationTracking] ✅ Pasó throttling, enviando al backend...');
      this.sendLocationToBackend(location);
    } catch (error: any) {
      // console.error('[LocationTracking] ❌ Error al manejar actualización de ubicación:', error);
    }
  }

  /**
   * Envía la ubicación al backend vía WebSocket.
   * Si hay una ubicación manual configurada (setManualLocation), siempre se
   * envía esa en lugar de la del dispositivo.
   */
  private sendLocationToBackend(location: Location.LocationObject) {
    try {
      // console.log('[LocationTracking] 📤 sendLocationToBackend() llamado');

      if (!this.userId) {
        // console.warn('[LocationTracking] ❌ No se puede enviar ubicación sin userId');
        return;
      }

      const override = this.manualLocationOverride;

      const payload: CourierLocation = override
        ? {
            courierId: this.userId,
            lat: override.lat,
            lng: override.lng,
            accuracy: override.accuracy,
            timestamp: new Date().toISOString(),
            speed: 0,
            heading: 0,
          }
        : {
            courierId: this.userId,
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            timestamp: new Date(location.timestamp).toISOString(),
            speed: location.coords.speed ?? undefined,
            heading: location.coords.heading ?? undefined,
          };

      console.log("[LocationTracking] Payload preparado:", payload);
      console.log(
        "[LocationTracking] Emitiendo evento courier.location.update...",
      );

      const sent = socketService.emit("courier.location.update", payload);

      if (sent) {
        console.log(
          // `[LocationTracking] ✅ Ubicación enviada exitosamente: (${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)}) ` +
          `accuracy: ${payload.accuracy.toFixed(1)}m`,
        );
        this.lastSentLocation = override
          ? this.buildFakeLocationObject(override)
          : location;
        this.lastSentTime = Date.now();
      } else {
        // console.warn('[LocationTracking] ⚠️ No se pudo enviar ubicación (emit retornó false)');
      }
    } catch (error: any) {
      // console.error('[LocationTracking] ❌ Error al enviar ubicación:', error);
    }
  }

  /**
   * Establece una ubicación manual que se usará como ubicación del mensajero
   * en CADA envío al backend (GPS, fallback, refresh). Envía la ubicación
   * inmediatamente. Útil para simular ubicaciones sin mover el dispositivo (solo dev).
   * No afecta getCurrentLocation() ni la optimización de rutas.
   */
  setManualLocation(lat: number, lng: number, accuracy: number = 0): boolean {
    try {
      if (!this.userId) {
        console.warn('[LocationTracking] ❌ No se puede establecer ubicación manual sin userId');
        return false;
      }

      this.manualLocationOverride = { lat, lng, accuracy };

      if (!socketService.isConnected()) {
        console.log('[LocationTracking] 📍 Ubicación manual establecida (pendiente de socket):', { lat, lng });
        return false;
      }

      console.log(`[LocationTracking] 📍 Ubicación manual establecida: (${lat}, ${lng})`);
      const location = this.buildFakeLocationObject(this.manualLocationOverride);
      this.sendLocationToBackend(location);
      return true;
    } catch (error: any) {
      console.error('[LocationTracking] ❌ Error al establecer ubicación manual:', error);
      return false;
    }
  }

  /**
   * Elimina la ubicación manual y vuelve a enviar la ubicación GPS real
   */
  clearManualLocation(): void {
    this.manualLocationOverride = null;
    console.log('[LocationTracking] 📍 Ubicación manual eliminada, volviendo a GPS real');
  }

  /**
   * Indica si hay una ubicación manual configurada
   */
  getManualLocation(): { lat: number; lng: number; accuracy: number } | null {
    return this.manualLocationOverride;
  }

  /**
   * Construye un objeto Location.LocationObject con las coordenadas dadas
   */
  private buildFakeLocationObject(override: { lat: number; lng: number; accuracy: number }): Location.LocationObject {
    return {
      coords: {
        latitude: override.lat,
        longitude: override.lng,
        accuracy: override.accuracy,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    } as Location.LocationObject;
  }

  /**
   * Calcula la distancia entre dos coordenadas en metros (fórmula de Haversine)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Obtiene el estado actual del tracking
   */
  getTrackingStatus(): {
    isTracking: boolean;
    lastSentLocation: Location.LocationObject | null;
    lastSentTime: number;
    hasUserId: boolean;
    manualLocation: { lat: number; lng: number; accuracy: number } | null;
  } {
    return {
      isTracking: this.isTracking,
      lastSentLocation: this.lastSentLocation,
      lastSentTime: this.lastSentTime,
      hasUserId: this.userId !== null,
      manualLocation: this.manualLocationOverride,
    };
  }

  /**
   * Obtiene la ubicación actual sin iniciar tracking continuo.
   * Incluye: guarda contra superposición, solicitud de permisos,
   * fallback a última posición conocida, y reintento simple.
   */
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    // Guarda contra superposición de llamadas simultáneas
    if (this.isFetchingLocation) {
      console.warn('[LocationTracking] ⏳ Ya hay una solicitud de ubicación en curso, ignorando');
      return this.lastSentLocation;
    }

    this.isFetchingLocation = true;
    try {
      // Solicitar permisos si no están otorgados (en vez de solo verificar)
      let hasPermissions = await this.hasPermissions();
      if (!hasPermissions) {
        console.log('[LocationTracking] Permisos no otorgados, solicitando...');
        const granted = await this.requestPermissions();
        if (!granted) {
          console.warn('[LocationTracking] ❌ Permisos de ubicación denegados');
          return null;
        }
      }

      const GPS_TIMEOUT_MS = 20_000;
      const MAX_RETRIES = 1;

      // Intentar obtener ubicaciónGPS con timeout y reintento
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          console.log(`[LocationTracking] Reintento #${attempt} de obtención GPS...`);
          await new Promise(r => setTimeout(r, 2000));
        }

        try {
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn('[LocationTracking] ⏰ getCurrentPositionAsync timeout');
              resolve(null);
            }, GPS_TIMEOUT_MS),
          );

          const location = await Promise.race([locationPromise, timeoutPromise]);
          if (location) {
            return location;
          }
        } catch (gpsError: any) {
          console.warn('[LocationTracking] Error en getCurrentPositionAsync:', gpsError?.message || gpsError);
        }
      }

      // Fallback: usar última posición conocida si existe y es reciente (<60s)
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && lastKnown.coords) {
          const age = Date.now() - lastKnown.timestamp;
          if (age < 60_000) {
            console.log(`[LocationTracking] Usando última posición conocida (edad: ${(age / 1000).toFixed(1)}s)`);
            return lastKnown;
          }
          console.log(`[LocationTracking] Última posición conocida muy antigua (${(age / 1000).toFixed(0)}s), descartando`);
        }
      } catch (fallbackError: any) {
        console.warn('[LocationTracking] Error al obtener última posición conocida:', fallbackError?.message || fallbackError);
      }

      console.warn('[LocationTracking] ❌ No se pudo obtener ubicación tras todos los intentos');
      return null;
    } catch (error: any) {
      console.error('[LocationTracking] Error al obtener ubicación actual:', error);
      return null;
    } finally {
      this.isFetchingLocation = false;
    }
  }
}

// Crear instancia del servicio
export const courierLocationTracking = new CourierLocationTrackingService();

// Inicializar con configuración por defecto
courierLocationTracking.initialize();
