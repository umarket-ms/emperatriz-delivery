import { fetch } from 'expo/fetch';
import { getApiUrl } from './api';
import { ApiEndpoints } from '../utils/api-endpoints';
import {
  ensureFreshAccessToken,
  isTokenExpired,
  refreshAccessToken,
} from './tokenManager';
import { queueNotification, NotificationType } from './notificationService';
import { IEnterpriseEntity, IUserEntity } from '@/interfaces/auth';
import { IDeliveryAssignmentEntity } from '@/interfaces/delivery/delivery';
import { adaptDeliveriesToAdapter } from '@/interfaces/delivery/deliveryAdapters';
import { SseFrameParser, SseMessage } from './sse-parser';

/** Payload que emite el backend en cada evento de negocio. */
export interface StreamEventPayload<T> {
  data: T;
  userId: IUserEntity['id'];
  enterpriseId: IEnterpriseEntity['id'];
  message: string;
  timestamp: string;
}

/**
 * Eventos de bajada del stream SSE (`GET /api/v1/events?clientType=delivery`).
 *
 * Sustituye a `SocketEventType`: ya no hay `connect`/`disconnect`/
 * `connect_error` (el estado se consulta con `isConnected()` y
 * `onConnectionChange()`) ni `token.expiring_soon` (el refresh lo resuelve
 * `tokenManager` sobre HTTP).
 */
export enum StreamEventType {
  DRIVER_ASSIGNED = 'driver-assigned',
  DELIVERY_UPDATED = 'delivery-updated',
  DELIVERY_STATUS_CHANGED = 'delivery-status-changed',
  DELIVERY_REORDERED = 'delivery-reordered',
  DELIVERY_ASSIGNMENT_UPDATED = 'delivery-assignment-updated',
  DELIVERY_STATUS_UPDATED = 'delivery-status-updated',
  DRIVERS_GROUP_ASSIGNED = 'drivers-group-assigned',
  REQUEST_LOCATION_REFRESH = 'courier.location.refresh',
}

const DEFAULT_RETRY_MS = 3_000;
const MAX_RETRY_MS = 30_000;
/** El backend envía `: ping` cada 30 s; sin nada en 90 s el socket está muerto. */
const STALE_AFTER_MS = 90_000;
const WATCHDOG_INTERVAL_MS = 30_000;

/**
 * Cliente de tiempo real de la app de reparto (SSE en lugar de Socket.IO).
 *
 * Bajada: `GET /api/v1/events` con `Authorization: Bearer` (en móvil no hay
 * restricción de cabeceras como en el navegador) y `Last-Event-ID` para que
 * el servidor reenvíe lo perdido durante un corte.
 *
 * Subida: NO existe — la ubicación viaja por `POST /courier-locations`.
 *
 * Contrato de consumidores idéntico al del antiguo `socketService`: los
 * suscriptores de `on()` reciben la entrega YA adaptada
 * (`adaptDeliveriesToAdapter`), igual que cuando lo reenviaba el handler
 * interno de Socket.IO.
 */
class EventStreamService {
  private running = false;
  private loopId = 0;
  private abortController: AbortController | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  private _connected = false;
  private lastActivityAt = 0;
  private lastEventId: string | undefined;
  private serverRetryMs = DEFAULT_RETRY_MS;
  private attempt = 0;

  /** Suscriptores externos (contexts, hooks, courierLocationService). */
  private readonly consumers: Map<string, Set<Function>> = new Map();
  private readonly connectionListeners: Set<(connected: boolean) => void> =
    new Set();

  /**
   * Manejadores internos por evento: reciben el payload CRUDO del servidor y
   * emiten a los consumidores el resultado ya adaptado. Están en un mapa
   * aparte de `consumers` para que `notifyConsumers()` no los vuelva a
   * invocar (bucle infinito).
   */
  private readonly businessHandlers: Map<string, (payload: any) => void> =
    new Map();

  constructor() {
    this.registerBusinessHandlers();
  }

  get connected(): boolean {
    return this._connected;
  }

  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Arranca el stream. Resuelve `true` si el loop quedó en marcha (aún sin
   * garantizar que conecte) y `false` si no hay token.
   */
  async connect(): Promise<boolean> {
    if (this.running) {
      console.log('[EventStream] Ya en marcha, ignorando connect()');
      return this._connected;
    }

    const token = await ensureFreshAccessToken();
    if (!token) {
      console.log(
        '[EventStream] Sin token disponible. Reintentando en el próximo ciclo.',
      );
      return false;
    }

    this.running = true;
    this.attempt = 0;
    const id = ++this.loopId;

    console.log('[EventStream] Iniciando stream SSE…');
    void this.readLoop(id);
    this.startWatchdog();
    return true;
  }

