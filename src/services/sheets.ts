/**
 * ============================================================================
 * File: src/services/sheets.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Frontend client service for all Google Sheets (primary finance database:
 *   `inflowtrack`) and Google Drive (`inflowtrack` folder:
 *   `https://drive.google.com/drive/folders/1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`)
 *   synchronization, sheet creation, and sheet download operations.
 * ============================================================================
 */

import {
  Transaction,
  CategoryData,
  SpreadsheetInfo,
  RecurringTemplate,
  BudgetConfig,
  DriveBackupItem,
} from '../types';
import { normalizeDateString } from '../utils/formatters';
import { syncSecurityConfigMetadata, updateSecurityPinWithServer } from '../utils/security';
import { syncTargetsFromSheet } from '../utils/targets';
import { getFreshAuthToken, getGoogleAccessToken } from './firebase';

export const TARGET_SPREADSHEET_NAME = 'inflowtrack';
export const TARGET_DRIVE_FOLDER_NAME = 'inflowtrack';
export const TARGET_DRIVE_FOLDER_ID = '1WTHHDzwzO79ypcP06ZmDkBuDADosnH30';
export const TARGET_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1WTHHDzwzO79ypcP06ZmDkBuDADosnH30';

// Default Starter Categories
export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Bonus',
  'Interest',
  'Other Income',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Transport',
  'Fuel',
  'Shopping',
  'Entertainment',
  'Medical',
  'Education',
  'Bills',
  'Other Expense',
];

export const DEFAULT_TRANSFER_CATEGORIES = [
  'Bank to Bank Transfer',
  'Wallet Top-up',
  'Credit Card Bill Payment',
  'Self Transfer',
  'Cash Withdrawal',
];

export const DEFAULT_SAVINGS_CATEGORIES = [
  'Mutual Funds',
  'Fixed Deposit',
  'Recurring Deposit',
  'Stocks & Equity',
  'Gold & Precious Metals',
  'PPF / EPF',
  'Retirement Fund',
  'Other Savings',
];

export const DEFAULT_EMERGENCY_CATEGORIES = [
  'Bank Liquid Reserve',
  'Emergency High-Yield',
  'Cash at Hand',
  'Medical Contingency',
  'Other Emergency Reserve',
];

export const DEFAULT_LENT_CATEGORIES = [
  'Money Lent to Friend',
  'Personal Loan Given',
  'Advance Given',
  'Business Loan Given',
  'Other Lent',
];

export const DEFAULT_BORROWED_CATEGORIES = [
  'Borrowed from Friend',
  'Personal Loan Taken',
  'Credit/Advance Taken',
  'Bank Loan',
  'Other Borrowed',
];

export const DEFAULT_LENT_BORROWED_CATEGORIES = [
  'Lent to Friend / Family',
  'Borrowed from Friend / Family',
  'Personal Loan Advance',
  'Loan Repayment Received',
  'Loan Repayment Paid',
  'Other Lent / Borrowed',
];

export const DEFAULT_PAYMENT_MODES = [
  'HDFC Bank',
  'Kotak 811',
  'SBI Bank',
  'HDFC Credit Card',
  'SBI Credit Card',
  'Tata Neu Credit Card',
  'Amazon ICICI',
  'UPI / GPay',
  'Cash',
  'Other Payment Mode',
];

export const DEFAULT_ACCOUNTS = [
  'Primary Bank Account',
  'Savings Account',
  'Cash Wallet',
  'Credit Card',
  'UPI Wallet',
];

