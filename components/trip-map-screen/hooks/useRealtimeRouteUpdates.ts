import { useEffect, RefObject } from "react";
import { streamService, StreamEventType } from "@/services/eventStreamService";

export function useRealtimeRouteUpdates(
  recalculateRef: RefObject<() => Promise<void>>,
): void {
  useEffect(() => {
    const handleNewAssignment = () => {
      console.log(
        "[useRealtimeRouteUpdates] Evento de ruta requerido recibido, recalculando ruta vía backend",
      );
      recalculateRef.current();
    };

    streamService.on(StreamEventType.DRIVER_ASSIGNED, handleNewAssignment);
    streamService.on(
      StreamEventType.DRIVERS_GROUP_ASSIGNED,
      handleNewAssignment,
    );
    streamService.on(StreamEventType.DELIVERY_REORDERED, handleNewAssignment);
    streamService.on(
      StreamEventType.DELIVERY_STATUS_UPDATED,
      handleNewAssignment,
    );
    streamService.on(
      StreamEventType.DELIVERY_ASSIGNMENT_UPDATED,
      handleNewAssignment,
    );
    streamService.on(StreamEventType.DELIVERY_UPDATED, handleNewAssignment);
    streamService.on(
      StreamEventType.DELIVERY_STATUS_CHANGED,
      handleNewAssignment,
    );

    return () => {
      streamService.off(StreamEventType.DRIVER_ASSIGNED, handleNewAssignment);
      streamService.off(
        StreamEventType.DRIVERS_GROUP_ASSIGNED,
        handleNewAssignment,
      );
      streamService.off(
        StreamEventType.DELIVERY_REORDERED,
        handleNewAssignment,
      );
      streamService.off(
        StreamEventType.DELIVERY_STATUS_UPDATED,
        handleNewAssignment,
      );
      streamService.off(
        StreamEventType.DELIVERY_ASSIGNMENT_UPDATED,
        handleNewAssignment,
      );
      streamService.off(
        StreamEventType.DELIVERY_UPDATED,
        handleNewAssignment,
      );
      streamService.off(
        StreamEventType.DELIVERY_STATUS_CHANGED,
        handleNewAssignment,
      );
    };
  }, [recalculateRef]);
}
