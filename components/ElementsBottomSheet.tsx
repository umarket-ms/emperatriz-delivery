import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, useRef } from "react";
import {
  StyleSheet,
  Alert,
  Pressable,
  Text,
  ScrollView,
  View as RNView,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { CustomColors } from "@/constants/CustomColors";
import { useDelivery } from "@/context/DeliveryContext";
import { AssignmentType } from "@/utils/enum";
import { DeliveryItemAdapter } from "@/interfaces/delivery/deliveryAdapters";
import GroupStatusUpdateModal from "@/components/status-update/GroupStatusUpdateModal";
import { Ionicons } from "@expo/vector-icons";
import EarningsCard from "@/components/ganancias/EarningsCard";
import TopRoute from "@/components/ganancias/TopRoute";
import RecentDeliveries from "@/components/ganancias/RecentDeliveries";
import PayoutHistory from "@/components/ganancias/PayoutHistory";
import StatsCharts from "@/components/ganancias/StatsCharts";
import { DeliveryItemList } from "@/components/delivery-items/DeliveryItemList";
import { useGanancias } from "@/core/hooks/useGanancias";
import { GestionesContent } from "@/components/gestiones/GestionesContent";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const BASE_TABS = ["Entregas", "Ganancias", "Pagos", "Estadísticas"] as const;
type Tab = (typeof BASE_TABS)[number] | "Gestiones";

// ─── Segmented Control ──────────────────────────────────────────────────────
const SegmentedTabs = ({
  activeTab,
  onTabChange,
  tabs,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  tabs: readonly Tab[];
}) => {
  return (
    <RNView style={tabStyles.container}>
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1 },
            tabStyles.tab,
            activeTab === tab && tabStyles.tabActive,
          ]}
          onPress={() => onTabChange(tab)}
        >
          <Text
            style={[
              tabStyles.tabText,
              activeTab === tab && tabStyles.activeTabText,
            ]}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </RNView>
  );
};

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: CustomColors.backgroundDark,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 3,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: CustomColors.border,
  },
  indicator: {
    position: "absolute",
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 9,
    backgroundColor: CustomColors.primary,
  },
  tabActive: {
    backgroundColor: CustomColors.primary,
    borderRadius: 9,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: CustomColors.white,
    opacity: 0.5,
    textAlign: "center",
  },
  activeTabText: {
    color: CustomColors.white,
    opacity: 1,
  },
});

export interface ElementsBottomSheetMethods {
  present: () => void;
  dismiss: () => void;
}

interface ElementsBottomSheetProps {}

