import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './api';
import { getStoredRefreshToken, storeRefreshToken, clearRefreshToken } from './auth-fetch';
import { authStore } from '@/stores/authStore';
import { ApiEndpoints } from '../utils/api-endpoints';
import { validateJwtHasEnterprise, logJwtValidation } from '../utils/jwt-utils';

const REFRESH_IN_PROGRESS_KEY = 'refresh_in_progress';

export interface RefreshResult {
  accessToken: string;
  csrfToken: string | null;
  refreshToken: string | null;
  user: any | null;
  carrier: any | null;
}

/**
 * Data stored when a refresh is in progress, to survive abrupt app closures.
 * If the app is killed mid-refresh, on next mount AuthContext can detect this
 * and retry the refresh — the backend will return the same token pair
 * idempotently via the grace window.
 */
export interface RefreshInProgressFlag {
  startedAt: number; // Date.now() when the refresh started
  oldTokenHash: string; // First 16 chars of the refresh token for identification
}

/**
 * Error codes from the backend that definitively mean the refresh token
 * is invalid and should be cleared. Only these codes trigger token cleanup.
 * Everything else (timeout, network, 500, generic error) is treated as
 * temporary and does NOT clear the token.
 */
const DEFINITIVE_REFRESH_ERROR_CODES = new Set([
  'REFRESH_TOKEN_REUSE_OUTSIDE_GRACE',
  'REFRESH_TOKEN_NOT_FOUND',
]);

/**
 * Reads the refresh_in_progress flag from AsyncStorage.
 * Returns null if no flag is set or if it's too old (>30s).
 */
export async function getRefreshInProgressFlag(): Promise<RefreshInProgressFlag | null> {
  try {
    const raw = await AsyncStorage.getItem(REFRESH_IN_PROGRESS_KEY);
    if (!raw) return null;
    const flag: RefreshInProgressFlag = JSON.parse(raw);
    // Only consider flags from the last 30 seconds (backend grace window is 15s)
    if (Date.now() - flag.startedAt > 30_000) {
      await clearRefreshInProgressFlag();
      return null;
    }
    return flag;
  } catch {
    return null;
  }
}

/**
 * Writes a refresh_in_progress flag to AsyncStorage before starting a refresh.
 */
async function setRefreshInProgressFlag(refreshToken: string): Promise<void> {
  try {
    const flag: RefreshInProgressFlag = {
      startedAt: Date.now(),
      oldTokenHash: refreshToken.substring(0, 16),
    };
    await AsyncStorage.setItem(REFRESH_IN_PROGRESS_KEY, JSON.stringify(flag));
  } catch {
    // Non-critical — if we can't write the flag, the refresh still proceeds
  }
}

/**
 * Clears the refresh_in_progress flag from AsyncStorage.
 */
export async function clearRefreshInProgressFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REFRESH_IN_PROGRESS_KEY);
  } catch {
    // Non-critical
  }
}

let pendingRefresh: Promise<RefreshResult | null> | null = null;

/**
 * Refresca el access token vía HTTP (`POST /auth/refresh-token`).
 * Deduplica requests concurrentes.
 *
 * Nota: antes intentaba primero por WebSocket (`token.refresh` con ack). Con
 * la migración a SSE el canal de tiempo real es de SOLO bajada, así que el
 * refresh vuelve a ser exclusivamente HTTP — que además es el único path con
 * `TokenRefreshMiddleware` y contexto de tenant correcto.
 */
export async function refreshAccessToken(): Promise<RefreshResult | null> {
  if (pendingRefresh) {
    console.log('[TokenManager] Refresh ya en progreso, reutilizando...');
    return pendingRefresh;
  }

  pendingRefresh = doRefresh();

  try {
    return await pendingRefresh;
  } finally {
    pendingRefresh = null;
  }
}

async function doRefresh(): Promise<RefreshResult | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    console.warn('[TokenManager] No hay refresh token disponible');
    return null;
  }

  // Write refresh_in_progress flag before starting
  await setRefreshInProgressFlag(refreshToken);

  try {
    return await refreshViaHttp(refreshToken);
  } finally {
    // Always clear the flag when refresh completes (success or failure)
    await clearRefreshInProgressFlag();
  }
}

