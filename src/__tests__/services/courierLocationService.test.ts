import { isForegroundServiceBackgroundStartError } from '../../../services/courierLocationService';

// El servicio importa dependencias con side-effects a nivel de módulo
// (streamService, tokenManager, api). Solo se testea la función pura exportada.
jest.mock('../../../services/eventStreamService', () => ({
  streamService: { on: jest.fn(), isConnected: jest.fn(() => false) },
  StreamEventType: { REQUEST_LOCATION_REFRESH: 'REQUEST_LOCATION_REFRESH' },
}));
jest.mock('../../../services/api', () => ({
  getApiUrl: jest.fn(() => 'https://api.test'),
}));
jest.mock('../../../services/tokenManager', () => ({
  ensureFreshAccessToken: jest.fn(async () => 'token'),
}));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

/**
 * Mensaje real observado en producción (Android 12+/API 31), incluido el
 * wrapping de expo-location en un CodedError y el salto de línea del stack.
 */
const REAL_ERROR = `Call to function 'ExpoLocation.startLocationUpdatesAsync' has been rejected.
→ Caused by: Couldn't start the foreground service. Foreground service cannot be started when the application is in the background`;

describe('isForegroundServiceBackgroundStartError', () => {
  it('detecta el rechazo real de Android 12+ con su wrapping de expo-location', () => {
    expect(isForegroundServiceBackgroundStartError(new Error(REAL_ERROR))).toBe(
      true,
    );
  });

  it('detecta la frase residual si expo-location cambia el wrapping', () => {
    expect(
      isForegroundServiceBackgroundStartError(
        new Error(
          "Foreground service cannot be started when the application is in the background",
        ),
      ),
    ).toBe(true);
  });

  it('detecta variantes con mayúsculas y espacios dobles (normalización)', () => {
    expect(
      isForegroundServiceBackgroundStartError(
        new Error(
          "Couldn't start the   FOREGROUND SERVICE while in BACKGROUND",
        ),
      ),
    ).toBe(true);
  });

  it('acepta el mensaje crudo como string, no solo Error', () => {
    expect(isForegroundServiceBackgroundStartError(REAL_ERROR)).toBe(true);
  });

  it('no confunde otros errores de foreground service (sin "background")', () => {
    expect(
      isForegroundServiceBackgroundStartError(
        new Error('Foreground service not allowed in this state'),
      ),
    ).toBe(false);
  });

  it('no marca errores de permisos como este', () => {
    expect(
      isForegroundServiceBackgroundStartError(
        new Error('Missing location permission: ACCESS_BACKGROUND_LOCATION'),
      ),
    ).toBe(false);
  });

  it('no marca un error genérico', () => {
    expect(
      isForegroundServiceBackgroundStartError(new Error('Network request failed')),
    ).toBe(false);
  });

  it('es tolerante a null, undefined y tipos no string', () => {
    expect(isForegroundServiceBackgroundStartError(null)).toBe(false);
    expect(isForegroundServiceBackgroundStartError(undefined)).toBe(false);
    expect(isForegroundServiceBackgroundStartError(42)).toBe(false);
    expect(isForegroundServiceBackgroundStartError({})).toBe(false);
  });

  it('acepta un objeto con message (CodedError sin instanceof Error)', () => {
    expect(
      isForegroundServiceBackgroundStartError({ message: REAL_ERROR }),
    ).toBe(true);
  });
});
