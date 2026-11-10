export interface CurrencyConfig {
  code: string;
  symbol: string;
  rateAgainstMYR: number;
}

export const currencies: Record<string, CurrencyConfig> = {
  MYR: { code: 'MYR', symbol: 'RM', rateAgainstMYR: 1.0 },
  USD: { code: 'USD', symbol: '$', rateAgainstMYR: 0.22 },
  EUR: { code: 'EUR', symbol: '€', rateAgainstMYR: 0.20 },
  SGD: { code: 'SGD', symbol: 'S$', rateAgainstMYR: 0.30 },
};

export const formatPrice = (priceInMYR: number, currencyCode: string): string => {
  const currency = currencies[currencyCode] || currencies.MYR;
  const converted = priceInMYR * currency.rateAgainstMYR;
  return `${currency.symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
