import { API_URLS } from '@/utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResponseAPI, FetchResponse } from '@/interfaces/global';
import { Platform } from 'react-native';
import { findSchema } from '@/src/api/schemaRegistry';
import { getStoredRefreshToken } from './auth-fetch';
import { authStore } from '@/stores/authStore';
import { ApiEndpoints } from '../utils/api-endpoints';
import { refreshAccessToken } from './tokenManager';

let authFailureHandler: (() => void | Promise<void>) | null = null;
let isRefreshing = false;

export const setAuthFailureHandler = (
    handler: (() => void | Promise<void>) | null
) => {
    authFailureHandler = handler;
};

// Obtener la URL del API según el entorno (development o production)
// Obtiene la URL base sin /api
export const getBaseUrl = () => {
    try {
        let url;
        if (__DEV__) {
            url = Platform.OS === 'ios'
                ? API_URLS.DEV_IOS
                : API_URLS.DEV_ANDROID;
        } else {
            url = API_URLS.PROD;
        }
        return url.endsWith('/') ? url.slice(0, -1) : url;
    } catch (error:unknown) {
        console.log('Error al obtener URL base:', error);
        return API_URLS.DEFAULT;
    }
};

// Obtiene la URL base de la API
const getApiBaseUrl = () => {
    const baseUrl = getBaseUrl();  
    return `${baseUrl}/api/v1`;
};

const getProductImageUrl = () => {
    const baseUrl = getApiBaseUrl();  
    return `${baseUrl}/files/product/`;
};

// URL base para todas las peticiones
export const API_URL = getApiBaseUrl();
const PRODUCT_IMAGE_URL = getProductImageUrl();

/**
 * Construye la URL completa de un endpoint de la API.
 *
 * @param endpoint - Enum del endpoint (ej: ApiEndpoints.DeliveryStatus)
 * @param params - Parámetros de ruta opcionales (ej: { id: '123' })
 * @returns URL completa del endpoint
 *
 * @example
 * // Sin parámetros:
 * getApiUrl(ApiEndpoints.DeliveryStatus)
 * // → "http://localhost:5000/api/delivery-status"
 *
 * // Con parámetros:
 * getApiUrl(ApiEndpoints.DeliveryAssignmentsStatus, { id: '123' })
 * // → "http://localhost:5000/api/delivery-assignments/123/status"
 */
export const getApiUrl = (endpoint: ApiEndpoints, params?: Record<string, string | number>): string => {
    let path: string = endpoint;
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            path = path.replace(`{${key}}`, String(value));
        });
    }
    return `${API_URL}/${path}`;
};

// Opciones por defecto para fetch
const defaultOptions = {
    headers: {
        'Content-Type': 'application/json',
        'X-App': 'delivery',
    },
};

// Función para añadir token de autorización a las opciones (usa tokens centralizados)
const getAuthOptions = async (options: Record<string, any> = {}): Promise<RequestInit> => {
    try {
        const accessToken = authStore.getAccessToken();
        const headers: Record<string, string> = {
            ...(options.headers || {}),
        };

        // Agregar Authorization header si hay access token
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        // Agregar CSRF token para mutaciones (POST, PUT, PATCH, DELETE)
        const csrfToken = authStore.getCsrfToken();
        if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(options.method || 'GET')) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        return {
            ...options,
            headers,
        };
    } catch (error: any) {
        console.log('Error al obtener token de autenticación:', error);
        return options;
    }
};

// Interfaz para las opciones de la API
interface ApiOptions extends RequestInit {
    body?: string | FormData;
    method?: string;
}

// Función para manejar respuestas exitosas
const handleSuccessResponse = async <T>(response: Response): Promise<FetchResponse<T>> => {
    // Para endpoints que no devuelven JSON (como DELETE)
    if (response.status === 204) {
        return {
            data: {
                data: null as any,
                message: 'No content',
                statusCode: 204,
                success: true
            },
            status: response.status
        };
    }

    // Intentar parsear la respuesta como JSON
    try {
        // La respuesta viene como { data: T, message: string, statusCode: number, success: boolean }
        const responseData = await response.json() as ResponseAPI<T>;
        return { data: responseData, status: response.status };
    } catch (parseError) {
        console.log('Error parsing response as JSON:', parseError);
        return {
            error: 'Error al procesar la respuesta del servidor',
            status: response.status,
            parseError: true,
            data: {
                data: null as any,
                message: 'Error al procesar la respuesta del servidor',
                statusCode: response.status,
                success: false
            }
        };
    }
};