  disconnect(): void {
    const wasConnected = this._connected;
    this.running = false;
    this.loopId += 1;
    this.stopWatchdog();
    this.abortCurrent();
    this.clearWait();
    // `setConnected(false)` ya notifica a los suscriptores si había cambio:
    // notificar otra vez duplicaría el estado en los listeners.
    this.setConnected(false);
    if (wasConnected) {
      console.log('[EventStream] Desconectado (manual).');
    }
  }

  // ────────────────────────────────────────────
  // SUSCRIPCIONES
  // ────────────────────────────────────────────

  on(event: string, callback: Function) {
    if (!this.consumers.has(event)) {
      this.consumers.set(event, new Set());
    }
    this.consumers.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    this.consumers.get(event)?.delete(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.add(callback);
    callback(this._connected);
  }

  offConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.delete(callback);
  }

  // ────────────────────────────────────────────
  // LOOP DE LECTURA
  // ────────────────────────────────────────────

  private async readLoop(id: number): Promise<void> {
    while (this.running && id === this.loopId) {
      try {
        const token = await ensureFreshAccessToken();
        if (!token) {
          await this.wait(this.currentRetryMs());
          continue;
        }

        await this.openStream(token, id);
      } catch (error: any) {
        if (!this.running || id !== this.loopId) return;
        console.warn(
          `[EventStream] Stream caído: ${error?.message || error}. Reintentando…`,
        );
      } finally {
        this.setConnected(false);
        this.abortController = null;
      }

      if (!this.running || id !== this.loopId) return;
      await this.wait(this.currentRetryMs());
      this.attempt += 1;
    }
  }