const SHORT_MONTH_NAMES_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getMonthSheetName(rawDate?: string): string {
  if (!rawDate) {
    const now = new Date();
    return `${SHORT_MONTH_NAMES_TITLE[now.getMonth()]}-${now.getFullYear()}`;
  }
  const normalized = normalizeDateString(rawDate);
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${SHORT_MONTH_NAMES_TITLE[monthIndex]}-${year}`;
    }
  }
  const now = new Date();
  return `${SHORT_MONTH_NAMES_TITLE[now.getMonth()]}-${now.getFullYear()}`;
}

export function extractFolderIdFromUrlOrId(rawInput: string): string {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return TARGET_DRIVE_FOLDER_ID;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }
  return TARGET_DRIVE_FOLDER_ID;
}

/**
 * Formats API and network errors into clear, user-friendly messages without exposing sensitive tokens or stack traces.
 */
function formatUserFriendlyError(error: unknown, fallbackMessage: string): Error {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new Error('Network unavailable. Please check your internet connection and try again.');
  }
  if (error instanceof Error) {
    const msg = error.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return new Error('Network unavailable. Unable to reach the inflotrack server.');
    }
    return new Error(msg || fallbackMessage);
  }
  return new Error(fallbackMessage);
}

async function resolveToken(passedToken?: string | null): Promise<string> {
  const fresh = await getFreshAuthToken();
  const token = fresh || passedToken;
  if (!token) {
    throw new Error('Your session has expired. Please sign in again to continue.');
  }
  return token;
}

async function buildAuthHeaders(
  passedToken?: string | null,
  includeJsonContentType = false
): Promise<Record<string, string>> {
  const token = await resolveToken(passedToken);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const googleToken = getGoogleAccessToken();
  if (googleToken) {
    headers['X-Google-Access-Token'] = googleToken;
  }
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

/**
 * Triggers bidirectional synchronization between the website and Google Sheets.
 */
export async function triggerTwoWaySync(
  accessToken?: string | null
): Promise<{
  sheetInfo: SpreadsheetInfo;
  categories: CategoryData;
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
}> {
  clearBootstrapCache();
  return fetchFinanceBootstrap(accessToken || '', true);
}

// Short-lived in-memory bootstrap cache to avoid duplicate round-trips during loadData()
let lastBootstrapCache: {
  timestamp: number;
  sheetInfo: SpreadsheetInfo;
  categories: CategoryData;
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
} | null = null;

export function clearBootstrapCache(): void {
  lastBootstrapCache = null;
}

export async function fetchFinanceBootstrap(
  accessToken: string,
  forceRefresh = false
): Promise<{
  sheetInfo: SpreadsheetInfo;
  categories: CategoryData;
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
}> {
  if (!forceRefresh && lastBootstrapCache && Date.now() - lastBootstrapCache.timestamp < 1500) {
    return lastBootstrapCache;
  }

  try {
    const headers = await buildAuthHeaders(accessToken, false);
    const res = await fetch('/api/finance/bootstrap', { headers });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error(data.error || 'Your session has expired. Please sign in again.');
      }
      if (res.status === 403) {
        throw new Error(data.error || 'Unauthorized access. You do not have permission to view these records.');
      }
      if (res.status === 503) {
        throw new Error(data.error || 'Google Sheets is temporarily unavailable. Please try again shortly.');
      }
      throw new Error(data.error || 'Unable to synchronize with your Google Sheet.');
    }

    if (data.categories?.securityConfig) {
      syncSecurityConfigMetadata(data.categories.securityConfig);
    }
    if (data.categories?.budgetConfig) {
      syncTargetsFromSheet(data.categories.budgetConfig);
    }

    const result = {
      timestamp: Date.now(),
      sheetInfo: data.sheetInfo as SpreadsheetInfo,
      categories: data.categories as CategoryData,
      transactions: (data.transactions || []) as Transaction[],
      recurringTemplates: (data.recurringTemplates || []) as RecurringTemplate[],
    };

    lastBootstrapCache = result;
    return result;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Google Sheets is currently unavailable. Please try again.');
  }
}

export async function findOrCreateFinanceSpreadsheet(accessToken: string): Promise<SpreadsheetInfo> {
  const data = await fetchFinanceBootstrap(accessToken, true);
  return data.sheetInfo;
}

export async function readCategories(accessToken: string, _spreadsheetId?: string): Promise<CategoryData> {
  const data = await fetchFinanceBootstrap(accessToken, false);
  return data.categories;
}

export async function readTransactions(accessToken: string, _spreadsheetId?: string): Promise<Transaction[]> {
  const data = await fetchFinanceBootstrap(accessToken, false);
  return data.transactions;
}

/**
 * Updates Google Sheets synchronization settings (Spreadsheet ID, Sheet Name, or Apps Script URL)
 * and immediately reconciles changes bidirectionally with the Google Sheet.
 */
export async function updateSyncConfig(
  accessToken: string | null | undefined,
  config: {
    spreadsheetId?: string;
    spreadsheetName?: string;
    appsScriptUrl?: string;
  }
): Promise<{ sheetInfo: SpreadsheetInfo; success: boolean }> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/sync-config', {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update Google Sheets synchronization settings.');
    }
    lastBootstrapCache = null;
    return {
      sheetInfo: data.sheetInfo as SpreadsheetInfo,
      success: true,
    };
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to update Google Sheets synchronization settings.');
  }
}

/**
 * Updates the Google Drive folder location where the `inflowtrack` sheet and backups are stored,
 * and optionally creates a new `inflowtrack` sheet inside that folder.
 */
export async function updateDriveFolderLocation(
  accessToken: string | null | undefined,
  options: {
    driveFolderUrl: string;
    spreadsheetName?: string;
    createNewSheet?: boolean;
  }
): Promise<{ sheetInfo: SpreadsheetInfo; message: string }> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/drive-location', {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update Google Drive location.');
    }
    lastBootstrapCache = null;
    return {
      sheetInfo: data.sheetInfo as SpreadsheetInfo,
      message: data.message || 'Google Drive location updated and synced.',
    };
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to update Google Drive location.');
  }
}

/**
 * Creates a brand-new `inflowtrack` Google Sheet inside the configured Google Drive folder
 * (`https://drive.google.com/drive/folders/1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`) and syncs all
 * user transactions, categories, and budgets into it.
 */
export async function createNewInflowtrackSheetInDrive(
  accessToken?: string | null,
  options?: {
    driveFolderUrl?: string;
    spreadsheetName?: string;
  }
): Promise<{ sheetInfo: SpreadsheetInfo; message: string }> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/sheet/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        driveFolderUrl: options?.driveFolderUrl || TARGET_DRIVE_FOLDER_URL,
        spreadsheetName: options?.spreadsheetName || TARGET_SPREADSHEET_NAME,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create new inflowtrack sheet in Google Drive.');
    }
    lastBootstrapCache = null;
    return {
      sheetInfo: data.sheetInfo as SpreadsheetInfo,
      message: data.message || 'Created new inflowtrack sheet in your Google Drive folder.',
    };
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to create new inflowtrack sheet in Google Drive.');
  }
}

