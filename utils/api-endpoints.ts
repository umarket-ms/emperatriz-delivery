/**
 * api-endpoints.ts
 *
 * Enum centralizado de todas las URLs de la API backend para la app de delivery.
 *
 * USO:
 *   import { ApiEndpoints } from '../utils/api-endpoints';
 *   import { getApiUrl } from '../services/api';
 *
 *   // Con parámetros:
 *   const url = getApiUrl(ApiEndpoints.DeliveryAssignmentsStatus, { id: '123' });
 *   // → "http://localhost:5000/api/delivery-assignments/123/status"
 *
 *   // Sin parámetros:
 *   const url = getApiUrl(ApiEndpoints.DeliveryStatus);
 *   // → "http://localhost:5000/api/delivery-status"
 *
 * REGLAS:
 *   - PROHIBIDO usar strings hardcodeados para URLs de API
 *   - SIEMPRE usar este enum + getApiUrl()
 *   - Las URLs con parámetros usan formato {nombreParametro}
 */

export enum ApiEndpoints {
  // ==========================================================================
  // Auth
  // ==========================================================================
  AuthLoginDelivery = 'auth/login-delivery',
  AuthWhoami = 'auth/whoami',
  AuthRefreshToken = 'auth/refresh-token',
  AuthVerifyEmail = 'auth/verify-email',
  AuthResendVerificationCode = 'auth/resend-verification-code',
  AuthChangeInitialPassword = 'auth/change-initial-password',
  AuthForgotPassword = 'auth/forgot-password',
  AuthForgotPasswordMobile = 'auth/forgot-password-mobile',
  AuthResetPassword = 'auth/reset-password',

  // ==========================================================================
  // App Version
  // ==========================================================================
  AppVersion = 'app-version',
  AppVersionDelivery = 'app-version/delivery',

  // ==========================================================================
  // Delivery Assignments
  // ==========================================================================
  DeliveryAssignments = 'delivery-assignments',
  DeliveryAssignmentsByDriver = 'delivery-assignments/by-driver',
  DeliveryAssignmentsStatus = 'delivery-assignments/{id}/status',
  DeliveryAssignmentsStatusWithImages = 'delivery-assignments/{id}/status-with-images',
  DeliveryAssignmentsStatusUnified = 'delivery-assignments/{id}/status-unified',
  DeliveryAssignmentsBatchStatusUnified = 'delivery-assignments/batch/status-unified',
  DeliveryAssignmentsOptimizedRoute = 'delivery-assignments/courier/{courierId}/optimized-route',
  DeliveryAssignmentsDriverStats = 'delivery-assignments/driver/stats',
  DeliveryAssignmentsDriverTopRoute = 'delivery-assignments/driver/top-route',
  DeliveryAssignmentsDriverRecentDeliveries = 'delivery-assignments/driver/recent-deliveries',
  DeliveryAssignmentsDriverAvailable = 'delivery-assignments/driver/available',
  DeliveryAssignmentsDriverClaim = 'delivery-assignments/driver/claim/{id}',
  DeliveryAssignmentsDriverClaimGroup = 'delivery-assignments/driver/claim',

  // ==========================================================================
  // Delivery Status
  // ==========================================================================
  DeliveryStatus = 'delivery-status',
  DeliveryStatusById = 'delivery-status/{id}',

  // ==========================================================================
  // Payment
  // ==========================================================================
  PaymentMethods = 'payment-methods',

  // ==========================================================================
  // OSRM / Routing
  // ==========================================================================
  OsrmRoute = 'admin/osrm/route',
  OsrmTrip = 'admin/osrm/trip',

  // ==========================================================================
  // CXP Invoices
  // ==========================================================================
  CxpInvoices = 'cxp-invoices',
  CxpInvoicesPay = 'cxp-invoices/{id}/pay',
  CxpInvoicesBulkPay = 'cxp-invoices/bulk-pay',
  CxpInvoicesSellerEarnings = 'cxp-invoices/seller/earnings',
  CxpInvoicesSellerPaidInvoices = 'cxp-invoices/seller/paid-invoices',
  CxpInvoicesSellerMonthlyStats = 'cxp-invoices/seller/monthly-stats',
  CxpInvoicesSellerWeeklyStats = 'cxp-invoices/seller/weekly-stats',

  // ==========================================================================
  // CXP Credit Notes
  // ==========================================================================
  CxpCreditNotesForInvoice = 'cxp-credit-notes/for-invoice/{invoiceId}',

  }