  /**
   * Espera cancelable: `disconnect()` la resuelve de inmediato para no dejar
   * un timer vivo (y para que el loop salga sin esperar al backoff).
   */
  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.cancelWait = () => {
        this.cancelWait = null;
        resolve();
      };
      this.waitTimer = setTimeout(() => {
        this.waitTimer = null;
        this.cancelWait = null;
        resolve();
      }, ms);
    });
  }

  private cancelWait: (() => void) | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;

  private clearWait(): void {
    if (this.waitTimer !== null) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    const cancel = this.cancelWait;
    this.cancelWait = null;
    cancel?.();
  }

  private async openStream(token: string, id: number): Promise<void> {
    const url = `${getApiUrl(ApiEndpoints.Events)}?clientType=delivery`;
    const controller = new AbortController();
    this.abortController = controller;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-App': 'delivery',
        Authorization: `Bearer ${token}`,
        ...(this.lastEventId ? { 'Last-Event-ID': this.lastEventId } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      // Un 401 con token "válido" suele ser revocación: refrescar solo si de
      // verdad está por vencer (evita rotar el refresh token en bucle).
      if (
        (response.status === 401 || response.status === 403) &&
        isTokenExpired(token)
      ) {
        console.log('[EventStream] 401 con token caducado, refrescando…');
        await refreshAccessToken();
      }
      throw new Error(`HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('El servidor no devolvió body de stream');
    }
    if (id !== this.loopId) return;

    this.attempt = 0;
    this.setConnected(true);

    const reader = response.body.getReader();
    const parser = new SseFrameParser();

    try {
      while (this.running && id === this.loopId) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        this.lastActivityAt = Date.now();
        for (const message of parser.push(value)) {
          this.handleMessage(message);
        }
      }
    } finally {
      try {
        void reader.cancel().catch(() => undefined);
      } catch {
        // El stream ya estaba cerrado
      }
    }

    if (this.running && id === this.loopId) {
      throw new Error('El servidor cerró el stream');
    }
  }

  private handleMessage(message: SseMessage): void {
    if (message.id) this.lastEventId = message.id;
    if (message.retry) this.serverRetryMs = message.retry;

    let payload: unknown = message.data;
    try {
      payload = JSON.parse(message.data);
    } catch {
      // Evento sin JSON: se entrega crudo.
    }

    const handler = this.businessHandlers.get(message.event);
    if (handler) {
      handler(payload);
    } else {
      this.notifyConsumers(message.event, payload);
    }
  }

  private currentRetryMs(): number {
    const backoff =
      this.serverRetryMs * Math.pow(2, Math.min(this.attempt, 4));
    return Math.min(Math.max(backoff, 1_000), MAX_RETRY_MS);
  }

  // ────────────────────────────────────────────
  // WATCHDOG (equivalente al ping/pong de engine.io)
  // ────────────────────────────────────────────

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      if (!this.running || !this._connected) return;
      if (Date.now() - this.lastActivityAt > STALE_AFTER_MS) {
        console.warn(
          '[EventStream] Sin actividad por encima del umbral, forzando reconexión…',
        );
        // Aborta el fetch: read() rechaza y el loop reintenta solo.
        this.abortCurrent();
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  private stopWatchdog(): void {
    if (this.watchdog !== null) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  private abortCurrent(): void {
    if (!this.abortController) return;
    try {
      this.abortController.abort();
    } catch {
      // ya abortado
    }
    this.abortController = null;
  }

  // ────────────────────────────────────────────
  // ESTADO
  // ────────────────────────────────────────────

  private setConnected(connected: boolean): void {
    if (this._connected === connected) return;
    this._connected = connected;
    if (connected) this.lastActivityAt = Date.now();
    this.notifyConnectionListeners();
  }

  private notifyConnectionListeners() {
    this.connectionListeners.forEach((callback) => {
      try {
        callback(this._connected);
      } catch (error: any) {
        console.log('Error en listener de conexión:', error);
      }
    });
  }

  private notifyConsumers(event: string, data?: any) {
    const listeners = this.consumers.get(event);
    if (!listeners) return;
    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error: any) {
        console.log(`Error en listener de evento ${event}:`, error);
      }
    });
  }

  // ────────────────────────────────────────────
  // EVENTOS DE NEGOCIO (mismas notificaciones que con Socket.IO)
  // ────────────────────────────────────────────

  private registerBusinessHandlers(): void {
    this.businessHandlers.set(
      StreamEventType.DRIVER_ASSIGNED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity>) => {
        queueNotification(
          NotificationType.SUCCESS,
          payload.message,
          `Se te ha asignado la entrega #${payload.data.id}`,
          true,
        );
        this.notifyConsumers(
          StreamEventType.DRIVER_ASSIGNED,
          adaptDeliveriesToAdapter([payload.data])[0],
        );
      },
    );

    this.businessHandlers.set(
      StreamEventType.DRIVERS_GROUP_ASSIGNED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity[]>) => {
        queueNotification(
          NotificationType.SUCCESS,
          payload.message,
          `Se te ha asignado un grupo de entregas`,
          true,
        );
        this.notifyConsumers(
          StreamEventType.DRIVERS_GROUP_ASSIGNED,
          adaptDeliveriesToAdapter(payload.data),
        );
      },
    );

    this.businessHandlers.set(
      StreamEventType.DELIVERY_UPDATED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity>) => {
        queueNotification(
          NotificationType.INFO,
          payload.message,
          `Las entregas ha sido actualizada`,
          true,
        );
        this.notifyConsumers(
          StreamEventType.DELIVERY_UPDATED,
          adaptDeliveriesToAdapter([payload.data])[0],
        );
      },
    );

    this.businessHandlers.set(
      StreamEventType.DELIVERY_REORDERED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity>) => {
        queueNotification(
          NotificationType.INFO,
          'Entrega reordenada',
          payload.message,
          true,
        );
        this.notifyConsumers(
          StreamEventType.DELIVERY_REORDERED,
          adaptDeliveriesToAdapter([payload.data])[0],
        );
      },
    );

    this.businessHandlers.set(
      StreamEventType.DELIVERY_STATUS_CHANGED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity>) => {
        queueNotification(
          NotificationType.INFO,
          payload.message,
          `La entrega #${payload.data.id} ahora está ${payload.data.deliveryStatus.title}`,
          true,
        );
        this.notifyConsumers(
          StreamEventType.DELIVERY_STATUS_CHANGED,
          adaptDeliveriesToAdapter([payload.data])[0],
        );
      },
    );

    this.businessHandlers.set(
      StreamEventType.DELIVERY_STATUS_UPDATED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity>) => {
        this.notifyConsumers(
          StreamEventType.DELIVERY_STATUS_UPDATED,
          adaptDeliveriesToAdapter([payload.data])[0],
        );
      },
    );

    this.businessHandlers.set(
      StreamEventType.DELIVERY_ASSIGNMENT_UPDATED,
      (payload: StreamEventPayload<IDeliveryAssignmentEntity>) => {
        this.notifyConsumers(
          StreamEventType.DELIVERY_ASSIGNMENT_UPDATED,
          adaptDeliveriesToAdapter([payload.data])[0],
        );
      },
    );
  }
}

export const streamService = new EventStreamService();
