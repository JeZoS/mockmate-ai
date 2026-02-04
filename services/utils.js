/**
 * Fallback exchange rates from USD (used when API fails)
 */
const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.12,
  JPY: 149.50,
  CAD: 1.35,
  AUD: 1.53
};

/**
 * Cache for exchange rates
 */
let ratesCache = {
  rates: { ...FALLBACK_RATES },
  lastFetched: null,
  isLoading: false
};

/**
 * Fetch real-time exchange rates from frankfurter.app (free, no API key)
 * Rates are cached for 1 hour to avoid excessive API calls
 */
export const fetchExchangeRates = async () => {
  const ONE_HOUR = 60 * 60 * 1000;
  
  // Return cached rates if still valid
  if (ratesCache.lastFetched && (Date.now() - ratesCache.lastFetched) < ONE_HOUR) {
    return ratesCache.rates;
  }
  
  // Prevent multiple simultaneous fetches
  if (ratesCache.isLoading) {
    return ratesCache.rates;
  }
  
  ratesCache.isLoading = true;
  
  try {
    // Fetch rates from USD to all supported currencies
    const currencies = ['EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'];
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${currencies.join(',')}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }
    
    const data = await response.json();
    
    // Update cache with new rates
    ratesCache.rates = {
      USD: 1,
      ...data.rates
    };
    ratesCache.lastFetched = Date.now();
    
    console.log('Exchange rates updated:', ratesCache.rates);
    return ratesCache.rates;
  } catch (error) {
    console.warn('Failed to fetch exchange rates, using fallback:', error.message);
    return ratesCache.rates; // Return cached or fallback rates
  } finally {
    ratesCache.isLoading = false;
  }
};

/**
 * Get current exchange rates (sync version using cache)
 */
export const getExchangeRates = () => {
  // Trigger background fetch if cache is stale
  const ONE_HOUR = 60 * 60 * 1000;
  if (!ratesCache.lastFetched || (Date.now() - ratesCache.lastFetched) >= ONE_HOUR) {
    fetchExchangeRates(); // Fire and forget
  }
  return ratesCache.rates;
};

/**
 * Currency display info
 */
export const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' }
};

/**
 * Convert amount from USD to target currency
 * @param {number} amountUSD - Amount in USD
 * @param {string} targetCurrency - Target currency code
 * @returns {number} Converted amount
 */
export const convertCurrency = (amountUSD, targetCurrency = 'USD') => {
  const rates = getExchangeRates();
  const rate = rates[targetCurrency] || 1;
  return amountUSD * rate;
};

/**
 * Format currency with various options
 * @param {number} amount - The amount to format (in USD)
 * @param {object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {string} options.locale - Locale for formatting (default: auto from currency)
 * @param {number} options.decimals - Number of decimal places (default: auto)
 * @param {boolean} options.compact - Use compact notation for large numbers (default: false)
 * @param {boolean} options.showSymbol - Show currency symbol (default: true)
 * @param {boolean} options.convert - Convert from USD to target currency (default: true)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, options = {}) => {
  const {
    currency = 'USD',
    locale,
    decimals,
    compact = false,
    showSymbol = true,
    convert = true
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    const currencyInfo = CURRENCIES[currency] || CURRENCIES.USD;
    return showSymbol ? `${currencyInfo.symbol}0.00` : '0.00';
  }

  // Convert from USD if needed
  const convertedAmount = convert ? convertCurrency(amount, currency) : amount;
  
  // Get locale from currency info or use provided
  const currencyInfo = CURRENCIES[currency] || CURRENCIES.USD;
  const finalLocale = locale || currencyInfo.locale;

  // For very small amounts (like API costs), show more decimals
  // But for currencies like INR/JPY where converted amounts are larger, use fewer
  const isSmallUnit = currency === 'JPY' || convertedAmount >= 1;
  const autoDecimals = isSmallUnit ? 2 : (convertedAmount < 0.01 ? 4 : convertedAmount < 1 ? 3 : 2);
  const finalDecimals = decimals !== undefined ? decimals : autoDecimals;

  if (compact && convertedAmount >= 1000) {
    return new Intl.NumberFormat(finalLocale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(convertedAmount);
  }

  if (showSymbol) {
    return new Intl.NumberFormat(finalLocale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: finalDecimals,
      maximumFractionDigits: finalDecimals
    }).format(convertedAmount);
  }

  return new Intl.NumberFormat(finalLocale, {
    style: 'decimal',
    minimumFractionDigits: finalDecimals,
    maximumFractionDigits: finalDecimals
  }).format(convertedAmount);
};

/**
 * Format cost specifically for API usage (small amounts)
 * @param {number} cost - The cost amount in USD
 * @param {string} currency - Target currency code
 * @returns {string} Formatted cost string
 */
export const formatApiCost = (cost, currency = 'USD') => {
  const converted = convertCurrency(cost, currency);
  // For small amounts, show more precision; for larger converted amounts (like INR), show 2 decimals
  const decimals = converted >= 1 ? 2 : 4;
  return formatCurrency(cost, { currency, decimals, convert: true });
};

/**
 * Get currency symbol
 * @param {string} currencyCode - ISO currency code
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (currencyCode = 'USD') => {
  return CURRENCIES[currencyCode]?.symbol || '$';
};