// Función genérica para hacer peticiones a la API
const apiRequest = async <T>(endpoint: string, options: ApiOptions = {}): Promise<FetchResponse<T>> => {
    // Pre-compute URL outside try so it's accessible in catch for retries
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_URL}${formattedEndpoint}`;

    try {

        // Añadir token de autenticación a todas las solicitudes
        const authOptions = await getAuthOptions(options);

        // Para FormData, no incluir defaultOptions que contienen Content-Type
        const isFormData = options.body instanceof FormData;
        
        // Asegurarse de que las opciones tengan los headers correctos
        const requestOptions = isFormData 
            ? {
                // Para FormData, solo usar authOptions sin defaultOptions
                ...authOptions
            }
            : {
                // Para requests normales, usar defaultOptions + authOptions
                ...defaultOptions,
                ...authOptions,
                headers: {
                    ...defaultOptions.headers,
                    ...(authOptions.headers || {})
                }
            };

        const response = await fetch(url, requestOptions);

        // Interceptor 401: refrescar token y reintentar una vez
        // Excluir endpoints de auth (login, refresh, whoami, etc.) donde 401 es esperado
        const isAuthEndpoint = formattedEndpoint.startsWith('/auth/');
        if (response.status === 401 && !isRefreshing && !isAuthEndpoint) {
            console.log('[api] 401 detectado en', formattedEndpoint, ', intentando refresh token...');
            isRefreshing = true;
            try {
                const refreshResult = await refreshAccessToken();
                if (refreshResult) {
                    console.log('[api] Token refrescado, reintentando request...');
                    // Releer el token fresco y reintentar
                    const freshAuthOptions = await getAuthOptions(options);
                    const retryRequestOptions = isFormData
                        ? { ...freshAuthOptions }
                        : {
                            ...defaultOptions,
                            ...freshAuthOptions,
                            headers: {
                                ...defaultOptions.headers,
                                ...(freshAuthOptions.headers || {})
                            }
                        };

                    const retryResponse = await fetch(url, retryRequestOptions);

                    if (!retryResponse.ok) {
                        // Si el retry también falla (incluso con token nuevo), propagar error
                        if (retryResponse.status === 401) {
                            console.warn('[api] Retry con token nuevo aún falla con 401, sesión inválida');
                            try { await authFailureHandler?.(); } catch {}
                        }
                        try {
                            const errorData = await retryResponse.json();
                            return {
                                error: errorData.message || `Error ${retryResponse.status}: ${retryResponse.statusText}`,
                                status: retryResponse.status,
                                details: errorData,
                                data: {
                                    data: null as any,
                                    message: errorData.message || `Error ${retryResponse.status}`,
                                    statusCode: retryResponse.status,
                                    success: false
                                }
                            };
                        } catch {
                            return {
                                error: `Error ${retryResponse.status}: ${retryResponse.statusText}`,
                                status: retryResponse.status,
                                data: {
                                    data: null as any,
                                    message: `Error ${retryResponse.status}: ${retryResponse.statusText}`,
                                    statusCode: retryResponse.status,
                                    success: false
                                }
                            };
                        }
                    }

                    // Retry exitoso
                    const retryResult = await handleSuccessResponse<T>(retryResponse);
                    const retrySchema = findSchema(formattedEndpoint);
                    if (retrySchema && retryResult.data) {
                        const schemaResult = retrySchema.safeParse(retryResult.data);
                        if (!schemaResult.success) {
                            console.error('[api] Invalid API response on retry for', formattedEndpoint, schemaResult.error);
                            throw new Error('Invalid API response structure');
                        }
                    }
                    return retryResult;
                } else {
                    // Refresh falló — pero puede ser un error de red, no necesariamente sesión inválida
                    console.warn('[api] Refresh token falló');
                    // Only trigger auth failure if we're sure it's not a network issue.
                    // refreshAccessToken() returns null on network errors AND on definitive auth errors.
                    // The tokenManager already handles clearing for definitive errors.
                    // Here we only trigger the UI logout if the token was actually cleared.
                    const { getStoredRefreshToken } = await import('./auth-fetch');
                    const stillHasToken = await getStoredRefreshToken();
                    if (!stillHasToken) {
                        console.warn('[api] Refresh token ya no existe, sesión inválida');
                        try { await authFailureHandler?.(); } catch {}
                    } else {
                        console.warn('[api] Refresh falló pero token aún existe, probablemente error de red');
                    }
                }
            } catch (refreshError: any) {
                console.error('[api] Error durante refresh/retry:', refreshError?.message || refreshError);
                // Only trigger auth failure if the refresh token no longer exists
                // (network errors during refresh should NOT trigger logout)
                try {
                    const { getStoredRefreshToken } = await import('./auth-fetch');
                    const stillHasToken = await getStoredRefreshToken();
                    if (!stillHasToken) {
                        try { await authFailureHandler?.(); } catch {}
                    } else {
                        console.warn('[api] Error en refresh pero token existe, probablemente error de red — no forzando logout');
                    }
                } catch {
                    // If we can't check, don't force logout
                }
            } finally {
                isRefreshing = false;
            }
        }

        if (!response.ok) {
            try {
                // Intentar obtener detalles del error
                const errorData = await response.json();
                return {
                    error: errorData.message || `Error ${response.status}: ${response.statusText}`,
                    status: response.status,
                    details: errorData,
                    data: {
                        data: null as any,
                        message: errorData.message || `Error ${response.status}`,
                        statusCode: response.status,
                        success: false
                    }
                };
            } catch (parseError) {
                return {
                    error: `Error ${response.status}: ${response.statusText}`,
                    status: response.status,
                    data: {
                        data: null as any,
                        message: `Error ${response.status}: ${response.statusText}`,
                        statusCode: response.status,
                        success: false
                    }
                };
            }
        }

        // Procesar la respuesta exitosa
        const fetchResult = await handleSuccessResponse<T>(response);

        // Validate the parsed data against any registered Zod schema for this endpoint
        const schema = findSchema(formattedEndpoint);
        if (schema && fetchResult.data) {
            const result = schema.safeParse(fetchResult.data);
            if (!result.success) {
                console.error('[api] Invalid API response for', formattedEndpoint, result.error);
                throw new Error('Invalid API response structure');
            }
        }

        return fetchResult;
    } catch (error:any) {
        // Retry on network errors with exponential backoff (max 3 attempts)
        const isNetworkError = error instanceof TypeError &&
            (error.message.includes('Network request failed') || error.message.includes('fetch'));

        if (isNetworkError && !(error as any).__retryCount) {
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                const delayMs = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
                console.log(`[api] Network error, retry ${attempt}/${maxRetries} en ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                try {
                    // Retry the original request
                    const retryAuthOptions = await getAuthOptions(options);
                    const retryIsFormData = options.body instanceof FormData;
                    const retryRequestOptions = retryIsFormData
                        ? { ...retryAuthOptions }
                        : {
                            ...defaultOptions,
                            ...retryAuthOptions,
                            headers: {
                                ...defaultOptions.headers,
                                ...(retryAuthOptions.headers || {})
                            }
                        };
                    const retryResponse = await fetch(url, retryRequestOptions);
                    if (retryResponse.ok || retryResponse.status < 500) {
                        // Got a response (even if 4xx) — don't retry further
                        if (retryResponse.ok) {
                            return await handleSuccessResponse<T>(retryResponse);
                        }
                        break;
                    }
                } catch (retryError: any) {
                    if (attempt === maxRetries) {
                        // All retries exhausted
                        console.warn('[api] All network retries exhausted');
                    }
                }
            }
        }

        console.log('API Request Error:', error);
        return {
            error: `Error de conexión: ${error instanceof Error ? error.message : String(error)}`,
            status: 0,
            networkError: true,
            data: {
                data: null as any,
                message: `Error de conexión: ${error instanceof Error ? error.message : String(error)}`,
                statusCode: 0,
                success: false
            }
        };
    }
};

