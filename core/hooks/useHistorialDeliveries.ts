import { useState, useEffect, useCallback } from 'react';
import { DeliveryItemAdapter } from '@/interfaces/delivery/deliveryAdapters';
import { getDeliveries } from '@/core/actions/delivery.actions';
import { IDeliveryStatus } from '@/interfaces/delivery/deliveryStatus';

export const useHistorialDeliveries = () => {
  const [deliveries, setDeliveries] = useState<DeliveryItemAdapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = async (isRefreshing = false) => {
    if (!isRefreshing) {
      setLoading(true);
    }
    setError(null);

    try {
      const allDeliveries = await getDeliveries();
      const completed = allDeliveries.filter(
        (d) => d.deliveryStatus?.title === IDeliveryStatus.DELIVERED,
      );
      setDeliveries(completed);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDeliveries(true);
  }, []);

  return { deliveries, loading, refreshing, error, onRefresh };
};
