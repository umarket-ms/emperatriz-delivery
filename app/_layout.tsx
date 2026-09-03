import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import '../src/lib/sentry';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { registerTranslation } from 'react-native-paper-dates';

registerTranslation('es', {
  save: 'Guardar',
  selectSingle: 'Seleccionar',
  selectMultiple: 'Seleccionar',
  selectRange: 'Seleccionar rango',
  notAccordingToDateFormat: (inputFormat) => `Formato: ${inputFormat}`,
  mustBeHigherThan: (date) => `Debe ser mayor que ${date}`,
  mustBeLowerThan: (date) => `Debe ser menor que ${date}`,
  mustBeBetween: (startDate, endDate) => `Debe estar entre ${startDate} y ${endDate}`,
  dateIsDisabled: 'Fecha no permitida',
  previous: 'Anterior',
  next: 'Siguiente',
  typeInDate: 'Escribir fecha',
  pickDateFromCalendar: 'Seleccionar del calendario',
  close: 'Cerrar',
  hour: 'Hora',
  minute: 'Minuto',
});

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ActiveDeliveryProvider } from '@/context/ActiveDeliveryContext';
import { DeliveryProvider } from '@/context/DeliveryContext';
import { useDelivery } from '@/context/DeliveryContext';
import { useColorScheme } from '@/components/useColorScheme';
import { CustomColors } from '@/constants/CustomColors';
import LoadingScreen from '@/components/LoadingScreen';
import { NotificationHandler } from '@/components/NotificationHandler';
import * as NavigationBar from 'expo-navigation-bar';
import { api, checkApiConnectivity } from '@/services/api';
import { setupDeepLinkListeners } from '@/utils/deepLinkHandler';
import { useBatteryOptimizationCheck } from '@/core/hooks/useBatteryOptimizationCheck';
import { useFCMPushNotifications } from '@/core/hooks/useFCMPushNotifications';
import { useOTAUpdates } from '@/core/hooks/useOTAUpdates';
import ForceUpdateScreen from '@/components/ForceUpdateScreen';
import { getRecoveryState } from '@/utils/passwordRecovery';

// ── Custom Paper theme using new palette ─────────────────────
const paperCustomTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: CustomColors.primary,
    onPrimary: CustomColors.white,
    primaryContainer: CustomColors.primaryDark,
    onPrimaryContainer: CustomColors.white,
    secondary: CustomColors.primary,
    onSecondary: CustomColors.white,
    secondaryContainer: CustomColors.primaryDark,
    onSecondaryContainer: CustomColors.white,
    tertiary: CustomColors.white,
    onTertiary: CustomColors.black,
    tertiaryContainer: CustomColors.backgroundMedium,
    onTertiaryContainer: CustomColors.white,
    error: CustomColors.error,
    onError: CustomColors.white,
    errorContainer: CustomColors.primaryDark,
    onErrorContainer: CustomColors.white,
    background: CustomColors.backgroundDarkest,
    onBackground: CustomColors.white,
    surface: CustomColors.backgroundDark,
    onSurface: CustomColors.white,
    surfaceVariant: CustomColors.cardBackground,
    onSurfaceVariant: CustomColors.white,
    outline: CustomColors.border,
    outlineVariant: CustomColors.divider,
    shadow: CustomColors.shadow,
    scrim: CustomColors.shadow,
    inverseSurface: CustomColors.white,
    inverseOnSurface: CustomColors.black,
    inversePrimary: CustomColors.primary,
    elevation: {
      level0: 'transparent',
      level1: CustomColors.inputBackground,
      level2: CustomColors.backgroundDark,
      level3: CustomColors.backgroundMedium,
      level4: CustomColors.cardBackground,
      level5: CustomColors.backgroundDark,
    },
  },
};

