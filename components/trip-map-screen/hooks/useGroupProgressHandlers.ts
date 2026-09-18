import { useCallback } from "react";
import { DeliveryItemAdapter } from "@/interfaces/delivery/deliveryAdapters";
import { IDeliveryStatus } from "@/interfaces/delivery/deliveryStatus";
import { AssignmentType } from "@/utils/enum";
import { WaypointGroup } from "../types";

export interface ProgressionState {
  currentTargetGroupIndex: number;
  completedDeliveryIds: Set<string>;
  deliveryStatusOverrides: Map<string, string>;
}

export type ProgressionAction =
  | { type: "RESET"; startIndex?: number }
  | { type: "SET_TARGET_INDEX"; index: number }
  | { type: "ADD_COMPLETED_IDS"; ids: string[] }
  | { type: "SET_STATUS_OVERRIDES"; updater: (prev: Map<string, string>) => Map<string, string> };

export function progressionReducer(
  state: ProgressionState,
  action: ProgressionAction,
): ProgressionState {
  switch (action.type) {
    case "RESET":
      return {
        currentTargetGroupIndex: action.startIndex ?? 0,
        completedDeliveryIds: new Set(),
        deliveryStatusOverrides: new Map(),
      };
    case "SET_TARGET_INDEX":
      return { ...state, currentTargetGroupIndex: action.index };
    case "ADD_COMPLETED_IDS": {
      const next = new Set(state.completedDeliveryIds);
      action.ids.forEach((id) => next.add(id));
      return { ...state, completedDeliveryIds: next };
    }
    case "SET_STATUS_OVERRIDES":
      return { ...state, deliveryStatusOverrides: action.updater(state.deliveryStatusOverrides) };
  }
}

export interface GroupProgressHandlersResult {
  handleProgressGroup: (deliveries: DeliveryItemAdapter[]) => void;
  handleGroupCompleted: (
    ids: string[],
    newStatus: string,
    freshDeliveries: DeliveryItemAdapter[],
  ) => void;
}

export interface GroupProgressHandlersParams {
  progression: ProgressionState;
  dispatch: React.Dispatch<ProgressionAction>;
  setIsTraveling: React.Dispatch<React.SetStateAction<boolean>>;
  setTripDeliveries: (deliveries: DeliveryItemAdapter[]) => void;
  groupedWaypoints: WaypointGroup[];
  tripDeliveries: DeliveryItemAdapter[];
  setGroupStatusModalParams: React.Dispatch<React.SetStateAction<{
    ids: string[];
    assignmentType: AssignmentType;
    groupTitle: string;
    currentStatus: string;
    totalAmount: number;
  } | null>>;
  setGroupStatusModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useGroupProgressHandlers({
  progression,
  dispatch,
  setIsTraveling,
  setTripDeliveries,
  groupedWaypoints,
  tripDeliveries,
  setGroupStatusModalParams,
  setGroupStatusModalVisible,
}: GroupProgressHandlersParams): GroupProgressHandlersResult {
  const { currentTargetGroupIndex, deliveryStatusOverrides } = progression;

  const handleProgressGroup = useCallback((deliveries: DeliveryItemAdapter[]) => {
    console.log("[TripMapScreen] handleProgressGroup llamado con deliveries:", deliveries);

    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      console.log("[TripMapScreen] No se pueden progresar 0 entregas");
      return;
    }

    const first = deliveries[0];
    if (!first) {
      console.log("[TripMapScreen][DEBUG] handleProgressGroup: deliveries[0] es undefined/null");
      return;
    }

    console.log("[TripMapScreen] Progresando grupo de entregas:", deliveries);

    const type = deliveries[0].type;
    if (type == null) {
      console.log("[TripMapScreen][DEBUG] handleProgressGroup: deliveries[0].type es undefined/null");
    }
    const totalAmount = Math.ceil(deliveries.reduce(
      (sum, d) => sum + (d.deliveryCostInLocalCurrency || d.deliveryCost || 0) + (d.amountToBeCharged || 0),
      0,
    ) / 5) * 5;
    const label = type === AssignmentType.PICKUP ? "Recogida" : "Entrega";
    const client = deliveries[0].client;
    if (client == null) {
      console.log("[TripMapScreen][DEBUG] handleProgressGroup: deliveries[0].client es undefined/null");
    }
    const groupTitle =
      deliveries.length === 1
        ? `${label}: ${client}`
        : `${deliveries.length} ${label}s en este punto`;

    const firstId = deliveries[0].id;
    if (firstId == null) {
      console.log("[TripMapScreen][DEBUG] handleProgressGroup: deliveries[0].id es undefined/null");
    }
    if (!deliveries[0].deliveryStatus) {
      console.log("[TripMapScreen][DEBUG] handleProgressGroup: deliveries[0].deliveryStatus es undefined/null");
    }
    const currentStatus =
      deliveryStatusOverrides.get(firstId) ??
      deliveries[0].deliveryStatus.title;

    setGroupStatusModalParams({
      ids: deliveries.map((d) => d.id),
      assignmentType: type,
      groupTitle,
      currentStatus,
      totalAmount,
    });
    setGroupStatusModalVisible(true);
  }, [deliveryStatusOverrides, setGroupStatusModalParams, setGroupStatusModalVisible]);

