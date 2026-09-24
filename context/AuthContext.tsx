import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { IUserEntity, IRolesAllowedEntity, DeliveryPersonEntity } from '@/interfaces/auth';
import { authService } from '@/services/authService';
import { socketService } from '@/services/websocketService';
import { courierLocationTracking } from '@/services/courierLocationService';
import { setAuthFailureHandler } from '@/services/api';
import { getRefreshInProgressFlag, refreshAccessToken } from '@/services/tokenManager';

const SESSION_TIMESTAMP_KEY = 'session_last_login';
const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: IUserEntity | null;
  carrier: DeliveryPersonEntity | null;
  roles: IRolesAllowedEntity[] | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  hasPermission: (role: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUserEntity | null>(null);
  const [carrier, setCarrier] = useState<DeliveryPersonEntity | null>(null);
  const [roles, setRoles] = useState<IRolesAllowedEntity[] | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Verificar autenticación al inicio
  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const isAuth = await authService.isAuthenticated();

        if (cancelled) return;

        if (isAuth) {
          // Verificar si la sesión es demasiado antigua (>24h) → forzar re-login
          const lastLoginTs = await AsyncStorage.getItem(SESSION_TIMESTAMP_KEY);
          if (lastLoginTs) {
            const elapsed = Date.now() - parseInt(lastLoginTs, 10);
            if (elapsed > MAX_SESSION_DURATION_MS) {
              console.log('[AuthContext] Sesión expirada por tiempo (>24h), forzando re-login');
              await authService.logout();
              setIsAuthenticated(false);
              setUser(null);
              setCarrier(null);
              setRoles(null);
              return;
            }
          }

          // Check if a refresh was in progress when the app was killed.
          // If so, retry immediately — the backend's grace window will return
          // the same token pair idempotently.
          const refreshFlag = await getRefreshInProgressFlag();
          if (refreshFlag) {
            console.log(`[AuthContext] Refresh in progress flag found (started ${Date.now() - refreshFlag.startedAt}ms ago), retrying...`);
            const retryResult = await refreshAccessToken();
            if (retryResult) {
              console.log('[AuthContext] Retry from in-progress flag succeeded');
              setIsAuthenticated(true);
              setUser(retryResult.user ?? null);
              setCarrier(retryResult.carrier ?? null);
              setRoles(retryResult.user?.userRoles?.map((r: any) => r.title) ?? []);
              await socketService.connect();
              return;
            }
            console.log('[AuthContext] Retry from in-progress flag failed, continuing normal flow...');
          }

          // Refrescar sesión usando el refresh token de SecureStore
          const refreshResult = await authService.refreshSession();

          if (refreshResult.success && refreshResult.data) {
            setIsAuthenticated(true);
            setUser(refreshResult.data.user);
            setCarrier(refreshResult.data.carrier ?? null);
            setRoles(refreshResult.data.roles || []);

            // Conectar WebSocket al inicio si el usuario ya estaba autenticado
            await socketService.connect();
          } else {
            // Fallback: intentar fetchWhoami con el access_token actual
            console.log('[AuthContext] refresh falló, intentando fetchWhoami como fallback');
            const whoami = await authService.fetchWhoami();

            if (whoami.success && whoami.data) {
              setIsAuthenticated(true);
              setUser(whoami.data.user);
              setCarrier(whoami.data.carrier ?? null);
              setRoles(whoami.data.roles || []);
              await socketService.connect();
            } else {
              // Check if the refresh token still exists — if so, the failure
              // was likely a network error, NOT an invalid session.
              const { getStoredRefreshToken } = await import('@/services/auth-fetch');
              const stillHasToken = await getStoredRefreshToken();

              if (stillHasToken) {
                // Token exists but both refresh and whoami failed — likely network issue.
                // Don't set isAuthenticated without carrier data — let the user retry
                console.log('[AuthContext] Token existe pero no se pudieron obtener datos del servidor, manteniendo sesión...');
                // Try to connect WebSocket anyway — it may succeed
                socketService.connect().catch(() => {});
              } else {
                // Token genuinely doesn't exist — must logout
                console.log('[AuthContext] Refresh token no existe, cerrando sesión');
                await authService.logout();
                setIsAuthenticated(false);
                setUser(null);
                setCarrier(null);
                setRoles(null);
              }
            }
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error: any) {
        console.log('Error checking authentication:', error);
        setIsAuthenticated(false);
        setUser(null);
        setCarrier(null);
        setRoles(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // Gestionar tracking de ubicación basado en autenticación
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[AuthContext] Usuario autenticado, configurando location tracking');
      console.log('[AuthContext] User ID:', user.id);
      
      // Configurar el servicio con el userId
      courierLocationTracking.setUserId(user.id);
      
      // Escuchar cambios en la conexión del WebSocket
      const handleConnectionChange = async (connected: boolean) => {
        console.log('[AuthContext] WebSocket connection changed:', connected);
        
        if (connected) {
          console.log('[AuthContext] WebSocket conectado, iniciando location tracking');
          
          // Esperar un poco para asegurar que la conexión está estable
          setTimeout(async () => {
            try {
              const started = await courierLocationTracking.startTracking();
              if (started) {
                console.log('[AuthContext] ✅ Location tracking iniciado correctamente');
                
                // Verificar el estado del tracking
                const status = courierLocationTracking.getTrackingStatus();
                console.log('[AuthContext] Tracking status:', status);
              } else {
                console.warn('[AuthContext] ❌ No se pudo iniciar location tracking');
              }
            } catch (error:any) {
              console.error('[AuthContext] Error al iniciar tracking:', error);
            }
          }, 1000);
        } else {
          console.log('[AuthContext] WebSocket desconectado, pausando location tracking');
          await courierLocationTracking.stopTracking();
        }
      };

      // Registrar el listener
      socketService.onConnectionChange(handleConnectionChange);
      console.log('[AuthContext] Listener de conexión registrado');

      // Cleanup
      return () => {
        console.log('[AuthContext] Limpiando listeners y deteniendo tracking');
        socketService.offConnectionChange(handleConnectionChange);
        courierLocationTracking.stopTracking();
      };
    } else {
      // Si no está autenticado, detener tracking
      console.log('[AuthContext] Usuario no autenticado, deteniendo tracking');
      courierLocationTracking.stopTracking();
    }
  }, [isAuthenticated, user]);

  // Verifica si el usuario tiene un rol específico
  const hasPermission = useCallback((roleTitle: string): boolean => {
    if (!roles) return false;
    return roles.some(role => role.title === roleTitle);
  }, [roles]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      console.log('[AuthContext] login() iniciado');
      const result = await authService.login(email, password);
      
      if (!result.success || !result.data) {
        return { 
          success: false, 
          message: result.error || 'Error en la autenticación',
          details: result.details
        };
      }

      // Validar que el carrier esté presente
      if (!result.data.carrier) {
        return {
          success: false,
          message: 'No se encontró información de mensajero asociada a tu cuenta. Contacte al administrador.',
        };
      }

      // Actualizar estado
      setIsAuthenticated(true);
      setUser(result.data.user);
      setCarrier(result.data.carrier || null);
      setRoles(result.data.roles || []);

      // Guardar timestamp del login para re-login periódico
      await AsyncStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));

      // Conectar WebSocket inmediatamente después del login
      console.log('[AuthContext] Llamando socketService.connect() desde login()...');
      const connected = await socketService.connect();
      console.log('[AuthContext] socketService.connect() retornó:', connected);

      return { success: true };
    } catch (error:any) {
      console.log('Login error:', error);
      return { 
        success: false, 
        message: 'Error de conexión',
        details: error instanceof Error ? { message: error.message } : undefined
      };
    }
  }, []);

  const logout = useCallback(async () => {
    socketService.disconnect();
    await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setCarrier(null);
    setRoles(null);
  }, []);

  const refreshUser = useCallback(async () => {
    // Intentar refreshSession primero (refresca access_token + datos del usuario)
    const refreshResult = await authService.refreshSession();
    if (refreshResult.success && refreshResult.data) {
      setUser(refreshResult.data.user);
      setCarrier(refreshResult.data.carrier ?? null);
      setRoles(refreshResult.data.roles || []);
      return;
    }

    // Fallback: si refreshSession falla, intentar fetchWhoami con el access_token actual
    const whoami = await authService.fetchWhoami();
    if (whoami.success && whoami.data) {
      setUser(whoami.data.user);
      setCarrier(whoami.data.carrier ?? null);
      setRoles(whoami.data.roles || []);
    }
  }, []);

  useEffect(() => {
    // when the API signals authentication failure (401 + no refresh or refresh rejected)
    // we show a toast and then clear state so UI can redirect to login
    setAuthFailureHandler(async () => {
      if (toast) {
        toast.show('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', {
          type: 'danger',
          duration: 4000,
        });
      }
      socketService.disconnect();
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      setCarrier(null);
      setRoles(null);
    });

    return () => {
      setAuthFailureHandler(null);
    };
  }, [toast]);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    isLoading,
    user,
    carrier,
    roles,
    login,
    logout,
    hasPermission,
    refreshUser,
  }), [isAuthenticated, isLoading, user, carrier, roles, login, logout, hasPermission, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
