import React, { useEffect, useState, useRef, useCallback, useReducer } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { CustomColors } from "@/constants/CustomColors";
import { DeliveryItemAdapter } from "@/interfaces/delivery/deliveryAdapters";
import { IDeliveryStatus } from "@/interfaces/delivery/deliveryStatus";
import { useRouteContext } from "@/contexts/RouteContext";
import RouteInfoPanel from "@/components/RouteInfoPanel";
import AssignmentDetailsModal from "@/components/AssignmentDetailsModal";
import GroupStatusUpdateModal from "@/components/status-update/GroupStatusUpdateModal";
import { styles } from "@/components/trip-map-screen/tripMapStyles";
import { Coordinate } from "@/components/trip-map-screen/types";
import { useTripDerivedData } from "@/components/trip-map-screen/hooks/useTripDerivedData";
import { useTripModals } from "@/components/trip-map-screen/hooks/useTripModals";
import { useGroupProgressHandlers, progressionReducer, type ProgressionState } from "@/components/trip-map-screen/hooks/useGroupProgressHandlers";
import { useMapCommunication } from "@/components/trip-map-screen/hooks/useMapCommunication";
import { useSocketRouteUpdates } from "@/components/trip-map-screen/hooks/useSocketRouteUpdates";
import { useRouteDeviation } from "@/components/trip-map-screen/hooks/useRouteDeviation";
import { useGpsTracking } from "@/components/trip-map-screen/hooks/useGpsTracking";
import { useSimulation } from "@/components/trip-map-screen/hooks/useSimulation";
import { useTripRouteSync } from "@/components/trip-map-screen/hooks/useTripRouteSync";
import TripMapView from "@/components/trip-map-screen/components/TripMapView";
import MapControls from "@/components/trip-map-screen/components/MapControls";
import SimulationControls from "@/components/trip-map-screen/components/SimulationControls";
import CenterLocationButton from "@/components/trip-map-screen/components/CenterLocationButton";
import TripMapLoadingState from "@/components/trip-map-screen/components/TripMapLoadingState";
import TripMapErrorState from "@/components/trip-map-screen/components/TripMapErrorState";
import ElementsBottomSheet from "@/components/ElementsBottomSheet";
import type { ElementsBottomSheetMethods } from "@/components/ElementsBottomSheet";
import { Ionicons } from "@expo/vector-icons";
import { useDelivery } from "@/context/DeliveryContext";