  const handleGroupCompleted = useCallback((
    ids: string[],
    newStatus: string,
    freshDeliveries: DeliveryItemAdapter[],
  ) => {
    if (!Array.isArray(ids)) {
      console.log("[TripMapScreen][DEBUG] handleGroupCompleted: ids no es array", ids);
      return;
    }
    if (!newStatus) {
      console.log("[TripMapScreen][DEBUG] handleGroupCompleted: newStatus es null/undefined");
    }
    if (!Array.isArray(freshDeliveries)) {
      console.log("[TripMapScreen][DEBUG] handleGroupCompleted: freshDeliveries no es array", freshDeliveries);
      return;
    }

    dispatch({
      type: "SET_STATUS_OVERRIDES",
      updater: (prev) => {
        const next = new Map(prev);
        ids.forEach((id) => next.set(id, newStatus));
        return next;
      },
    });

    if (newStatus === IDeliveryStatus.IN_PROGRESS) {
      console.log("[TripMapScreen] Iniciando viaje (estado: EN PROGRESO)");
      setIsTraveling(true);
    }

    const filteredDeliveries = freshDeliveries.filter(
      (d) => {
        if (!d) return false;
        const isDelivery = d.type === 'DELIVERY';
        const lat = isDelivery ? d.destinyNominatimLat : d.originNominatimLat;
        const lng = isDelivery ? d.destinyNominatimLng : d.originNominatimLng;
        return lat != null && lng != null;
      },
    );
    const nullableCount = freshDeliveries.length - filteredDeliveries.length;
    if (nullableCount > 0) {
      console.log("[TripMapScreen][DEBUG] handleGroupCompleted: entregas sin coordenadas nominatim filtradas:", nullableCount);
    }
    setTripDeliveries(filteredDeliveries);

    if (filteredDeliveries.length === 0) {
      console.log("[TripMapScreen] No quedan entregas activas, mostrando mapa vacío");
      return;
    }

    const terminalStatuses: string[] = [
      IDeliveryStatus.DELIVERED,
      IDeliveryStatus.CANCELLED,
      IDeliveryStatus.RETURNED,
      IDeliveryStatus.SCHEDULED,
    ];
    if (!terminalStatuses.includes(newStatus)) return;

    dispatch({ type: "ADD_COMPLETED_IDS", ids });

    const currentGroup = groupedWaypoints[currentTargetGroupIndex];
    if (
      currentGroup?.deliveries?.every(
        (d) => d && d.id,
      ) &&
      currentTargetGroupIndex < groupedWaypoints.length - 1
    ) {
      setTimeout(() => dispatch({ type: "SET_TARGET_INDEX", index: currentTargetGroupIndex + 1 }), 0);
    }
  }, [dispatch, setIsTraveling, setTripDeliveries, groupedWaypoints, currentTargetGroupIndex]);

  return { handleProgressGroup, handleGroupCompleted };
}
