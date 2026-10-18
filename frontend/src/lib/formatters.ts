/**
 * Canonical Presentation Formatters (UIUX-ROOT-03)
 *
 * Centralized, null-safe, NaN-safe, locale-consistent (id-ID) formatters.
 * Never throws at runtime and never produces "Rp NaN" or "undefined" output.
 */

export const EMPTY_FALLBACK = '-';

export interface CurrencyFormatOptions {
  fallback?: string;
  decimals?: number;
}

/**
 * Formats a numeric value into canonical Indonesian Rupiah representation: "Rp 1.500.000"
 * - Zero outputs "Rp 0"
 * - Missing / null / undefined / NaN outputs fallback (default: "-")
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK, decimals = 0 } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return fallback;
  }

  // Format with Indonesian locale: period thousands separator, comma decimal separator
  const formattedNumber = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return `Rp ${formattedNumber}`;
}

export interface NumberFormatOptions {
  fallback?: string;
  decimals?: number;
  maxDecimals?: number;
}

/**
 * Formats a numeric value with Indonesian locale: "1.500.000"
 */
export function formatNumber(
  value: number | string | null | undefined,
  options: NumberFormatOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK, decimals, maxDecimals = 2 } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return fallback;
  }

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals !== undefined ? decimals : 0,
    maximumFractionDigits: decimals !== undefined ? decimals : maxDecimals,
  }).format(num);
}

export interface QuantityFormatOptions {
  fallback?: string;
  maxDecimals?: number;
}

/**
 * Formats a quantity value.
 * e.g., 6000 -> "6.000" or "6000" (formatted number)
 */
export function formatQuantity(
  value: number | string | null | undefined,
  options: QuantityFormatOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK, maxDecimals = 2 } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return fallback;
  }

  // If integer, no decimals. If fraction, up to maxDecimals
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

export interface QuantityWithUomOptions {
  fallback?: string;
  defaultUom?: string;
  maxDecimals?: number;
}

/**
 * Formats quantity together with its unit of measure.
 * Examples: "6.000 Meter", "2 Unit", "100 PCS"
 * Never renders "6000.00 undefined", "2 null", or "NaN Unit"
 */
export function formatQuantityWithUom(
  quantity: number | string | null | undefined,
  uom: string | null | undefined,
  options: QuantityWithUomOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK, defaultUom, maxDecimals = 2 } = options;

  if (quantity === null || quantity === undefined || quantity === '') {
    return fallback;
  }

  const num = typeof quantity === 'number' ? quantity : Number(quantity);
  if (isNaN(num)) {
    return fallback;
  }

  const formattedQty = formatQuantity(num, { fallback, maxDecimals });
  if (formattedQty === fallback) {
    return fallback;
  }

  const cleanUom = (uom || defaultUom || '').trim();
  if (cleanUom && cleanUom !== 'null' && cleanUom !== 'undefined') {
    return `${formattedQty} ${cleanUom}`;
  }

  return formattedQty;
}

const INDONESIAN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export interface DateFormatOptions {
  fallback?: string;
}

/**
 * Formats a date into canonical Indonesian format: "DD MMM YYYY" (e.g. "01 Okt 2026")
 * Date-only strings "YYYY-MM-DD" are parsed deterministically without timezone shift.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  options: DateFormatOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK } = options;

  if (!value) {
    return fallback;
  }

  // 1. If it's a simple YYYY-MM-DD date string (length 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const parts = value.trim().split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      const dd = String(day).padStart(2, '0');
      const mmm = INDONESIAN_MONTHS_SHORT[month];
      return `${dd} ${mmm} ${year}`;
    }
  }

  const dateObj = value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj.getTime())) {
    return fallback;
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = INDONESIAN_MONTHS_SHORT[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return `${day} ${month} ${year}`;
}

export interface DateTimeFormatOptions {
  fallback?: string;
}

/**
 * Formats date and time into canonical Indonesian format: "DD MMM YYYY, HH:mm" (e.g. "01 Okt 2026, 10:30")
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options: DateTimeFormatOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK } = options;

  if (!value) {
    return fallback;
  }

  const dateObj = value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj.getTime())) {
    return fallback;
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = INDONESIAN_MONTHS_SHORT[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export interface PercentageFormatOptions {
  fallback?: string;
  decimals?: number;
  showSymbol?: boolean;
}

/**
 * Formats a percentage value. Examples: "15%", "17.5%", "100%"
 * If decimals is not specified, trims trailing zeros gracefully.
 */
export function formatPercentage(
  value: number | string | null | undefined,
  options: PercentageFormatOptions = {}
): string {
  const { fallback = EMPTY_FALLBACK, decimals, showSymbol = true } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return fallback;
  }

  let formatted: string;
  if (decimals !== undefined) {
    formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } else {
    // Preserve natural fraction up to 2 decimal places, trimming trailing zeros
    const rounded = Math.round(num * 100) / 100;
    formatted = new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 2,
    }).format(rounded);
  }

  return showSymbol ? `${formatted}%` : formatted;
}
