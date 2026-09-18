import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CustomColors } from '@/constants/CustomColors';
import { DriverEarnings } from '@/core/actions/ganancias-actions';
import { formatMoney } from '@/utils/currency';

interface EarningsCardProps {
    earnings?: DriverEarnings | null;
    deliveries?: number | null;
    isLoading?: boolean;
}

const EarningsCard = ({ earnings, deliveries, isLoading = false }: EarningsCardProps) => {
    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    useEffect(() => {
        fadeAnim.value = withTiming(1, { duration: 700 });
        slideAnim.value = withTiming(0, { duration: 700 });
    }, []);

    return (
        <Animated.View style={[styles.wrapper, animatedStyle]}>
            <View style={styles.card}>
                <View style={styles.topRow}>
                    <View>
                        <Text style={styles.label}>GANANCIAS ESTA SEMANA</Text>
                        {isLoading ? (
                            <ActivityIndicator color={CustomColors.primary} style={{ marginTop: 8 }} />
                        ) : (
                            <>
                                <Text style={styles.amount}>{earnings ? formatMoney(earnings.weekTotal) : '—'}</Text>
                                {deliveries != null && (
                                    <Text style={styles.subAmount}>{deliveries} entregas esta semana</Text>
                                )}
                            </>
                        )}
                    </View>                  
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Este mes</Text>
                        {isLoading ? (
                            <ActivityIndicator color={CustomColors.primary} size="small" />
                        ) : (
                            <Text style={styles.statValue}>{earnings ? formatMoney(earnings.monthTotal) : '—'}</Text>
                        )}
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Pagos Procesados</Text>
                        <View style={styles.payRow}>
                            <Ionicons name="document-text-outline" size={13} color={CustomColors.primary} />
                            <Text style={[styles.statValue, { marginLeft: 5 }]}>
                                {isLoading ? '…' : (earnings?.invoiceCount ?? 0)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

export default EarningsCard;

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: 2,
        marginBottom: 16,
        borderRadius: 20,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
    },
    card: {
        borderRadius: 20,
        padding: 24,
        backgroundColor: CustomColors.backgroundDark,
        borderWidth: 1,
        borderColor: CustomColors.divider,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        marginBottom: 22,
    },
    label: {
        fontSize: 11,
        color: CustomColors.textLight,
        opacity: 0.6,
        letterSpacing: 1.4,
        marginBottom: 6,
    },
    amount: {
        fontSize: 36,
        fontWeight: '800',
        color: CustomColors.textLight,
        letterSpacing: -1,
        textAlign: 'center',
    },
    subAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: CustomColors.textLight,
        opacity: 0.8,
        textAlign: 'center',
        marginTop: 4,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: `${CustomColors.success}26`,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '600',
        color: CustomColors.success,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: CustomColors.divider,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    separator: {
        width: 1,
        height: 36,
        backgroundColor: CustomColors.divider,
    },
    statLabel: {
        fontSize: 11,
        color: CustomColors.textLight,
        opacity: 0.5,
        marginBottom: 5,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '700',
        color: CustomColors.textLight,
    },
    payRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

// const EarningsCard = () => {
//     const fadeAnim = useRef(new Animated.Value(0)).current;
//     const slideAnim = useRef(new Animated.Value(30)).current;
//     const progressAnim = useRef(new Animated.Value(0)).current;

//     useEffect(() => {
//         Animated.parallel([
//             Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
//             Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
//         ]).start();
//         Animated.sequence([
//             Animated.delay(500),
//             Animated.timing(progressAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
//         ]).start();
//     }, []);

//     const progressWidth = progressAnim.interpolate({
//         inputRange: [0, 1],
//         outputRange: ['0%', `${Math.round(PROGRESS * 100)}%`],
//     });

//     return (
//         <Animated.View style={[styles.wrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
//             <View style={styles.card}>
//                 <View style={styles.topRow}>
//                     <View>
//                         <Text style={styles.label}>GANANCIAS ESTA SEMANA</Text>
//                         <Text style={styles.amount}>RD$ 5,640</Text>
//                     </View>
//                     <View style={styles.trendBadge}>
//                         <Ionicons name="trending-up" size={14} color="#059669" />
//                         <Text style={styles.trendText}>+8%</Text>
//                     </View>
//                 </View>

//                 <View style={styles.progressSection}>
//                     <View style={styles.progressHeader}>
//                         <Text style={styles.progressLabel}>Progreso semanal · Meta RD$ 8,000</Text>
//                         <Text style={styles.progressPct}>{Math.round(PROGRESS * 100)}%</Text>
//                     </View>
//                     <View style={styles.progressBg}>
//                         <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
//                     </View>
//                 </View>

//                 <View style={styles.statsRow}>
//                     <View style={styles.statItem}>
//                         <Text style={styles.statLabel}>Este mes</Text>
//                         <Text style={styles.statValue}>RD$ 22,180</Text>
//                     </View>
//                     <View style={styles.separator} />
//                     <View style={styles.statItem}>
//                         <Text style={styles.statLabel}>Próximo pago</Text>
//                         <View style={styles.payRow}>
//                             <Ionicons name="calendar-outline" size={13} color={CustomColors.primary} />
//                             <Text style={[styles.statValue, { marginLeft: 5 }]}>Viernes</Text>
//                         </View>
//                     </View>
//                 </View>
//             </View>
//         </Animated.View>
//     );
// };

// export default EarningsCard;

// const styles = StyleSheet.create({
//     wrapper: {
//         marginHorizontal: 20,
//         marginBottom: 16,
//         borderRadius: 20,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 4 },
//         shadowOpacity: 0.08,
//         shadowRadius: 12,
//         elevation: 4,
//     },
//     card: {
//         borderRadius: 20,
//         padding: 24,
//         backgroundColor: CustomColors.backgroundDark,
//         borderWidth: 1,
//         borderColor: CustomColors.divider,
//     },
//     topRow: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'flex-start',
//         marginBottom: 22,
//     },
//     label: {
//         fontSize: 11,
//         color: CustomColors.textLight,
//         opacity: 0.6,
//         letterSpacing: 1.4,
//         marginBottom: 6,
//     },
//     amount: {
//         fontSize: 36,
//         fontWeight: '800',
//         color: CustomColors.textLight,
//         letterSpacing: -1,
//     },
//     trendBadge: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         gap: 4,
//         backgroundColor: 'rgba(5,150,105,0.15)',
//         borderRadius: 20,
//         paddingHorizontal: 12,
//         paddingVertical: 6,
//         borderWidth: 1,
//         borderColor: 'rgba(5,150,105,0.3)',
//     },
//     trendText: {
//         fontSize: 13,
//         fontWeight: '700',
//         color: '#059669',
//     },
//     progressSection: {
//         marginBottom: 22,
//     },
//     progressHeader: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         marginBottom: 8,
//     },
//     progressLabel: {
//         fontSize: 12,
//         color: CustomColors.textLight,
//         opacity: 0.6,
//     },
//     progressPct: {
//         fontSize: 12,
//         fontWeight: '700',
//         color: CustomColors.primary,
//     },
//     progressBg: {
//         height: 8,
//         borderRadius: 4,
//         backgroundColor: CustomColors.divider,
//         overflow: 'hidden',
//     },
//     progressFill: {
//         height: '100%',
//         borderRadius: 4,
//         backgroundColor: CustomColors.primary,
//     },
//     statsRow: {
//         flexDirection: 'row',
//         alignItems: 'center',
//     },
//     statItem: {
//         flex: 1,
//     },
//     separator: {
//         width: 1,
//         height: 36,
//         backgroundColor: CustomColors.divider,
//         marginHorizontal: 16,
//     },
//     statLabel: {
//         fontSize: 12,
//         color: CustomColors.textLight,
//         opacity: 0.6,
//         marginBottom: 4,
//     },
//     statValue: {
//         fontSize: 15,
//         fontWeight: '700',
//         color: CustomColors.textLight,
//     },
//     payRow: {
//         flexDirection: 'row',
//         alignItems: 'center',
//     },
// });