// ── Custom Navigation theme ──────────────────────────────────
const navCustomTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: CustomColors.primary,
    background: CustomColors.backgroundDarkest,
    card: CustomColors.backgroundDark,
    text: CustomColors.white,
    border: CustomColors.border,
    notification: CustomColors.primary,
  },
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [showBootLoader, setShowBootLoader] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      setShowBootLoader(true);
      const timer = setTimeout(() => setShowBootLoader(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  useEffect(() => {
    NavigationBar.setVisibilityAsync('hidden').catch(() => {
    });

  }, []);

  const { isForceUpdateRequired, status: updateStatus, retry } = useOTAUpdates();

  if (!loaded) {
    return null;
  }

  if (isForceUpdateRequired) {
    return <ForceUpdateScreen status={updateStatus} onRetry={retry} />;
  }

  return showBootLoader ? (
    <View style={styles.splashContainer}>
      <Image source={require('../assets/images/screen.png')} style={styles.splashImage} contentFit="contain" />
      <ActivityIndicator size="large" color={CustomColors.white} style={styles.splashSpinner} />
    </View>
  ) : (
    <RootLayoutNav />
  );
}

// Protección de rutas
function ProtectedRouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { fetchDeliveries } = useDelivery();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const lastOnline = useRef<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFCMPushNotifications(user?.id);

  useEffect(() => {
    if (isLoading || !navigationState?.key) return;

    const isLoginScreen = segments[0] === 'login';
    const isVerifyScreen = segments[0] === 'verify-email';
    const isChangePasswordScreen = segments[0] === 'change-initial-password';
    const isForgotPasswordScreen = segments[0] === 'forgot-password';

    if (!isAuthenticated && !isLoginScreen && !isVerifyScreen && !isChangePasswordScreen && !isForgotPasswordScreen) {
      // No autenticado → login (o forgot-password si hay recuperación activa)
      getRecoveryState().then((recovery) => {
        if (recovery?.active) {
          router.replace('/forgot-password');
        } else {
          router.replace('/login');
        }
      });
    } else if (isAuthenticated && !user?.isEmailVerified && !isVerifyScreen) {
      // Autenticado pero sin verificar email → pantalla de verificación
      router.replace('/verify-email');
    } else if (isAuthenticated && user?.isEmailVerified && user?.mustChangePassword && !isChangePasswordScreen) {
      // Email verificado pero debe cambiar contraseña inicial
      router.replace('/change-initial-password');
    } else if (isAuthenticated && user?.isEmailVerified && !user?.mustChangePassword && (isLoginScreen || isVerifyScreen || isChangePasswordScreen)) {
      // Autenticado y verificado → app
      router.replace('/(tabs)');
    }
  }, [segments, isAuthenticated, isLoading, navigationState?.key, user?.isEmailVerified, user?.mustChangePassword]);

  useEffect(() => {
    // Oculta los botones de Android
    NavigationBar.setVisibilityAsync('hidden').catch(() => {
      // Silently ignore if activity is no longer available
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      try {
        const result = await checkApiConnectivity();
        const isOnline = !!result?.success;
        if (lastOnline.current === false && isOnline) {
          await fetchDeliveries(true);
        }
        lastOnline.current = isOnline;
      } catch { }
    }, 15000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current as unknown as number);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, isLoading, fetchDeliveries]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  useBatteryOptimizationCheck();

  useEffect(() => {
    // Setup deep link listeners for handling shared locations
    console.log('[App] Setting up deep link listeners');
    const cleanup = setupDeepLinkListeners();

    // Cleanup on unmount
    return cleanup;
  }, []);

  const paperTheme = paperCustomTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <ActiveDeliveryProvider>
          <DeliveryProvider>
              <ThemeProvider value={navCustomTheme}>
              <ProtectedRouteGuard>
                <Stack screenOptions={{
                  headerStyle: {
                    backgroundColor: CustomColors.backgroundDarkest
                  },
                  headerTintColor: CustomColors.white
                }}>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
                </Stack>

                <NotificationHandler />
              </ProtectedRouteGuard>
            </ThemeProvider>
          </DeliveryProvider>
        </ActiveDeliveryProvider>
      </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: CustomColors.backgroundDarkest,
    alignItems: 'center',
    justifyContent: 'center'
  },
  splashImage: {
    width: '72%',
    height: undefined,
    aspectRatio: 1,
    marginBottom: 24
  },
  splashSpinner: {
    marginTop: 8
  }
});
