import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomColors } from '@/constants/CustomColors';
import { useHistorialDeliveries } from '@/core/hooks/useHistorialDeliveries';
import { HistorialList } from '@/components/historial/HistorialList';

export default function HistorialScreen() {
  const { deliveries, loading, refreshing, onRefresh } = useHistorialDeliveries();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Historial</Text>
          <Text style={styles.headerSubtitle}>
            {deliveries.length} viaje{deliveries.length !== 1 ? 's' : ''} completado{deliveries.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <HistorialList
          data={deliveries}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
        />
      </View>
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
    backgroundColor: CustomColors.backgroundDarkest,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: CustomColors.backgroundDarkest,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: CustomColors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: CustomColors.neutralLight,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
});
