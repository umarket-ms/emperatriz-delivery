import { fetch } from 'expo/fetch';
import {
  streamService,
  StreamEventType,
} from '../../../services/eventStreamService';
import { ensureFreshAccessToken } from '../../../services/tokenManager';
import { adaptDeliveriesToAdapter } from '@/interfaces/delivery/deliveryAdapters';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../../../services/api', () => ({
  getApiUrl: jest.fn(() => 'https://api.test/api/v1/events'),
}));
jest.mock('../../../services/tokenManager', () => ({
  ensureFreshAccessToken: jest.fn(),
  isTokenExpired: jest.fn(() => false),
  refreshAccessToken: jest.fn(),
}));
jest.mock('../../../services/notificationService', () => ({
  queueNotification: jest.fn(),
  NotificationType: { SUCCESS: 'SUCCESS', INFO: 'INFO' },
}));
// El adaptador se sustituye por uno que marca la transformación: así el test
// demuestra que el consumidor recibe el payload ADAPTADO (contrato del
// antiguo socketService) y no el crudo del servidor.
jest.mock('@/interfaces/delivery/deliveryAdapters', () => ({
  adaptDeliveriesToAdapter: jest.fn((rows: any[]) =>
    rows.map((row: any) => ({ id: row.id, adapted: true })),
  ),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Reader que entrega los chunks y después queda bloqueado (stream vivo). */
function readerFor(chunks: Uint8Array[]) {
  let index = 0;
  return {
    read: () =>
      index < chunks.length
        ? Promise.resolve({ done: false, value: chunks[index++] })
        : new Promise<never>(() => undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
}

function streamResponse(chunks: Uint8Array[]) {
  const reader = readerFor(chunks);
  return {
    ok: true,
    status: 200,
    body: { getReader: () => reader },
    __reader: reader,
  };
}

const frame = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'));

describe('EventStreamService', () => {
  const fetchMock = fetch as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (ensureFreshAccessToken as jest.Mock).mockResolvedValue('token-vigente');
    fetchMock.mockReset();
  });

  afterEach(() => {
    streamService.disconnect();
  });

  it('onConnectionChange entrega el estado actual al suscribirse', () => {
    const states: boolean[] = [];
    streamService.onConnectionChange((connected) => states.push(connected));

    expect(states).toEqual([false]);
  });

  it('connect() devuelve false cuando no hay token y no abre nada', async () => {
    (ensureFreshAccessToken as jest.Mock).mockResolvedValue(null);

    const started = await streamService.connect();

    expect(started).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('abre el stream con Authorization y entrega los eventos adaptados', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        frame(
          'id: 1000-1\nevent: driver-assigned\ndata: {"data":{"id":9},"message":"Asignada"}\n\n',
        ),
      ]),
    );

    const received: any[] = [];
    streamService.on(StreamEventType.DRIVER_ASSIGNED, (payload: any) =>
      received.push(payload),
    );

    const started = await streamService.connect();
    await flush();

    expect(started).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/events?clientType=delivery');
    expect(init.headers.Authorization).toBe('Bearer token-vigente');
    expect(init.headers['Last-Event-ID']).toBeUndefined();
    expect(init.signal).toBeDefined();

    // El consumidor recibe la entrega adaptada (igual que con Socket.IO),
    // no el payload crudo del servidor.
    expect(adaptDeliveriesToAdapter).toHaveBeenCalledWith([{ id: 9 }]);
    expect(received).toEqual([{ id: 9, adapted: true }]);
  });

  it('reenvía Last-Event-ID en la reconexión para no perder eventos', async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse([
        frame('id: 77-1\nevent: delivery-status-updated\ndata: {"data":{"id":1}}\n\n'),
      ]),
    );

    await streamService.connect();
    await flush();
    streamService.disconnect();
    await flush();

    fetchMock.mockResolvedValueOnce(streamResponse([]));
    await streamService.connect();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers['Last-Event-ID']).toBe('77-1');
  });

  it('entrega sin adaptador los eventos que no tienen handler interno', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        frame(
          'event: courier.location.refresh\ndata: {"forzado":true}\n\n',
        ),
      ]),
    );

    const received: any[] = [];
    streamService.on(StreamEventType.REQUEST_LOCATION_REFRESH, (p: any) =>
      received.push(p),
    );

    await streamService.connect();
    await flush();

    expect(received).toEqual([{ forzado: true }]);
    expect(adaptDeliveriesToAdapter).not.toHaveBeenCalled();
  });

  it('connect() es idempotente: no abre un segundo stream', async () => {
    fetchMock.mockResolvedValue(streamResponse([]));

    await streamService.connect();
    await streamService.connect();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('disconnect() marca desconectado y notifica a los suscriptores', async () => {
    fetchMock.mockResolvedValue(streamResponse([frame('data: {}\n\n')]));
    const states: boolean[] = [];
    streamService.onConnectionChange((connected) => states.push(connected));

    await streamService.connect();
    await flush();
    streamService.disconnect();
    await flush();

    expect(states).toEqual([false, true, false]);
    expect(streamService.isConnected()).toBe(false);
  });

  it('un error de red no revienta el loop y deja el estado desconectado', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(streamResponse([]));

    await streamService.connect();
    await flush();
    await flush();

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(streamService.isConnected()).toBe(false);
  });
});
