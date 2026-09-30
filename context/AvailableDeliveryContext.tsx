import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  AvailableDeliveryItem,
  AvailableShipmentGroup,
} from '@/interfaces/delivery/available';
import {
  getAvailableDeliveries,
  claimDeliveries,
  releaseDelivery,
} from '@/core/actions/delivery.actions';
import { useAuth } from '@/context/AuthContext';
import { socketService, SocketEventType } from '@/services/websocketService';

interface AvailableDeliveryContextType {
  available: AvailableDeliveryItem[];
  /** Entregas agrupadas por envío (shipmentId) para reclamo en lote */
  availableGroups: AvailableShipmentGroup[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  claimingShipmentId: string | null;
  claimError: string | null;
  fetchAvailable: (isRefreshing?: boolean) => Promise<void>;
  onRefresh: () => void;
  /** Reclama el envío COMPLETO; devuelve null si fue exitoso o el mensaje de error */
  claim: (shipmentId: string) => Promise<string | null>;
  /** Libera una entrega propia; devuelve null si fue exitoso o el mensaje de error */
  release: (id: number) => Promise<string | null>;
  clearClaimError: () => void;
}

const AvailableDeliveryContext = createContext<
  AvailableDeliveryContextType | undefined
>(undefined);

export const useAvailableDelivery = () => {
  const context = useContext(AvailableDeliveryContext);
  if (context === undefined) {
    throw new Error(
      'useAvailableDelivery must be used within an AvailableDeliveryProvider',
    );
  }
  return context;
};

/** Agrupa los viajes disponibles por envío, con la recogida primero. */
export function groupAvailableByShipment(
  items: AvailableDeliveryItem[],
): AvailableShipmentGroup[] {
  const map = new Map<string, AvailableDeliveryItem[]>();
  for (const item of items) {
    const list = map.get(item.shipmentId);
    if (list) {
      list.push(item);
    } else {
      map.set(item.shipmentId, [item]);
    }
  }

  const groups: AvailableShipmentGroup[] = [];
  for (const [shipmentId, groupItems] of map) {
    const items = [...groupItems].sort((a, b) => a.order - b.order);
    const distances = items
      .map((item) => item.distanceMeters)
      .filter((distance): distance is number => distance !== null);
    groups.push({
      shipmentId,
      items,
      score: Math.min(...items.map((item) => item.score)),
      distanceMeters: distances.length > 0 ? Math.min(...distances) : null,
      vehicleCompatible: items.every((item) => item.vehicleCompatible),
    });
  }

  groups.sort((a, b) => b.score - a.score);
  return groups;
}

interface AvailableDeliveryProviderProps {
  children: ReactNode;
}

export const AvailableDeliveryProvider: React.FC<
  AvailableDeliveryProviderProps
> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [available, setAvailable] = useState<AvailableDeliveryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingShipmentId, setClaimingShipmentId] = useState<string | null>(
    null,
  );
  const [claimError, setClaimError] = useState<string | null>(null);

  const availableGroups = useMemo(
    () => groupAvailableByShipment(available),
    [available],
  );

  const availableRef = useRef(available);
  useEffect(() => {
    availableRef.current = available;
  }, [available]);

  const fetchAvailable = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) {
      setLoading(true);
    }
    setError(null);

    try {
      const items = await getAvailableDeliveries();
      setAvailable(items);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.log('Error al cargar entregas disponibles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    fetchAvailable();
  }, [isAuthenticated, isLoading, fetchAvailable]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailable(true);
  }, [fetchAvailable]);

  const claim = useCallback(
    async (shipmentId: string): Promise<string | null> => {
      const groupItems = availableRef.current.filter(
        (item) => item.shipmentId === shipmentId,
      );
      if (groupItems.length === 0) {
        return 'Este envío ya no está disponible';
      }

      setClaimingShipmentId(shipmentId);
      setClaimError(null);
      try {
        await claimDeliveries(groupItems.map((item) => item.id));
        setAvailable((current) =>
          current.filter((item) => item.shipmentId !== shipmentId),
        );
        return null;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'No se pudo reclamar el envío';
        setClaimError(errorMessage);
        return errorMessage;
      } finally {
        setClaimingShipmentId(null);
      }
    },
    [],
  );

  const release = useCallback(
    async (id: number): Promise<string | null> => {
      setClaimingShipmentId(
        availableRef.current.find((item) => item.id === id)?.shipmentId ??
          null,
      );
      setClaimError(null);
      try {
        await releaseDelivery(id);
        setAvailable((current) => current.filter((item) => item.id !== id));
        await fetchAvailable(true);
        return null;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'No se pudo liberar la entrega';
        setClaimError(errorMessage);
        return errorMessage;
      } finally {
        setClaimingShipmentId(null);
      }
    },
    [fetchAvailable],
  );

  const clearClaimError = useCallback(() => {
    setClaimError(null);
  }, []);

  // Wire socket events: refresh the pool when our route changes or we get
  // assigned (también cuando otro mensajero reclama y el backend nos avisa)
  const fetchAvailableRef = useRef(fetchAvailable);

  useEffect(() => {
    fetchAvailableRef.current = fetchAvailable;
  }, [fetchAvailable]);

  useEffect(() => {
    const onDriverAssigned = () => {
      void fetchAvailableRef.current(true);
    };
    const onDeliveryReordered = () => {
      void fetchAvailableRef.current(true);
    };

    socketService.on(SocketEventType.DRIVER_ASSIGNED, onDriverAssigned);
    socketService.on(SocketEventType.DELIVERY_REORDERED, onDeliveryReordered);

    return () => {
      socketService.off(SocketEventType.DRIVER_ASSIGNED, onDriverAssigned);
      socketService.off(SocketEventType.DELIVERY_REORDERED, onDeliveryReordered);
    };
  }, []);

  const value: AvailableDeliveryContextType = {
    available,
    availableGroups,
    loading,
    refreshing,
    error,
    claimingShipmentId,
    claimError,
    fetchAvailable,
    onRefresh,
    claim,
    release,
    clearClaimError,
  };

  return (
    <AvailableDeliveryContext.Provider value={value}>
      {children}
    </AvailableDeliveryContext.Provider>
  );
};
