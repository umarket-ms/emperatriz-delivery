import * as SecureStore from 'expo-secure-store';
import { authStore } from '@/stores/authStore';

const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Obtiene el refresh token de SecureStore (encriptado por el SO).
 * El access token se obtiene directamente del authStore (memoria).
 */
const getStoredRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error: any) {
    console.error('[authFetch] Error getting refresh token:', error);
    return null;
  }
};

/**
 * Verifica si hay tokens de autenticación disponibles.
 * El access token se verifica en memoria, el refresh token en SecureStore.
 */
const hasStoredAuthTokens = async (): Promise<boolean> => {
  const hasAccessToken = authStore.hasValidToken();
  const refreshToken = await getStoredRefreshToken();
  return hasAccessToken || Boolean(refreshToken);
};

/**
 * Guarda el refresh token en SecureStore (encriptado).
 * El access token se guarda en el authStore (memoria).
 */
export const storeRefreshToken = async (refreshToken: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error: any) {
    console.error('[authFetch] Error storing refresh token:', error);
  }
};

/**
 * Limpia el refresh token de SecureStore.
 * El access token se limpia del authStore (memoria).
 */
export const clearRefreshToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (error: any) {
    console.error('[authFetch] Error clearing refresh token:', error);
  }
};

export { getStoredRefreshToken, hasStoredAuthTokens };
