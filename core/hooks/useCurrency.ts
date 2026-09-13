import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatMoney, CurrencyCode, getCurrencySymbol } from '../../utils/currency';

const CURRENCY_STORAGE_KEY = '@app_preferred_currency';

/**
 * React Hook that provides the user's preferred currency and a formatting function.
 *
 * Usage:
 *   const { currency, formatPrice, symbol } = useCurrency();
 *   formatPrice(1500)  → "RD$1,500.00" (if currency is DOP)
 */
export function useCurrency(defaultCurrency: CurrencyCode = 'USD') {
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);

  useEffect(() => {
    AsyncStorage.getItem(CURRENCY_STORAGE_KEY).then((value) => {
      if (value && ['USD', 'DOP', 'EUR'].includes(value)) {
        setCurrency(value as CurrencyCode);
      }
    });
  }, []);

  const formatPrice = useCallback(
    (amount: number | null | undefined) => formatMoney(amount, currency),
    [currency],
  );

  const symbol = getCurrencySymbol(currency);

  return { currency, setCurrency, formatPrice, symbol };
}
