/**
 * DOP (Dominican Peso) formatting utility.
 *
 * Usage:
 *   import { formatMoney } from '@/utils/currency';
 *   formatMoney(1500)  → "RD$1,500.00"
 */

export function formatMoney(
  amount: number | null | undefined,
): string {
  if (amount === null || amount === undefined) {
    return formatMoney(0);
  }

  try {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `RD$${amount.toFixed(2)}`;
  }
}
