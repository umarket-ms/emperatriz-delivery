import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomColors } from '@/constants/CustomColors';
import { useAvailableDelivery } from '@/context/AvailableDeliveryContext';
import { AvailableShipmentGroupCard } from '@/components/available/AvailableShipmentGroupCard';
import { AvailableShipmentGroup } from '@/interfaces/delivery/available';

export default function AvailableScreen() {
  const {
    available,
    availableGroups,
    loading,
    refreshing,
    error,
    claimingShipmentId,
    claim,
    onRefresh,
    fetchAvailable,
  } = useAvailableDelivery();

  const handleClaim = async (shipmentId: string) => {
    const claimErrorMessage = await claim(shipmentId);
    if (claimErrorMessage) {
      Alert.alert('No se pudo reclamar', claimErrorMessage);
    } else {
      Alert.alert(
        'Envío reclamado',
        'El envío completo se agregó a tu ruta. Revisa la pestaña Ruta.',
      );
    }
  };

  const renderGroup = ({ item }: { item: AvailableShipmentGroup }) => (
    <AvailableShipmentGroupCard
      group={item}
      claiming={claimingShipmentId === item.shipmentId}
      onClaim={handleClaim}
    />
  );

  const showEmpty = !loading && !error && availableGroups.length === 0;
  const showRetry = !!error && availableGroups.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Disponibles</Text>
          <Text style={styles.headerSubtitle}>
            {availableGroups.length} envío
            {availableGroups.length !== 1 ? 's' : ''} · {available.length}{' '}
            viaje{available.length !== 1 ? 's' : ''} para reclamar
          </Text>
        </View>

        {error && availableGroups.length > 0 && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={availableGroups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.shipmentId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? null : showRetry ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{error}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => fetchAvailable()}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : showEmpty ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No hay entregas disponibles en este momento
                </Text>
                <Text style={styles.emptySubtext}>
                  Desliza hacia abajo para actualizar
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[CustomColors.secondary]}
              tintColor={CustomColors.secondary}
              progressBackgroundColor={CustomColors.backgroundDark}
            />
          }
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
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: CustomColors.error,
  },
  errorBannerText: {
    color: CustomColors.textLight,
    fontSize: 13,
  },
  list: {
    width: '100%',
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    color: CustomColors.textLight,
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptySubtext: {
    color: CustomColors.neutralLight,
    fontSize: 13,
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: CustomColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: CustomColors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});