/**
 * Stores/syncs the latest `inflowtrack` spreadsheet in the user's Google Drive folder
 * (`https://drive.google.com/drive/folders/1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`) and downloads
 * the `inflowtrack` spreadsheet file (.xlsx or .csv) directly to the user's device.
 */
export async function downloadSheetFromDrive(
  accessToken?: string | null,
  options?: { driveFolderUrl?: string; spreadsheetName?: string }
): Promise<{ fileName: string; syncedToDrive: boolean }> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/sheet/download', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        driveFolderUrl: options?.driveFolderUrl || TARGET_DRIVE_FOLDER_URL,
        spreadsheetName: options?.spreadsheetName || TARGET_SPREADSHEET_NAME,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to download inflowtrack sheet.');
    }

    const contentDisposition = res.headers.get('Content-Disposition') || '';
    const syncedHeader = res.headers.get('X-Drive-Synced') === 'true';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    const fileName = filenameMatch?.[1] || `${TARGET_SPREADSHEET_NAME}.xlsx`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    lastBootstrapCache = null;
    return { fileName, syncedToDrive: syncedHeader };
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to store and download inflowtrack sheet.');
  }
}

export async function appendTransaction(
  accessToken: string,
  _spreadsheetId: string,
  transaction: Omit<Transaction, 'id' | 'rowIndex'>
): Promise<void> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify(transaction),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save transaction to Google Sheets.');
    }
    lastBootstrapCache = null;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to save transaction. Please check your connection and try again.');
  }
}

