import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getDriverEarnings,
  getDriverPaidInvoices,
  getDriverMonthlyStats,
  getDriverWeeklyStats,
  getDriverDeliveryStats,
  getDriverTopRoute,
  getDriverRecentDeliveries,
  DriverEarnings,
  PaidInvoice,
  MonthlyStatItem,
  WeeklyStatItem,
  DriverWeeklyStats,
  DriverTopRoute,
  RecentDeliveryItem,
} from '../actions/ganancias-actions';

interface GananciasState {
  earnings: DriverEarnings | null;
  paidInvoices: PaidInvoice[];
  monthlyStats: MonthlyStatItem[];
  weeklyStats: WeeklyStatItem[];
  deliveryStats: DriverWeeklyStats | null;
  topRoute: DriverTopRoute | null;
  recentDeliveries: RecentDeliveryItem[];
  isLoading: boolean;
  error: string | null;
}

type GananciasAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Omit<GananciasState, 'isLoading' | 'error'> }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'CLEAR' };

const initialState: GananciasState = {
  earnings: null,
  paidInvoices: [],
  monthlyStats: [],
  weeklyStats: [],
  deliveryStats: null,
  topRoute: null,
  recentDeliveries: [],
  isLoading: true,
  error: null,
};

function gananciasReducer(state: GananciasState, action: GananciasAction): GananciasState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, ...action.payload, isLoading: false, error: null };
    case 'FETCH_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'CLEAR':
      return initialState;
  }
}

export const useGanancias = () => {
  const [state, dispatch] = useReducer(gananciasReducer, initialState);
  const { isAuthenticated } = useAuth();
  const wasAuthenticatedRef = useRef(false);

  const fetchData = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const [
        earningsData,
        paidInvoicesData,
        monthlyData,
        weeklyData,
        deliveryStatsData,
        topRouteData,
        recentDeliveriesData,
      ] = await Promise.all([
        getDriverEarnings(),
        getDriverPaidInvoices(),
        getDriverMonthlyStats(),
        getDriverWeeklyStats(),
        getDriverDeliveryStats(),
        getDriverTopRoute(),
        getDriverRecentDeliveries(),
      ]);

      dispatch({
        type: 'FETCH_SUCCESS',
        payload: {
          earnings: earningsData,
          paidInvoices: paidInvoicesData,
          monthlyStats: monthlyData,
          weeklyStats: weeklyData,
          deliveryStats: deliveryStatsData,
          topRoute: topRouteData,
          recentDeliveries: recentDeliveriesData,
        },
      });
    } catch (err: any) {
      console.error('useGanancias fetch error', err);
      dispatch({ type: 'FETCH_ERROR', error: err instanceof Error ? err.message : 'Error loading data' });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticatedRef.current) {
      fetchData();
    } else if (!isAuthenticated) {
      dispatch({ type: 'CLEAR' });
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, fetchData]);

  return {
    earnings: state.earnings,
    paidInvoices: state.paidInvoices,
    monthlyStats: state.monthlyStats,
    weeklyStats: state.weeklyStats,
    deliveryStats: state.deliveryStats,
    topRoute: state.topRoute,
    recentDeliveries: state.recentDeliveries,
    isLoading: state.isLoading,
    error: state.error,
    refresh: fetchData,
  };
};
