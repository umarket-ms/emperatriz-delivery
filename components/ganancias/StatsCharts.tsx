import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, interpolate } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CustomColors } from '@/constants/CustomColors';
import { MonthlyStatItem, WeeklyStatItem } from '@/core/actions/ganancias-actions';
import { formatMoney } from '@/utils/currency';

const AnimatedBar = ({ ratio, delay, color }: { ratio: number; delay: number; color: string }) => {
    const heightAnim = useSharedValue(0);

    const barStyle = useAnimatedStyle(() => ({
        height: interpolate(heightAnim.value, [0, 1], [0, 100]),
        backgroundColor: color,
    }));

    useEffect(() => {
        heightAnim.value = withDelay(delay, withTiming(ratio, { duration: 700 }));
    }, []);

    return <Animated.View style={[styles.barFill, barStyle]} />;
};

interface StatsChartsProps {
    monthlyStats?: MonthlyStatItem[];
    weeklyStats?: WeeklyStatItem[];
    isLoading?: boolean;
}

const EMPTY_MONTHLY: MonthlyStatItem[] = [];
const EMPTY_WEEKLY: WeeklyStatItem[] = [];

const StatsCharts = ({ monthlyStats = EMPTY_MONTHLY, weeklyStats = EMPTY_WEEKLY, isLoading = false }: StatsChartsProps) => {
    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    useEffect(() => {
        fadeAnim.value = withTiming(1, { duration: 600 });
        slideAnim.value = withTiming(0, { duration: 600 });
    }, []);

    const maxMonthly = monthlyStats.length > 0 ? Math.max(...monthlyStats.map((d) => d.value)) : 1;
    const maxWeekly = weeklyStats.length > 0 ? Math.max(...weeklyStats.map((d) => d.value)) : 1;
    const bestMonthItem = monthlyStats.length > 0
        ? monthlyStats.reduce((a, b) => (b.value > a.value ? b : a))
        : null;
    const bestDayItem = weeklyStats.length > 0
        ? weeklyStats.reduce((a, b) => (b.value > a.value ? b : a))
        : null;

    return (
        <Animated.View style={animatedStyle}>
            {/* Monthly Chart */}
            <View style={styles.chartWrapper}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Ganancias mensuales</Text>
                            <Text style={styles.subtitle}>Últimos 6 meses</Text>
                        </View>
                        <View style={[styles.iconCircle, { backgroundColor: `${CustomColors.textLight}0F` }]}>
                            <Ionicons name="stats-chart-outline" size={20} color={CustomColors.primary} />
                        </View>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator color={CustomColors.primary} style={{ marginVertical: 16 }} />
                    ) : monthlyStats.length === 0 ? (
                        <Text style={styles.emptyText}>Sin datos mensuales</Text>
                    ) : (
                        <>
                            <View style={styles.chartArea}>
                                {monthlyStats.map((item, index) => (
                                    <View key={item.month} style={styles.barGroup}>
                                        <View style={styles.barContainer}>
                                            <AnimatedBar ratio={item.value / maxMonthly} delay={80 * index} color={CustomColors.primary} />
                                        </View>
                                        <Text style={styles.barLabel}>{item.month}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.chartFooter}>
                                <Text style={styles.footerText}>
                                    Mejor mes: {bestMonthItem?.month} · {formatMoney(bestMonthItem?.value ?? 0)}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </View>

            {/* Daily Chart */}
            <View style={styles.chartWrapper}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Entregas por día</Text>
                            <Text style={styles.subtitle}>Esta semana</Text>
                        </View>
                        <View style={[styles.iconCircle, { backgroundColor: `${CustomColors.success}1A` }]}>
                            <Ionicons name="calendar-outline" size={20} color={CustomColors.success} />
                        </View>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator color={CustomColors.success} style={{ marginVertical: 16 }} />
                    ) : weeklyStats.length === 0 ? (
                        <Text style={styles.emptyText}>Sin datos esta semana</Text>
                    ) : (
                        <>
                            <View style={styles.chartArea}>
                                {weeklyStats.map((item, index) => (
                                    <View key={item.day} style={styles.barGroup}>
                                        <View style={styles.barContainer}>
                                            <AnimatedBar ratio={item.value / maxWeekly} delay={80 * index} color={CustomColors.success} />
                                        </View>
                                        <Text style={styles.barLabel}>{item.day}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.chartFooter}>
                                <Text style={styles.footerText}>
                                    Mejor día: {bestDayItem?.day} · {formatMoney(bestDayItem?.value ?? 0)}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

export default StatsCharts;

const styles = StyleSheet.create({
    chartWrapper: {
        marginHorizontal: 2,
        marginBottom: 16,
        borderRadius: 20,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
    },
    card: {
        borderRadius: 20,
        padding: 20,
        backgroundColor: CustomColors.backgroundDark,
        borderWidth: 1,
        borderColor: CustomColors.divider,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: CustomColors.textLight,
        marginBottom: 3,
    },
    subtitle: {
        fontSize: 12,
        color: CustomColors.textLight,
        opacity: 0.6,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: CustomColors.divider,
    },
    chartArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 110,
        marginBottom: 12,
    },
    barGroup: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
    },
    barContainer: {
        width: '60%',
        height: 100,
        justifyContent: 'flex-end',
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: `${CustomColors.textLight}0D`,
        marginBottom: 6,
    },
    barFill: {
        borderRadius: 4,
        minHeight: 4,
    },
    barLabel: {
        fontSize: 10,
        color: CustomColors.textLight,
        opacity: 0.5,
        textAlign: 'center',
    },
    chartFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: CustomColors.divider,
    },
    footerText: {
        fontSize: 12,
        color: CustomColors.textLight,
        opacity: 0.6,
    },
    emptyText: {
        fontSize: 13,
        color: CustomColors.textLight,
        opacity: 0.4,
        textAlign: 'center',
        paddingVertical: 16,
    },
});