export async function updateTransactionRow(
  accessToken: string,
  _spreadsheetId: string,
  rowIndex: number,
  transaction: Omit<Transaction, 'id' | 'rowIndex'>,
  _currentSheetName?: string
): Promise<void> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch(`/api/finance/transactions/${rowIndex}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(transaction),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update transaction in Google Sheets.');
    }
    lastBootstrapCache = null;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to update transaction in Google Sheets.');
  }
}

export async function deleteTransactionRow(
  accessToken: string,
  spreadsheetId: string,
  rowIndex: number,
  sheetName = 'Transactions'
): Promise<void> {
  return deleteTransactionsBatch(accessToken, spreadsheetId, [{ rowIndex, sheetName }]);
}

export async function deleteTransactionsBatch(
  accessToken: string,
  _spreadsheetId: string,
  targets: Array<{ rowIndex: number; sheetName?: string }> | number[],
  _fallbackSheetName = 'Transactions'
): Promise<void> {
  if (!targets || targets.length === 0) return;
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/transactions/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({ targets }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete transactions from Google Sheets.');
    }
    lastBootstrapCache = null;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to delete transaction records from Google Sheets.');
  }
}

export async function addCategoryToSheet(
  accessToken: string,
  _spreadsheetId: string,
  type: 'Income' | 'Expense' | 'Transfer',
  categoryName: string
): Promise<void> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/categories', {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, categoryName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add category to Google Sheets.');
    }
    lastBootstrapCache = null;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to add category to Google Sheets.');
  }
}

export async function addPaymentModeToSheet(
  accessToken: string,
  _spreadsheetId: string,
  modeName: string
): Promise<void> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/categories', {
      method: 'POST',
      headers,
      body: JSON.stringify({ paymentMode: modeName }),
    });
    if (!res.ok) {
      throw new Error('Failed to add payment mode to Google Sheets.');
    }
    lastBootstrapCache = null;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to add payment mode to Google Sheets.');
  }
}

export async function updateBudgetsInSheet(
  accessToken: string,
  budgets: Partial<BudgetConfig>
): Promise<BudgetConfig> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/budgets', {
      method: 'PUT',
      headers,
      body: JSON.stringify(budgets),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save budget targets to Google Sheets.');
    }
    lastBootstrapCache = null;
    return data.budgetConfig;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to save budget targets to Google Sheets.');
  }
}

export async function fetchRecurringTemplatesFromSheet(accessToken?: string | null): Promise<RecurringTemplate[]> {
  try {
    const headers = await buildAuthHeaders(accessToken, false);
    const res = await fetch('/api/finance/recurring', { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.recurringTemplates || [];
  } catch {
    return [];
  }
}

export async function createRecurringTemplateInSheet(
  accessToken: string | null | undefined,
  template: Omit<RecurringTemplate, 'id'>
): Promise<RecurringTemplate[]> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/finance/recurring', {
      method: 'POST',
      headers,
      body: JSON.stringify(template),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save recurring transaction to Google Sheets.');
    }
    lastBootstrapCache = null;
    return data.recurringTemplates || [];
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to save recurring transaction to Google Sheets.');
  }
}

export async function deleteRecurringTemplateFromSheet(
  accessToken: string | null | undefined,
  id: string
): Promise<RecurringTemplate[]> {
  try {
    const headers = await buildAuthHeaders(accessToken, false);
    const res = await fetch(`/api/finance/recurring/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete recurring transaction from Google Sheets.');
    }
    lastBootstrapCache = null;
    return data.recurringTemplates || [];
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to delete recurring transaction from Google Sheets.');
  }
}

export async function updateSecurityPinInSheet(
  accessToken: string,
  _spreadsheetId: string,
  newPin: string,
  currentPin?: string
): Promise<void> {
  const token = await resolveToken(accessToken);
  const res = await updateSecurityPinWithServer(token, { currentPin, newPin });
  if (!res.success) {
    throw new Error(res.error || 'Failed to synchronize hashed PIN with Google Sheet.');
  }
  lastBootstrapCache = null;
}

// ============================================================================
// GOOGLE DRIVE PRIVATE BACKUP & RECEIPT STORAGE CLIENT FUNCTIONS
// ============================================================================

export async function listDriveBackups(accessToken?: string | null): Promise<DriveBackupItem[]> {
  try {
    const headers = await buildAuthHeaders(accessToken, false);
    const res = await fetch('/api/drive/backups', { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.backups || [];
  } catch {
    return [];
  }
}

export async function createDriveBackup(
  accessToken?: string | null,
  options?: { kind?: 'backup' | 'receipt'; customNote?: string; receiptName?: string; receiptData?: string }
): Promise<DriveBackupItem> {
  try {
    const headers = await buildAuthHeaders(accessToken, true);
    const res = await fetch('/api/drive/backup', {
      method: 'POST',
      headers,
      body: JSON.stringify(options || { kind: 'backup' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Google Drive backup failed. Please try again.');
    }
    return data.backup as DriveBackupItem;
  } catch (error) {
    throw formatUserFriendlyError(error, 'Google Drive backup failed. Please check your connection and try again.');
  }
}

export async function downloadDriveBackupFile(
  accessToken: string | null | undefined,
  backupId: string,
  fileName: string
): Promise<void> {
  try {
    const headers = await buildAuthHeaders(accessToken, false);
    const res = await fetch(`/api/drive/backups/${encodeURIComponent(backupId)}/download`, {
      headers,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to download backup file.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw formatUserFriendlyError(error, 'Failed to download Google Drive backup.');
  }
}
