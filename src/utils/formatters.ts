/**
 * ============================================================================
 * File: src/utils/formatters.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Currency and date formatting utilities used across all UI components and
 *   Google Sheets serialization routines.
 *
 * Key Responsibilities:
 *   1. formatINR() & formatCompactINR(): Formats numbers into Indian Rupee (₹)
 *      currency strings using the Indian numbering system (Lakhs / Crores).
 *   2. normalizeDateString() & formatDateToDDMMYYYY(): Converts between ISO
 *      dates (YYYY-MM-DD) used by HTML date inputs and DD-MM-YYYY dates stored
 *      in Google Sheets.
 *   3. Month/Year key helpers (getCurrentMonthKey, getPreviousMonthKey,
 *      getNextMonthKey, formatMonthYear) for navigating dashboard periods.
 * ============================================================================
 */

/**
 * Formats a numeric value into Indian Rupee format (₹) with Indian digit grouping.
 * e.g., 1500 -> ₹1,500
 *       25000 -> ₹25,000
 *       125000 -> ₹1,25,000
 *       10000000 -> ₹1,00,00,000
 */
export function formatINR(amount: number, includeDecimals = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals && absAmount % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(absAmount);
  // Ensure the ₹ symbol has standard spacing if needed, or standard ₹ prefix
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Returns a compact INR representation for tight charts/axis.
 * e.g., 50000 -> ₹50K, 1500000 -> ₹15L, 20000000 -> ₹2Cr
 */
export function formatCompactINR(amount: number): string {
  if (isNaN(amount) || amount === 0) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${sign}₹${abs}`;
}

/**
 * Formats a normalized date string (YYYY-MM-DD) or any date input into 'DD-MM-YYYY' format for Excel / Google Sheets.
 * e.g., '2026-08-20' -> '20-08-2026'
 */
export function formatDateToDDMMYYYY(dateString: string): string {
  if (!dateString) return '';
  const normalized = normalizeDateString(dateString);
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    return `${day}-${month}-${year}`;
  }
  return dateString;
}

/**
 * Normalizes any date input (Google Sheets serial number, DD/MM/YYYY, YYYY-MM-DD, ISO string)
 * into a standardized 'YYYY-MM-DD' string.
 */
export function normalizeDateString(rawDate: any): string {
  if (!rawDate && rawDate !== 0) return '';

  const str = String(rawDate).trim();
  if (!str) return '';

  // 1. Google Sheets / Excel serial number (e.g. 46255 or "46255")
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    // Excel/Sheets serial epoch starts 1899-12-30 (accounting for 1900 leap year bug: 25569 days from 1970-01-01)
    const msSinceEpoch = Math.round((serial - 25569) * 86400 * 1000);
    const dateObj = new Date(msSinceEpoch);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // 2. Format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 4. Standard JS Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return str;
}

/**
 * Formats a Date object or date string to user-friendly Indian format (e.g. 20 Aug 2026).
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const normalized = normalizeDateString(dateString);
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    const d = new Date(normalized);
    return isNaN(d.getTime())
      ? normalized
      : d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  } catch {
    return dateString;
  }
}

/**
 * Gets today's date formatted as YYYY-MM-DD in local time.
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the current month and year string in YYYY-MM format.
 */
export function getCurrentMonthKey(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Gets the readable name for current month, e.g. "August 2026"
 */
export function getCurrentMonthName(): string {
  const today = new Date();
  return today.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats a YYYY-MM key into readable string (e.g. "2026-08" -> "August 2026")
 */
export function formatMonthYear(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  try {
    const [year, month] = monthKey.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return monthKey;
  }
}

/**
 * Gets current 4-digit year as string, e.g. "2026"
 */
export function getCurrentYearKey(): string {
  return String(new Date().getFullYear());
}

/**
 * Calculates previous month key (e.g. "2026-08" -> "2026-07", "2026-01" -> "2025-12")
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Calculates next month key (e.g. "2026-08" -> "2026-09", "2026-12" -> "2027-01")
 */
export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Returns canonical Google Sheets monthly expense tab name in "Mmm-YYYY" format (e.g. "Sep-2026", "Oct-2026")
 */
export function getMonthTabName(rawDate?: string): string {
  const normalized = rawDate ? normalizeDateString(rawDate) : getTodayDateString();
  const parts = normalized.split('-');
  const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${SHORT_MONTH_NAMES[monthIndex]}-${year}`;
    }
  }
  const now = new Date();
  return `${SHORT_MONTH_NAMES[now.getMonth()]}-${now.getFullYear()}`;
}

