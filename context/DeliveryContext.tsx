import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { DeliveryItemAdapter } from '@/interfaces/delivery/deliveryAdapters';
import { getDeliveries } from '@/core/actions/delivery.actions';
import { useAuth } from '@/context/AuthContext';
import { socketService, SocketEventType } from '@/services/websocketService';

interface DeliveryContextType {
    deliveries: DeliveryItemAdapter[];
    allDeliveries: DeliveryItemAdapter[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    fetchDeliveries: (isRefreshing?: boolean) => Promise<void>;
    onRefresh: () => void;
    handleDeliveryUpdated: (data: DeliveryItemAdapter) => void;
    handleDeliveryAssigned: (data: DeliveryItemAdapter) => void;
    handleDeliveryReordered: (data: DeliveryItemAdapter) => void;
    updateLocalDeliveryStatus: (deliveryId: string, newStatus: string) => void;
    handleDriversGroupAssigned: (data: DeliveryItemAdapter[]) => void;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

export const useDelivery = () => {
    const context = useContext(DeliveryContext);
    if (context === undefined) {
        throw new Error('useDelivery must be used within a DeliveryProvider');
    }
    return context;
};

interface DeliveryProviderProps {
    children: ReactNode;
}

export const DeliveryProvider: React.FC<DeliveryProviderProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const [deliveries, setDeliveries] = useState<DeliveryItemAdapter[]>([]);
    const [allDeliveries, setAllDeliveries] = useState<DeliveryItemAdapter[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const upsertById = useCallback(
        (currentDeliveries: DeliveryItemAdapter[], incomingDeliveries: DeliveryItemAdapter[]) => {
            const deliveriesMap = new Map(
                currentDeliveries.map((delivery) => [delivery.id, delivery])
            );

            incomingDeliveries.forEach((delivery) => {
                deliveriesMap.set(delivery.id, delivery);
            });

            return Array.from(deliveriesMap.values());
        },
        [],
    );

    useEffect(() => {
        const init = async () => {
            if (isLoading) return;
            if (!isAuthenticated) {
                setLoading(false);
                setRefreshing(false);
                return;
            }
            fetchDeliveries();
        };
        init();
    }, [isAuthenticated, isLoading]);

    const fetchDeliveries = async (isRefreshing = false) => {
        if (!isRefreshing) {
            setLoading(true);
        }
        setError(null);

        try {
            const deliveriesData = await getDeliveries();

            setAllDeliveries(deliveriesData);
            setDeliveries(deliveriesData);
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMessage);
            console.log('Error al cargar entregas 2:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDeliveries(true);
    };

    const handleDeliveryUpdated = (data: DeliveryItemAdapter) => {
        const update = (list: DeliveryItemAdapter[]) =>
            list.map((d) => (d.id === data.id ? data : d));

        setDeliveries(update);
        setAllDeliveries(update);
    };

    const handleDeliveryAssigned = (_data: DeliveryItemAdapter) => {
        // Refrescar desde la API para obtener la lista completa y ordenada del mensajero
        fetchDeliveries();
    };

    const handleDriversGroupAssigned = (data: DeliveryItemAdapter[]) => {
        // Reemplazar toda la lista con la recibida (ya viene completa y ordenada desde el backend)
        setDeliveries(data);
        setAllDeliveries(data);
    };

    const handleDeliveryReordered = (_data: DeliveryItemAdapter) => {
        fetchDeliveries();
    };

    // Función para actualizar el estado local de una entrega (para uso del modal)
    const updateLocalDeliveryStatus = (deliveryId: string, newStatus: string) => {
        const update = (list: DeliveryItemAdapter[]) =>
            list.map((d) => {
                if (d.id !== deliveryId) return d;
                return { ...d, deliveryStatus: { ...d.deliveryStatus, title: newStatus as any } };
            });
        setDeliveries(update);
        setAllDeliveries(update);
    };

    // Wire socket events to keep allDeliveries in sync
    const handleDeliveryAssignedRef = useRef(handleDeliveryAssigned);
    const handleDriversGroupAssignedRef = useRef(handleDriversGroupAssigned);
    const handleDeliveryUpdatedRef = useRef(handleDeliveryUpdated);
    const handleDeliveryReorderedRef = useRef(handleDeliveryReordered);

    useEffect(() => {
      handleDeliveryAssignedRef.current = handleDeliveryAssigned;
      handleDriversGroupAssignedRef.current = handleDriversGroupAssigned;
      handleDeliveryUpdatedRef.current = handleDeliveryUpdated;
      handleDeliveryReorderedRef.current = handleDeliveryReordered;
    });

    useEffect(() => {
      const onDriverAssigned = (data: DeliveryItemAdapter) => {
        handleDeliveryAssignedRef.current(data);
      };
      const onDriversGroupAssigned = (data: DeliveryItemAdapter[]) => {
        handleDriversGroupAssignedRef.current(data);
      };
      const onDeliveryUpdated = (data: DeliveryItemAdapter) => {
        handleDeliveryUpdatedRef.current(data);
      };
      const onDeliveryReordered = (data: DeliveryItemAdapter) => {
        handleDeliveryReorderedRef.current(data);
      };

      socketService.on(SocketEventType.DRIVER_ASSIGNED, onDriverAssigned);
      socketService.on(SocketEventType.DRIVERS_GROUP_ASSIGNED, onDriversGroupAssigned);
      socketService.on(SocketEventType.DELIVERY_UPDATED, onDeliveryUpdated);
      socketService.on(SocketEventType.DELIVERY_REORDERED, onDeliveryReordered);

      return () => {
        socketService.off(SocketEventType.DRIVER_ASSIGNED, onDriverAssigned);
        socketService.off(SocketEventType.DRIVERS_GROUP_ASSIGNED, onDriversGroupAssigned);
        socketService.off(SocketEventType.DELIVERY_UPDATED, onDeliveryUpdated);
        socketService.off(SocketEventType.DELIVERY_REORDERED, onDeliveryReordered);
      };
    }, []);

    const value: DeliveryContextType = {
        deliveries,
        allDeliveries,
        loading,
        refreshing,
        error,
        fetchDeliveries,
        onRefresh,
        handleDeliveryUpdated,
        handleDeliveryAssigned,
        handleDeliveryReordered,
        handleDriversGroupAssigned,
        updateLocalDeliveryStatus
    };

    return (
        <DeliveryContext.Provider value={value}>
            {children}
        </DeliveryContext.Provider>
    );
};
