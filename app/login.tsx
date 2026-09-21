import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TextInput,
    Pressable,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
// Define la interfaz para el resultado del login para manejar los detalles
interface LoginResult {
    success: boolean;
    message?: string;
    details?: any;
}
import { CustomColors } from '@/constants/CustomColors';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, checkApiConnectivity, getApiUrl } from '@/services/api';
import { FontAwesome } from '@expo/vector-icons';
import { authService } from '@/services/authService';
import { router } from 'expo-router';
import { ApiEndpoints } from '@/utils/api-endpoints';

const REMEMBER_EMAIL_KEY = 'remembered_email';
const REMEMBER_PASSWORD_KEY = 'remembered_password';
const REMEMBER_ME_KEY = 'remember_me_enabled';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [apiStatus, setApiStatus] = useState<{ connected: boolean, message: string }>({
        connected: true,
        message: ''
    });

    const { login: authLogin } = useAuth();
    const login = authLogin as (email: string, password: string) => Promise<LoginResult>;

    React.useEffect(() => {
        const controller = new AbortController();

        const checkConnection = async () => {
            const result = await checkApiConnectivity();
            if (!controller.signal.aborted) {
                setApiStatus({
                    connected: result.success,
                    message: result.success ? '' : `Error de conexión: ${result.error}`
                });
            }
        };

        checkConnection();

        fetch(getApiUrl(ApiEndpoints.AppVersionDelivery), { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (!controller.signal.aborted) {
                    setAppVersion(data.version);
                }
            })
            .catch(() => {});

        return () => controller.abort();
    }, []);

    // Cargar email recordado al iniciar
    useEffect(() => {
        const loadRememberedEmail = async () => {
            try {
                const [savedEmail, savedPassword, savedRememberMe] = await Promise.all([
                    AsyncStorage.getItem(REMEMBER_EMAIL_KEY),
                    AsyncStorage.getItem(REMEMBER_PASSWORD_KEY),
                    AsyncStorage.getItem(REMEMBER_ME_KEY),
                ]);
                if (savedRememberMe === 'true' && savedEmail) {
                    setEmail(savedEmail);
                    setPassword(savedPassword || '');
                    setRememberMe(true);
                }
            } catch {}
        };
        loadRememberedEmail();
    }, []);

    const checkServerConnection = async () => {
        setApiStatus({
            connected: true,
            message: 'Verificando conexión...'
        });

        const result = await checkApiConnectivity();
        setApiStatus({
            connected: result.success,
            message: result.success ? '' : `Error de conexión: ${result.error}`
        });

        return result.success;
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa tu email y contraseña');
            return;
        }

        // Primero verificamos la conexión
        setIsLoading(true);
        const isConnected = await checkServerConnection();

        if (!isConnected) {
            setIsLoading(false);
            Alert.alert(
                'Error de conexión',
                `No se pudo conectar al servidor: ${API_URL}. Verifica tu conexión a internet y que el servidor esté disponible.`
            );
            return;
        }

        try {
            const result = await login(email, password);

            if (!result.success) {
                let errorMessage = result.message || 'Credenciales incorrectas';

                // Intentamos extraer un mensaje más detallado si existe
                if (result.details) {
                    if (typeof result.details === 'object') {
                        // Si es un objeto, intentamos extraer el mensaje
                        if (result.details.message) {
                            errorMessage = `${errorMessage}\n\nDetalles del servidor: ${result.details.message}`;
                        } else if (result.details.error) {
                            errorMessage = `${errorMessage}\n\nError del servidor: ${result.details.error}`;
                        } else {
                            // Si no hay mensaje específico, mostramos la estructura
                            errorMessage = `${errorMessage}\n\nDetalles: ${JSON.stringify(result.details)}`;
                        }
                    } else {
                        errorMessage = `${errorMessage}\n\nDetalles: ${result.details}`;
                    }
                }

                Alert.alert('Error de inicio de sesión', errorMessage);
            } else {
                console.log('Inicio de sesión exitoso');

                // Guardar email recordado si "Recuérdame" está activado
                if (rememberMe) {
                    await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email);
                    await AsyncStorage.setItem(REMEMBER_PASSWORD_KEY, password);
                    await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
                } else {
                    await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
                    await AsyncStorage.removeItem(REMEMBER_PASSWORD_KEY);
                    await AsyncStorage.removeItem(REMEMBER_ME_KEY);
                }

                // Verificar si el usuario necesita verificar su email
                const authData = await authService.getAuthData();
                if (authData.user && !authData.user.isEmailVerified) {
                    // Redirigir a pantalla de verificación de email
                    router.replace('/verify-email');
                } else if (authData.user && authData.user.mustChangePassword) {
                    // Debe cambiar su contraseña inicial
                    router.replace('/change-initial-password');
                } else if (authData.user && !authData.carrier) {
                    // Carrier data is missing -- cannot proceed
                    Alert.alert(
                        'Error',
                        'No se encontró información de mensajero asociada a tu cuenta. Contacte al administrador.',
                    );
                    await authService.logout();
                } else {
                    // Usuario ya verificado, ir a la aplicación principal
                    router.replace('/(tabs)');
                }
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Alert.alert(
                'Error',
                `No se pudo conectar con el servidor.\nError: ${errorMessage}`
            );
            console.log('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Image
                            source={require('@/assets/images/screen.png')}
                            style={styles.logo}
                            contentFit="contain"
                        />
                        <Text style={styles.title}>Tiendas Dominicanas Mensajeria</Text>
                        <Text style={styles.apiUrl}>
                            {__DEV__ ? (
                                <>
                                    <Text>API: {API_URL} {' '}</Text>
                                    <Text style={{
                                        color: apiStatus.connected ? CustomColors.success : CustomColors.error,
                                        fontWeight: 'bold'
                                    }}>
                                        {apiStatus.connected ? '●' : '○'}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text>{apiStatus.connected ? 'CONECTADO' : 'DESCONECTADO'} {' '}</Text>
                                    <Text style={{
                                        color: apiStatus.connected ? CustomColors.success : CustomColors.error,
                                        fontWeight: 'bold'
                                    }}>
                                        {apiStatus.connected ? '●' : '○'}
                                    </Text>
                                </>
                            )}
                        </Text>
                        {apiStatus.message ? (
                            <Pressable onPress={checkServerConnection}>
                                <Text style={styles.apiErrorMessage}>{apiStatus.message}</Text>
                            </Pressable>
                        ) : null}
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ingresa tu email"
                                placeholderTextColor={CustomColors.neutralLight}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Contraseña</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Ingresa tu contraseña"
                                    placeholderTextColor={CustomColors.neutralLight}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <Pressable
                                    style={styles.eyeIcon}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    <FontAwesome
                                        name={showPassword ? "eye" : "eye-slash"}
                                        size={20}
                                        color={CustomColors.neutralLight}
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <Pressable
                            style={styles.rememberMeContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                        >
                            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                {rememberMe && (
                                    <FontAwesome name="check" size={12} color={CustomColors.white} />
                                )}
                            </View>
                            <Text style={styles.rememberMeText}>Recuérdame</Text>
                        </Pressable>

                        <Pressable
                            style={styles.loginButton}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={CustomColors.white} />
                            ) : (
                                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                            )}
                        </Pressable>
                        <Pressable style={styles.forgotPassword} onPress={() => router.push('/forgot-password' as any)}>
                            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
            {appVersion ? (
                <Text style={styles.versionText}>v{appVersion}</Text>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: CustomColors.backgroundDarkest,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'transparent',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
        backgroundColor: 'transparent',
    }, apiUrl: {
        color: CustomColors.neutralLight,
        fontSize: 12,
        marginTop: 5,
        opacity: 0.7,
    },
    apiErrorMessage: {
        color: CustomColors.error,
        fontSize: 12,
        marginTop: 5,
        textAlign: 'center',
        padding: 5,
        backgroundColor: 'rgba(229, 57, 53, 0.1)',
        borderRadius: 4,
    },
    logo: {
        width: 250,
        height: 250,
        // marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: CustomColors.white,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    formContainer: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    inputContainer: {
        marginBottom: 20,
        backgroundColor: 'transparent',
    },
    label: {
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '600',
        color: CustomColors.white,
    }, input: {
        backgroundColor: CustomColors.inputBackground,
        borderRadius: 12,
        height: 54,
        paddingHorizontal: 16,
        color: CustomColors.white,
        borderWidth: 1,
        borderColor: CustomColors.border,
    },
    passwordContainer: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CustomColors.inputBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: CustomColors.border,
    },
    passwordInput: {
        flex: 1,
        height: 54,
        paddingHorizontal: 16,
        color: CustomColors.white,
        backgroundColor: 'transparent',
    },
    eyeIcon: {
        padding: 10,
        position: 'absolute',
        right: 5,
        height: '100%',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    loginButton: {
        backgroundColor: CustomColors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        boxShadow: '0px 2px 3.84px rgba(0,0,0,0.25)',
    },
    loginButtonText: {
        color: CustomColors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    forgotPassword: {
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: 'transparent',
    },
    forgotPasswordText: {
        color: CustomColors.primary,
        fontSize: 14,
    },
    rememberMeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        backgroundColor: 'transparent',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: CustomColors.neutralLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    checkboxChecked: {
        backgroundColor: CustomColors.primary,
        borderColor: CustomColors.primary,
    },
    rememberMeText: {
        color: CustomColors.white,
        fontSize: 14,
    },
    versionText: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        color: CustomColors.neutralLight,
        fontSize: 11,
        opacity: 0.5,
    },
});
