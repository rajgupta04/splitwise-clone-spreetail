const { Decimal } = require('@prisma/client/runtime/library');

/**
 * Currency Service for handling multi-currency conversions using the Frankfurter API.
 * Frankfurter is open-source, requires no API key, and provides European Central Bank rates.
 */
class CurrencyService {
  constructor() {
    this.baseUrl = 'https://api.frankfurter.app';
    // In-memory cache for exchange rates to minimize API calls.
    // Key format: "YYYY-MM-DD_BASE_TARGET"
    // Value: number (the exchange rate)
    this.rateCache = new Map();
  }

  /**
   * Generates a cache key for the given parameters.
   */
  _getCacheKey(dateStr, base, target) {
    return `${dateStr}_${base}_${target}`;
  }

  /**
   * Formats a Date object or date string to YYYY-MM-DD.
   * If date is 'latest', returns 'latest'.
   */
  _formatDate(dateInput) {
    if (dateInput === 'latest' || !dateInput) return 'latest';
    
    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date(dateInput);
    }
    
    // Ensure valid date
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date provided for currency conversion: ${dateInput}`);
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Fetches the exchange rate between two currencies on a specific date.
   * 
   * @param {string} originalCurrency - The currency to convert from (e.g., 'EUR')
   * @param {string} targetCurrency - The currency to convert to (group base currency, e.g., 'USD')
   * @param {Date|string} [date='latest'] - The date for historical rates, or 'latest'
   * @returns {Promise<number>} - The exchange rate (1 original = X target)
   */
  async getExchangeRate(originalCurrency, targetCurrency, date = 'latest') {
    const base = originalCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    // If currencies are the same, rate is always 1
    if (base === target) {
      return 1.0;
    }

    const dateStr = this._formatDate(date);
    const cacheKey = this._getCacheKey(dateStr, base, target);

    // Check cache first
    if (this.rateCache.has(cacheKey)) {
      return this.rateCache.get(cacheKey);
    }

    try {
      const endpoint = dateStr === 'latest' ? '/latest' : `/${dateStr}`;
      const url = `${this.baseUrl}${endpoint}?from=${base}&to=${target}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Exchange rate not found for ${base} to ${target} on ${dateStr}. The API might not support these currencies or the date is too far in the past/future.`);
        }
        throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.rates || !data.rates[target]) {
        throw new Error(`Rate for ${target} not found in Frankfurter response.`);
      }

      const rate = data.rates[target];

      // Cache the rate (safe to cache indefinitely for historical rates, short-lived for 'latest' usually but this is acceptable for an in-memory map without expiry for now)
      this.rateCache.set(cacheKey, rate);

      return rate;
    } catch (error) {
      const wrappedError = new Error(`Currency fetch failed: ${error.message}`);
      wrappedError.statusCode = 502; // Bad Gateway / External API error
      throw wrappedError;
    }
  }

  /**
   * Converts an amount using the specified exchange rate, returning a normalized amount.
   * Uses Math.round to avoid floating point precision issues (banker's rounding equivalent in JS for simple cases).
   * 
   * @param {number} amount - The original amount
   * @param {number} rate - The exchange rate
   * @returns {number} - The normalized amount (rounded to 2 decimal places)
   */
  convertAmount(amount, rate) {
    // Convert to cents, apply rate, round, then back to dollars
    return Math.round((amount * rate) * 100) / 100;
  }
}

// Export a singleton instance
module.exports = new CurrencyService();
