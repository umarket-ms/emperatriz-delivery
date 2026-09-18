import { useEffect, useRef } from "react";
import { Coordinate, WaypointGroup } from "../types";

export interface UseTripRouteSyncParams {
  mapVersion: number;
  sendToMap: (data: object) => void;
  routeCoordinates: Coordinate[];
  groupedWaypoints: WaypointGroup[];
  currentPosition: Coordinate | null;
  currentIndex: number;
  isTraveling: boolean;
  currentTargetGroupIndex: number;
}

export function useTripRouteSync(params: UseTripRouteSyncParams): void {
  const {
    mapVersion,
    sendToMap,
    routeCoordinates,
    groupedWaypoints,
    currentPosition,
    currentIndex,
    isTraveling,
    currentTargetGroupIndex,
  } = params;

  const sendToMapRef = useRef(sendToMap);
  useEffect(() => { sendToMapRef.current = sendToMap; }, [sendToMap]);

  // INIT_ROUTE
  useEffect(() => {
    if (mapVersion === 0) {
      console.log(
        "[useTripRouteSync][DEBUG] route sync: mapVersion es 0, skipping",
      );
      return;
    }
    if (groupedWaypoints.length === 0) {
      sendToMapRef.current({
        type: "INIT_ROUTE",
        segmentCoordinates: [],
        waypoints: [],
      });
      if (currentPosition) {
        sendToMapRef.current({
          type: "SET_VIEW",
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          zoom: 15,
        });
      }
      return;
    }
    if (routeCoordinates.length === 0) {
      console.log(
        "[useTripRouteSync][DEBUG] route sync: routeCoordinates vacío, skipping",
      );
      return;
    }

    const waypoints = groupedWaypoints.map((g, idx) => {
      if (!g.coordinate) {
        console.log(
          "[useTripRouteSync][DEBUG] route sync: group.coordinate null en index",
          idx,
        );
      }
      if (!g.deliveries || g.deliveries.length === 0) {
        console.log(
          "[useTripRouteSync][DEBUG] route sync: group.deliveries vacío en index",
          idx,
        );
      }
      return {
        position: idx + 1,
        latitude: g.coordinate?.latitude,
        longitude: g.coordinate?.longitude,
        count: g.count,
        type: g.type,
        isFirstInRoute: g.isFirstInRoute,
        isLastInRoute: g.isLastInRoute,
        deliveryId: g.deliveries?.[0]?.id,
      };
    });

    const segmentCoordinates: number[][][] = [];
    let lastIdx = 0;
    groupedWaypoints.forEach((group) => {
      if (!group.coordinate) {
        console.log(
          "[useTripRouteSync][DEBUG] segment building: group.coordinate null, saltando segmento",
        );
        return;
      }
      let minDist = Infinity;
      let nearestIdx = lastIdx;
      for (let i = lastIdx; i < routeCoordinates.length; i++) {
        const rc = routeCoordinates[i];
        if (!rc) {
          console.log(
            "[useTripRouteSync][DEBUG] segment building: routeCoordinates[" +
              i +
              "] es null",
          );
          continue;
        }
        const dLat = rc.latitude - group.coordinate.latitude;
        const dLng = rc.longitude - group.coordinate.longitude;
        const d = dLat * dLat + dLng * dLng;
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      }
      segmentCoordinates.push(
        routeCoordinates
          .slice(lastIdx, nearestIdx + 1)
          .map((c) => [c.latitude, c.longitude]),
      );
      lastIdx = nearestIdx;
    });

    if (segmentCoordinates.length > 0 && lastIdx < routeCoordinates.length - 1) {
      routeCoordinates.slice(lastIdx + 1).forEach((c) =>
        segmentCoordinates[segmentCoordinates.length - 1].push([
          c.latitude,
          c.longitude,
        ]),
      );
    }

    sendToMapRef.current({
      type: "INIT_ROUTE",
      segmentCoordinates,
      waypoints,
      targetGroupIndex: currentTargetGroupIndex,
    });
  }, [mapVersion, routeCoordinates, groupedWaypoints, currentTargetGroupIndex, currentPosition]);

  // UPDATE_POSITION
  useEffect(() => {
    if (mapVersion === 0 || !currentPosition) return;
    sendToMapRef.current({
      type: "UPDATE_POSITION",
      latitude: currentPosition.latitude,
      longitude: currentPosition.longitude,
    });
  }, [mapVersion, currentPosition]);

  // UPDATE_TRAVELED
  useEffect(() => {
    if (mapVersion === 0 || !isTraveling || currentIndex === 0) return;
    const traveledCoords = routeCoordinates
      .slice(0, currentIndex + 1)
      .map((c) => [c.latitude, c.longitude]);
    sendToMapRef.current({ type: "UPDATE_TRAVELED", traveledCoords });
  }, [mapVersion, currentIndex, isTraveling, routeCoordinates]);

  // UPDATE_TARGET
  useEffect(() => {
    if (mapVersion === 0) return;
    sendToMapRef.current({ type: "UPDATE_TARGET", groupIndex: currentTargetGroupIndex });
  }, [mapVersion, currentTargetGroupIndex]);
}