/**
 * Determines if an error response from the backend is a definitive
 * signal that the refresh token should be cleared.
 */
function isDefinitiveRefreshError(errorCode?: string | null): boolean {
  if (!errorCode) return false;
  return DEFINITIVE_REFRESH_ERROR_CODES.has(errorCode);
}

/**
 * Refresh vía HTTP: POST /auth/refresh-token.
 */
async function refreshViaHttp(refreshToken: string): Promise<RefreshResult | null> {
  try {
    console.log('[TokenManager] Refrescando access token vía HTTP...');

    const response = await fetch(getApiUrl(ApiEndpoints.AuthRefreshToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.warn(`[TokenManager] HTTP refresh falló con status ${response.status}`);

      // Only clear token on 401/403 if the body contains a definitive error code
      if (response.status === 401 || response.status === 403) {
        try {
          const errorBody = await response.json();
          const errorCode = errorBody?.code as string | undefined;

          if (isDefinitiveRefreshError(errorCode)) {
            console.warn(`[TokenManager] Error definitivo (${errorCode}), limpiando token...`);
            await clearRefreshToken();
            authStore.clearSession();
          } else {
            console.warn('[TokenManager] 401/403 sin código definitivo, NO limpiando token');
          }
        } catch {
          // Can't parse body — treat as ambiguous, don't clear
          console.warn('[TokenManager] No se pudo parsear body del error 401/403, NO limpiando token');
        }
      }
      // Status 500, network errors, timeouts — NEVER clear the token
      return null;
    }

    const data = await response.json();
    const refreshData = data?.value ?? data;

    if (!refreshData?.access_token) {
      console.warn('[TokenManager] HTTP refresh: respuesta sin access_token');
      return null;
    }

    // Actualizar tokens en memoria
    authStore.setAccessToken(refreshData.access_token);
    if (refreshData.csrf_token) {
      authStore.setCsrfToken(refreshData.csrf_token);
    }

    // Actualizar refresh token en SecureStore
    if (refreshData.refresh_token) {
      await storeRefreshToken(refreshData.refresh_token);
    }

    // Validar token
    validateJwtHasEnterprise(refreshData.access_token);
    logJwtValidation(refreshData.access_token, 'refresh-http');

    console.log('[TokenManager] Token refrescado exitosamente vía HTTP');

    return {
      accessToken: refreshData.access_token,
      csrfToken: refreshData.csrf_token ?? null,
      refreshToken: refreshData.refresh_token ?? null,
      user: refreshData.user ?? null,
      carrier: refreshData.carrier ?? null,
    };
  } catch (error: any) {
    console.error('[TokenManager] Error en refresh vía HTTP (timeout/red) — NO limpiando token:', error?.message || error);
    return null;
  }
}

/**
 * Lee el access token actual de memoria.
 */
export function getAccessToken(): string | null {
  return authStore.getAccessToken();
}

/**
 * Verifica si el token actual está expirado.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return true;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized));
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

/**
 * Verifica si el token ha consumido un porcentaje del TTL (ej: 75%).
 * Usado para refresh proactivo ANTES de que expire, no después.
 *
 * @param token - JWT access token
 * @param percentUsed - Fracción del TTL consumida (0-1). Ej: 0.75 = 75%
 * @returns true si el token ha consumido >= percentUsed de su TTL
 */
export function isTokenExpiringSoon(token: string, percentUsed: number = 0.75): boolean {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return true;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized));
    if (!payload.exp || !payload.iat) {
      // Fallback: si no hay iat, tratar como expirado si exp está cerca
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now() + 30_000;
    }
    const totalTtlMs = (payload.exp - payload.iat) * 1000;
    const elapsedMs = Date.now() - payload.iat * 1000;
    return elapsedMs >= totalTtlMs * percentUsed;
  } catch {
    return true;
  }
}

/**
 * Retorna un token válido. Si el actual está expirado, intenta refresh.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const currentToken = authStore.getAccessToken();
  if (currentToken && !isTokenExpired(currentToken)) {
    return currentToken;
  }
  const result = await refreshAccessToken();
  return result?.accessToken ?? null;
}