const ElementsBottomSheet = forwardRef<ElementsBottomSheetMethods, ElementsBottomSheetProps>(
  ({ }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("Entregas");
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const {
      deliveries,
      loading,
      refreshing,
      onRefresh,
      fetchDeliveries,
    } = useDelivery();

    const {
      earnings,
      paidInvoices,
      monthlyStats,
      weeklyStats,
      deliveryStats,
      topRoute,
      recentDeliveries,
      isLoading: gananciaLoading,
      refresh: refreshGanancias,
    } = useGanancias();

    const [groupStatusModalVisible, setGroupStatusModalVisible] = useState(false);
    const [groupStatusModalParams, setGroupStatusModalParams] = useState<{
      ids: string[];
      assignmentType: AssignmentType;
      groupTitle: string;
      currentStatus: string;
      totalAmount: number;
    } | null>(null);

    const handleDeliveryItemPress = (delivery: DeliveryItemAdapter) => {
      setGroupStatusModalParams({
        ids: [delivery.id],
        assignmentType: delivery.type,
        groupTitle: `${delivery.type === AssignmentType.PICKUP ? "Recogida" : "Entrega"}: ${delivery.client}`,
        currentStatus: delivery.deliveryStatus?.title || "",
        totalAmount: Math.ceil(Number(delivery.deliveryCostInLocalCurrency + delivery.amountToBeCharged) / 5) * 5,
      });
      setGroupStatusModalVisible(true);
    };

    const isAdmin = true;

    const visibleTabs = useMemo(() => {
      const base: Tab[] = [...BASE_TABS];
      if (isAdmin) {
        base.push("Gestiones");
      }
      return base;
    }, [isAdmin]);

    const effectiveActiveTab = visibleTabs.includes(activeTab) ? activeTab : "Entregas";

    const handleRefresh = useCallback(() => {
      fetchDeliveries();
      refreshGanancias();
    }, [fetchDeliveries, refreshGanancias]);

    const present = useCallback(() => {
      setIsVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }, [translateY]);

    const dismiss = useCallback(() => {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
      });
    }, [translateY]);

    useImperativeHandle(ref, () => ({
      present,
      dismiss,
    }), [present, dismiss]);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
          onPanResponderMove: (_, gestureState) => {
            if (gestureState.dy > 0) {
              translateY.setValue(gestureState.dy);
            }
          },
          onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dy > 150 || gestureState.vy > 0.5) {
              dismiss();
            } else {
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 4,
              }).start();
            }
          },
        }),
      [translateY, dismiss]
    );

    if (!isVisible) return null;

    return (
      <Modal transparent visible={isVisible} animationType="none" onRequestClose={dismiss}>
        <RNView style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={dismiss} />
          <Animated.View
            style={[
              styles.sheetContainer,
              { transform: [{ translateY }] },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Handle */}
            <RNView style={styles.handleContainer}>
              <RNView style={styles.handle} />
            </RNView>

            {/* Header */}
            <RNView style={styles.header}>
              <Text style={styles.headerTitle}>Elementos</Text>
              <Pressable style={styles.refreshButton} onPress={handleRefresh}>
                <Ionicons name="refresh-outline" size={20} color={CustomColors.white} />
              </Pressable>
            </RNView>

            <SegmentedTabs tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab} />

            {effectiveActiveTab === "Entregas" ? (
              <DeliveryItemList
                data={deliveries}
                loading={loading}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onItemPress={handleDeliveryItemPress}
                contentContainerStyle={{ paddingBottom: 120 }}
                style={{ flex: 1 }}
              />
            ) : effectiveActiveTab === "Gestiones" ? (
              <GestionesContent />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {effectiveActiveTab === "Ganancias" && (
                  <>
                    <EarningsCard earnings={earnings} deliveries={deliveryStats} isLoading={gananciaLoading} />
                    <TopRoute route={topRoute} isLoading={gananciaLoading} />
                    <RecentDeliveries items={recentDeliveries} isLoading={gananciaLoading} />
                  </>
                )}
                {effectiveActiveTab === "Pagos" && <PayoutHistory items={paidInvoices} isLoading={gananciaLoading} />}
                {effectiveActiveTab === "Estadísticas" && <StatsCharts monthlyStats={monthlyStats} weeklyStats={weeklyStats} isLoading={gananciaLoading} />}

                <RNView style={{ height: 120 }} />
              </ScrollView>
            )}

            {groupStatusModalParams && (
              <GroupStatusUpdateModal
                key={groupStatusModalParams.currentStatus}
                visible={groupStatusModalVisible}
                onClose={() => setGroupStatusModalVisible(false)}
                onSuccess={(newStatus) => {
                  setGroupStatusModalVisible(false);
                  fetchDeliveries();
                  Alert.alert("Estado actualizado", `Nuevo estado: ${newStatus}`);
                }}
                ids={groupStatusModalParams.ids}
                assignmentType={groupStatusModalParams.assignmentType}
                groupTitle={groupStatusModalParams.groupTitle}
                currentStatus={groupStatusModalParams.currentStatus}
                totalAmount={groupStatusModalParams.totalAmount}
              />
            )}
          </Animated.View>
        </RNView>
      </Modal>
    );
  }
);

ElementsBottomSheet.displayName = "ElementsBottomSheet";

export default ElementsBottomSheet;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: CustomColors.backgroundDarkest,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: CustomColors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: CustomColors.white,
    letterSpacing: -0.5,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: CustomColors.backgroundDark,
    borderWidth: 1,
    borderColor: CustomColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingTop: 20,
  },
});
