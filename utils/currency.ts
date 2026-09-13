/**
 * Multi-currency formatting utility for the Delivery React Native (Expo) app.
 *
 * Usage:
 *   import { formatMoney, getCurrencySymbol } from '@/utils/currency';
 *
 *   formatMoney(1500, 'DOP')    → "RD$1,500.00"
 *   formatMoney(1500, 'USD')    → "$1,500.00"
 *   formatMoney(1500, 'EUR')    → "1.500,00 €"
 */

export type CurrencyCode = 'USD' | 'DOP' | 'EUR';

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  USD: 'en-US',
  DOP: 'es-DO',
  EUR: 'de-DE',
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  DOP: 'RD$',
  EUR: '€',
};

/**
 * Format a number as currency using Intl.NumberFormat.
 * Works in React Native with Hermes (supports Intl.NumberFormat).
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: CurrencyCode = 'USD',
  options?: { locale?: string; minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  if (amount === null || amount === undefined) {
    return formatMoney(0, currency, options);
  }

  const locale = options?.locale || CURRENCY_LOCALE[currency] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(amount);
  } catch {
    // Fallback for environments without full Intl support
    return `${CURRENCY_SYMBOLS[currency] || '$'}${amount.toFixed(2)}`;
  }
}

/**
 * Get the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: CurrencyCode = 'USD'): string {
  return CURRENCY_SYMBOLS[currency] || '$';
}