// Extrae el path relativo de una URL completa o devuelve el endpoint tal cual
const extractPath = (endpoint: string): string => {
    if (endpoint.startsWith('http')) {
        // Si es una URL completa (de getApiUrl), extraer solo el path después de /api
        const apiUrlPrefix = `${API_URL}/`;
        if (endpoint.startsWith(apiUrlPrefix)) {
            return endpoint.slice(apiUrlPrefix.length);
        }
        return endpoint;
    }
    return endpoint;
};

// Métodos específicos para cada tipo de petición
export const api = {
    get: <T>(endpoint: string, options = {}) =>
        apiRequest<T>(extractPath(endpoint), { ...options, method: 'GET' }),

    post: <T>(endpoint: string, data: any, options = {}) =>
        apiRequest<T>(extractPath(endpoint), {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        }),

    put: <T>(endpoint: string, data: any, options = {}) => apiRequest<T>(extractPath(endpoint), {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    patch: <T>(endpoint: string, data: any, options = {}) => {
        return apiRequest<T>(extractPath(endpoint), {
            ...options,
            method: 'PATCH',
            headers: {
                ...((options as any).headers || {}),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },

    delete: <T>(endpoint: string, options = {}) =>
        apiRequest<T>(extractPath(endpoint), { ...options, method: 'DELETE' }),

    postFormData: <T>(endpoint: string, formData: FormData, options = {}) =>
        apiRequest<T>(extractPath(endpoint), {
            ...options,
            method: 'POST',
            body: formData
        }),

    patchFormData: <T>(endpoint: string, formData: FormData, options = {}) =>
        apiRequest<T>(extractPath(endpoint), {
            ...options,
            method: 'PATCH',
            body: formData
        }),
};

// Función para verificar la conectividad con el servidor
// Nota: No hace solicitud HTTP real, solo verifica que la URL base esté configurada
// La conectividad real se verifica a través del WebSocket
export const checkApiConnectivity = async () => {
    try {
        // Simplemente verificar que tenemos una URL válida
        const baseUrl = getBaseUrl();
        
        if (!baseUrl || baseUrl === '') {
            return {
                success: false,
                error: 'URL del servidor no configurada'
            };
        }

        // Retornar éxito si la URL está configurada
        // La verificación real de conectividad se hace al intentar login o conectar WebSocket
        return {
            success: true,
            status: 200,
            message: 'Configuración de servidor correcta'
        };
    } catch (error:any) {
        console.log('API connectivity check error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al verificar la conectividad'
        };
    }
};

// Función de utilidad para validar y extraer los datos de una respuesta API
export const extractDataFromResponse = <T>(response: any): T | null => {
    if (!response) return null;

    // Caso 0: OkResult { ok: true, value: T } - nuevo patrón del backend
    if (typeof response === 'object' && 'data' in response && response.data &&
        'ok' in response.data && response.data.ok === true && 'value' in response.data) {
        return response.data.value as T;
    }

    // Caso 1: La respuesta ya es directamente del tipo esperado
    if (typeof response === 'object' && !('data' in response) && !('success' in response)) {
        return response as T;
    }

    // Caso 2: La respuesta es un objeto ResponseAPI<T>
    if (typeof response === 'object' && 'data' in response && 'success' in response) {
        return response.data as T;
    }

    // Caso 3: La respuesta es un objeto con FetchResponse<T>
    if (typeof response === 'object' && 'data' in response && typeof response.data === 'object') {
        if ('data' in response.data && 'success' in response.data) {
            // Es un FetchResponse con ResponseAPI anidado
            const innerData = response.data.data;

            // Caso 3.1: Verificar si hay otro nivel de anidación para datos paginados
            // Estructura específica de respuestas paginadas: {data: {data: {data: Array, total: number}}}
            if (
                innerData &&
                typeof innerData === 'object' &&
                'data' in innerData &&
                typeof innerData.data === 'object'
            ) {
                // Puede ser una respuesta paginada con estructura: {data: Array, total: number}
                if ('data' in innerData.data && 'total' in innerData.data) {
                    if (Array.isArray(innerData.data.data) &&
                        Object.getOwnPropertyNames(innerData.data).length === 2 &&
                        'data' in innerData.data && 'total' in innerData.data) {
                        return innerData.data as T;
                    } else {
                        // Solo devuelve el array de datos
                        return innerData.data.data as T;
                    }
                }
            }

            return innerData as T;
        } else {
            // El data no tiene la estructura ResponseAPI
            return response.data as T;
        }
    }

    console.warn('Formato de respuesta no reconocido:', response);
    return null;
};