export default function TripMapScreen() {
  const {
    tripData,
    tripLoading,
    tripError,
    tripDeliveries,
    startRoutes,
    recalculateRoutesViaBackend,
    setTripDeliveries,
  } = useRouteContext();

  const { allDeliveries } = useDelivery();

  // ===== Bottom Sheet =====
  const bottomSheetRef = useRef<ElementsBottomSheetMethods>(null);

  const handleOpenSheet = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleCloseSheet = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  // ===== Derived data from tripData =====
  const { groupedWaypoints, routeCoordinates, totalDistance, totalDuration } =
    useTripDerivedData(tripData, tripDeliveries);

  // ===== Waypoint progression =====
  const initialProgression: ProgressionState = {
    currentTargetGroupIndex: 0,
    completedDeliveryIds: new Set(),
    deliveryStatusOverrides: new Map(),
  };
  const [progression, dispatch] = useReducer(progressionReducer, initialProgression);

  // Reset progression state when trip data changes
  const tripDataRef = useRef(tripData);
  useEffect(() => {
    if (tripData !== tripDataRef.current) {
      // Compute the correct starting index: find first group with non-terminal delivery
      let startIndex = 0;
      if (groupedWaypoints.length > 0) {
        for (let i = 0; i < groupedWaypoints.length; i++) {
          const group = groupedWaypoints[i];
          const hasNonTerminal = group.deliveries?.some(
            (d) => {
              const status = progression.deliveryStatusOverrides.get(d.id) ?? d.deliveryStatus?.title;
              return status !== IDeliveryStatus.DELIVERED &&
                     status !== IDeliveryStatus.CANCELLED &&
                     status !== IDeliveryStatus.RETURNED &&
                     status !== IDeliveryStatus.SCHEDULED;
            }
          );
          if (hasNonTerminal) {
            startIndex = i;
            break;
          }
          // If all deliveries in this group are terminal, check next group
          if (i === groupedWaypoints.length - 1) {
            startIndex = groupedWaypoints.length - 1;
          }
        }
      }
      dispatch({ type: "RESET", startIndex });
      tripDataRef.current = tripData;
    }
  }, [tripData, groupedWaypoints]);

  // ----- Modal state -----
  const {
    groupStatusModalVisible,
    groupStatusModalParams,
    assignmentModalVisible,
    selectedAssignment,
    handleMarkerClick,
    handleMarkerClickByDeliveryId,
    setGroupStatusModalVisible,
    setGroupStatusModalParams,
    setSelectedAssignment,
    setAssignmentModalVisible,
  } = useTripModals(groupedWaypoints, tripDeliveries);

  // ----- Position tracking state -----
  const [isTraveling, setIsTraveling] = useState<boolean>(false);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [remainingDistance, setRemainingDistance] = useState<number>(0);
  const [remainingDuration, setRemainingDuration] = useState<number>(0);

  // ----- Refs for stale closures -----
  const recalculateRef = useRef(recalculateRoutesViaBackend);
  useEffect(() => {
    recalculateRef.current = recalculateRoutesViaBackend;
  });

  const routeCoordinatesRef = useRef<Coordinate[]>([]);
  const totalDistanceRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(0);
  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
    totalDistanceRef.current = totalDistance;
    totalDurationRef.current = totalDuration;
  }, [routeCoordinates, totalDistance, totalDuration]);

  // ===== Handlers =====

  const { handleProgressGroup, handleGroupCompleted } = useGroupProgressHandlers({
    progression,
    dispatch,
    setIsTraveling,
    setTripDeliveries,
    groupedWaypoints,
    tripDeliveries,
    setGroupStatusModalParams,
    setGroupStatusModalVisible,
  });

  // ===== Hooks =====

  const { webViewRef, mapVersion, sendToMap, handleWebViewMessage } = useMapCommunication(
    handleMarkerClick,
    handleMarkerClickByDeliveryId,
  );

  useSocketRouteUpdates(recalculateRef);

  const { detectRouteDeviation, recalculateRouteOnDeviation } = useRouteDeviation(recalculateRef);

  useGpsTracking({
    sendToMap,
    routeCoordinates,
    totalDistance,
    totalDuration,
    groupedWaypoints,
    isTraveling,
    recalculateRef,
    routeCoordinatesRef,
    totalDistanceRef,
    totalDurationRef,
    onPositionUpdate: setCurrentPosition,
    onIndexUpdate: setCurrentIndex,
    onRemainingUpdate: useCallback((d: number, t: number) => {
      setRemainingDistance(d);
      setRemainingDuration(t);
    }, []),
    onDestinationReached: useCallback(() => setIsTraveling(false), []),
    detectRouteDeviation,
    recalculateRouteOnDeviation,
  });

  const { isManualSimulation, setIsManualSimulation } = useSimulation({
    sendToMap,
    routeCoordinates,
    totalDistance,
    totalDuration,
    onPositionUpdate: setCurrentPosition,
    onIndexUpdate: setCurrentIndex,
    onRemainingUpdate: useCallback((d: number, t: number) => {
      setRemainingDistance(d);
      setRemainingDuration(t);
    }, []),
  });

  useTripRouteSync({
    mapVersion,
    sendToMap,
    routeCoordinates,
    groupedWaypoints,
    currentPosition,
    currentIndex,
    isTraveling,
    currentTargetGroupIndex: progression.currentTargetGroupIndex,
  });

  // Auto-start routes when GPS position is ready and we have deliveries but no tripData
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (hasAutoStartedRef.current || tripData || tripLoading || !currentPosition || !allDeliveries || allDeliveries.length === 0) {
      return;
    }

    hasAutoStartedRef.current = true;
    console.log("[TripMapScreen] GPS listo, ejecutando startRoutes...");
    startRoutes(allDeliveries, currentPosition).catch((err) => {
      console.log("[TripMapScreen] Auto-start routes failed:", err);
      // No reset hasAutoStartedRef — prevent infinite retry loop
    });
  }, [currentPosition, tripData, tripLoading, allDeliveries, startRoutes]);

  // ===== Effects =====

  // Initial GPS position: getLastKnownPositionAsync for instant, then getCurrentPositionAsync for accurate
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[TripMapScreen][DEBUG] inicial: permiso de ubicación no concedido");
          return;
        }
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && lastKnown.coords) {
          if (lastKnown.coords.latitude == null || lastKnown.coords.longitude == null) {
            console.log("[TripMapScreen][DEBUG] inicial: lastKnown coords inválidas", JSON.stringify(lastKnown.coords));
          } else {
            setCurrentPosition({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
          }
        } else {
          console.log("[TripMapScreen][DEBUG] inicial: lastKnownPosition null");
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!location || !location.coords) {
          console.log("[TripMapScreen][DEBUG] inicial: getCurrentPositionAsync devolvió location null", location);
          return;
        }
        if (location.coords.latitude == null || location.coords.longitude == null) {
          console.log("[TripMapScreen][DEBUG] inicial: current position coords inválidas", JSON.stringify(location.coords));
        }
        setCurrentPosition({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (err) {
        console.log("[TripMapScreen][DEBUG] inicial: error obteniendo posición GPS", err);
      }
    })();
  }, []);

  // Initialize remaining distance/duration when trip data changes
  useEffect(() => {
    if (tripData?.trips?.[0]) {
      const trip = tripData.trips[0];
      setRemainingDistance(trip.distance);
      setRemainingDuration(trip.duration);
    }
  }, [tripData]);

  // ===== Render =====

  if (tripLoading && !tripData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <TripMapLoadingState />
          <ElementsBottomSheet ref={bottomSheetRef} />
        </View>
      </SafeAreaView>
    );
  }

  if (tripError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <TripMapErrorState message={tripError} />
          <ElementsBottomSheet ref={bottomSheetRef} />
          {/* FAB for Elements sheet */}
          <Pressable style={fabStyles.fab} onPress={handleOpenSheet}>
            <Ionicons name="list" size={24} color={CustomColors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!tripData || groupedWaypoints.length === 0) {
    console.log("[TripMapScreen][DEBUG] render: sin datos - tripData:", !!tripData, "groupedWaypoints:", groupedWaypoints.length);
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <TripMapView webViewRef={webViewRef} onMessage={handleWebViewMessage} />

          <CenterLocationButton
            currentPosition={currentPosition}
            onCenter={() => {
              if (!currentPosition) return;
              sendToMap({
                type: "SET_VIEW",
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude,
                zoom: 16,
              });
            }}
          />

          <ElementsBottomSheet ref={bottomSheetRef} />
          <Pressable style={fabStyles.fab} onPress={handleOpenSheet}>
            <Ionicons name="list" size={24} color={CustomColors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Determine current group status for the control button
  const safeIndex = Math.min(progression.currentTargetGroupIndex, Math.max(0, groupedWaypoints.length - 1));
  const currentGroup = groupedWaypoints[safeIndex];
  if (!currentGroup) {
    console.log("[TripMapScreen][DEBUG] render: currentGroup null para index", safeIndex, "total grupos:", groupedWaypoints.length);
  }
  if (currentGroup && (!currentGroup.deliveries || currentGroup.deliveries.length === 0)) {
    console.log("[TripMapScreen][DEBUG] render: currentGroup.deliveries vacío para index", safeIndex);
  }

  const currentGroupStatus = currentGroup
    ? (progression.deliveryStatusOverrides.get(currentGroup.deliveries?.[0]?.id) ??
      currentGroup.deliveries?.[0]?.deliveryStatus?.title)
    : null;
  const hasAssignments = tripDeliveries.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <TripMapView webViewRef={webViewRef} onMessage={handleWebViewMessage} />

        <CenterLocationButton
          currentPosition={currentPosition}
          onCenter={() => {
            if (!currentPosition) return;
            sendToMap({
              type: "SET_VIEW",
              latitude: currentPosition.latitude,
              longitude: currentPosition.longitude,
              zoom: 16,
            });
          }}
        />

        {__DEV__ && routeCoordinates.length > 0 && (
          <SimulationControls
            isManualSimulation={isManualSimulation}
            onToggle={() => setIsManualSimulation(!isManualSimulation)}
          />
        )}

        <Pressable
          style={styles.refreshAssignmentsButton}
          onPress={() => {
            if (allDeliveries && allDeliveries.length > 0 && currentPosition) {
              startRoutes(allDeliveries, currentPosition);
            }
          }}
          disabled={!allDeliveries || allDeliveries.length === 0 || !currentPosition || tripLoading}
        >
          <Text style={styles.refreshAssignmentsButtonText}>🔄</Text>
        </Pressable>

        <View style={styles.controlsContainer}>
          <MapControls
            currentGroupStatus={currentGroupStatus}
            hasAssignments={hasAssignments}
            isDisabled={!currentGroup || !hasAssignments}
            onPress={() => currentGroup && handleProgressGroup(currentGroup.deliveries)}
          />
        </View>

        <RouteInfoPanel
          pointsCount={groupedWaypoints.length}
          totalDistance={totalDistance}
          totalDuration={totalDuration}
          isTraveling={isTraveling}
          remainingDistance={remainingDistance}
          remainingDuration={remainingDuration}
        />

        {/* FAB for Elements sheet */}
        <Pressable style={fabStyles.fab} onPress={handleOpenSheet}>
          <Ionicons name="list" size={24} color={CustomColors.white} />
        </Pressable>

        {/* Elements Bottom Sheet */}
        <ElementsBottomSheet ref={bottomSheetRef} />

        {tripLoading && tripData && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={CustomColors.primary} />
          </View>
        )}

        <AssignmentDetailsModal
          visible={assignmentModalVisible && !!selectedAssignment}
          onClose={() => {
            if (!selectedAssignment) {
              console.log("[TripMapScreen][DEBUG] assignmentModal: cerrando sin selectedAssignment");
            }
            setAssignmentModalVisible(false);
            setSelectedAssignment(null);
          }}
          assignment={selectedAssignment ?? ({} as DeliveryItemAdapter)}
          allAssignments={tripDeliveries}
        />

        {groupStatusModalParams && (
          <GroupStatusUpdateModal
            key={groupStatusModalParams.currentStatus}
            visible={groupStatusModalVisible}
            onClose={() => setGroupStatusModalVisible(false)}
            onSuccess={(newStatus: string, freshDeliveries: DeliveryItemAdapter[]) =>
              handleGroupCompleted(groupStatusModalParams.ids, newStatus, freshDeliveries)
            }
            ids={groupStatusModalParams.ids}
            assignmentType={groupStatusModalParams.assignmentType}
            groupTitle={groupStatusModalParams.groupTitle}
            currentStatus={groupStatusModalParams.currentStatus}
            totalAmount={groupStatusModalParams.totalAmount}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const fabStyles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 220,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CustomColors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: CustomColors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
});
