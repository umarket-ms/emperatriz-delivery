import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomColors } from '@/constants/CustomColors';
import { Capitalize } from '@/utils/capitalize';
import { DriverTopRoute } from '@/core/actions/ganancias-actions';

interface TopRouteProps {
    route?: DriverTopRoute | null;
    isLoading?: boolean;
}

const TopRoute = ({ route, isLoading = false }: TopRouteProps) => {
    return (
        <View style={styles.wrapper}>
            <View style={styles.card}>
                <View style={styles.content}>
                    <View style={styles.trophyBadge}>
                        <Ionicons name="trophy" size={28} color={CustomColors.warning} />
                    </View>
                    {isLoading ? (
                        <ActivityIndicator color={CustomColors.warning} style={{ flex: 1 }} />
                    ) : route ? (
                        <View style={styles.info}>
                            <Text style={styles.label}>RUTA ESTRELLA</Text>
                            <Text style={styles.routeName} numberOfLines={2}>{Capitalize(route.routeName)}</Text>
                            <Text style={styles.subtext}>{route.deliveryCount} entrega/s </Text>
                        </View>
                    ) : (
                        <View style={styles.info}>
                            <Text style={styles.label}>RUTA ESTRELLA</Text>
                            <Text style={styles.routeName}>Sin datos aún</Text>
                            <Text style={styles.subtext}>Completa entregas para ver tu ruta estrella</Text>
                        </View>
                    )}
                    {route && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>#1</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

export default TopRoute;

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: 2,
        marginBottom: 16,
        borderRadius: 20,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
    },
    card: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: `${CustomColors.warning}59`,
        backgroundColor: `${CustomColors.warning}14`,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    trophyBadge: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: `${CustomColors.warning}26`,
        borderWidth: 1,
        borderColor: `${CustomColors.warning}59`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
    },
    label: {
        fontSize: 10,
        color: CustomColors.warning,
        letterSpacing: 1.2,
        marginBottom: 4,
        opacity: 0.85,
    },
    routeName: {
        fontSize: 18,
        fontWeight: '800',
        color: CustomColors.textLight,
        marginBottom: 3,
    },
    subtext: {
        fontSize: 12,
        color: CustomColors.textLight,
        opacity: 0.6,
    },
    badge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: `${CustomColors.warning}26`,
        borderWidth: 1,
        borderColor: `${CustomColors.warning}59`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '800',
        color: CustomColors.warning,
    },
});
