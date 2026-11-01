import { apiAction } from '@/core/api/apiAction';
import { ApiEndpoints } from '@/utils/api-endpoints';

// ─── CXP Invoice types (same endpoints as vendedor) ──────────────────────────

export interface DriverEarnings {
  weekTotal: number;
  monthTotal: number;
  invoiceCount: number;
}

export interface PaidInvoice {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
}

export interface MonthlyStatItem {
  month: string;
  value: number;
}

export interface WeeklyStatItem {
  day: string;
  value: number;
}

// ─── Delivery assignment types ────────────────────────────────────────────────

/** Number of completed deliveries this week */
export type DriverWeeklyStats = number;

export interface DriverTopRoute {
  routeName: string;
  deliveryCount: number;
  totalEarnings: number;
}

export interface RecentDeliveryItem {
  id: number;
  contact: string;
  zone: string;
//   earning: number;
  completedAt: string;
}

// ─── Action functions ─────────────────────────────────────────────────────────

export const getDriverEarnings = async (): Promise<DriverEarnings> => {
  try {
    return await apiAction.get<DriverEarnings>(`${ApiEndpoints.CxpInvoicesSellerEarnings}`);
  } catch (error:any) {
    console.error('getDriverEarnings failed:', error?.message ?? error);
    throw new Error(`Unable to load driver earnings: ${error?.message ?? error}`);
  }
};

export const getDriverPaidInvoices = async (): Promise<PaidInvoice[]> => {
  try {
    return await apiAction.get<PaidInvoice[]>(`${ApiEndpoints.CxpInvoicesSellerPaidInvoices}`);
  } catch (error:any) {
    throw new Error(`Unable to load driver paid invoices: ${error?.message ?? error}`);
  }
};

export const getDriverMonthlyStats = async (): Promise<MonthlyStatItem[]> => {
  try {
    return await apiAction.get<MonthlyStatItem[]>(`${ApiEndpoints.CxpInvoicesSellerMonthlyStats}`);
  } catch (error:any) {
    throw new Error(`Unable to load driver monthly stats: ${error?.message ?? error}`);
  }
};

export const getDriverWeeklyStats = async (): Promise<WeeklyStatItem[]> => {
  try {
    return await apiAction.get<WeeklyStatItem[]>(`${ApiEndpoints.CxpInvoicesSellerWeeklyStats}`);
  } catch (error:any) {
    throw new Error(`Unable to load driver weekly stats: ${error?.message ?? error}`);
  }
};

export const getDriverDeliveryStats = async (): Promise<number> => {
  try {
    return await apiAction.get<number>(`${ApiEndpoints.DeliveryAssignmentsDriverStats}`);
  } catch (error:any) {
    throw new Error(`Unable to load driver delivery stats: ${error?.message ?? error}`);
  }
};

export const getDriverTopRoute = async (): Promise<DriverTopRoute | null> => {
  try {
    return await apiAction.get<DriverTopRoute | null>(`${ApiEndpoints.DeliveryAssignmentsDriverTopRoute}`);
  } catch (error:any) {
    throw new Error(`Unable to load driver top route: ${error?.message ?? error}`);
  }
};

export const getDriverRecentDeliveries = async (): Promise<RecentDeliveryItem[]> => {
  try {
    return await apiAction.get<RecentDeliveryItem[]>(`${ApiEndpoints.DeliveryAssignmentsDriverRecentDeliveries}`);
  } catch (error:any) {
    throw new Error(`Unable to load driver recent deliveries: ${error?.message ?? error}`);
  }
};
