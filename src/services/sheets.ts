/**
 * ============================================================================
 * File: src/services/sheets.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Frontend client service for all Google Sheets (primary finance database:
 *   `inflowtrack`) and Google Drive (`inflowtrack` folder:
 *   `1vzWhp8o3I_3jbtGvS0NUS2Xo-VdOBYKb`) synchronization operations.
 *
 * Key Responsibilities:
 *   1. Attaches the user's verified Firebase ID Token (`Authorization: Bearer`)
 *      to every request sent to `/api/finance/*`, `/api/security/*`, and
 *      `/api/drive/*`.
 *   2. Reads and writes Transactions (Income, Expense, Transfer, Savings,
 *      Emergency Fund, Lent, Borrowed), Categories, Payment Modes, Budgets,
 *      and Recurring Transaction Templates in the `inflowtrack` Google Sheet.
 *   3. Manages private Google Drive JSON snapshot backups and receipts inside
 *      the `inflowtrack` Drive folder (`1vzWhp8o3I_3jbtGvS0NUS2Xo-VdOBYKb`).
 *   4. Translates network and server errors into clear, user-friendly messages
 *      without leaking tokens or credentials.
 * ============================================================================
 */

import {
  Transaction,
  TransactionType,
  CategoryData,
  SpreadsheetInfo,
  RecurringTemplate,
  BudgetConfig,
  DriveBackupItem,
} from '../types';
import { normalizeDateString } from '../utils/formatters';
import { syncSecurityConfigMetadata, updateSecurityPinWithServer } from '../utils/security';
import { syncTargetsFromSheet } from '../utils/targets';
import { getFreshAuthToken } from './firebase';

export const TARGET_SPREADSHEET_NAME = 'inflowtrack';
export const TARGET_DRIVE_FOLDER_NAME = 'inflowtrack';
export const TARGET_DRIVE_FOLDER_ID = '1vzWhp8o3I_3jbtGvS0NUS2Xo-VdOBYKb';
export const TARGET_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1vzWhp8o3I_3jbtGvS0NUS2Xo-VdOBYKb';

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

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function getMonthSheetName(rawDate?: string): string {
  if (!rawDate) {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]}_${now.getFullYear()}`;
  }
  const normalized = normalizeDateString(rawDate);
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTH_NAMES[monthIndex]}_${year}`;
    }
  }
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]}_${now.getFullYear()}`;
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

// Short-lived in-memory bootstrap cache to avoid duplicate round-trips during loadData()
let lastBootstrapCache: {
  timestamp: number;
  sheetInfo: SpreadsheetInfo;
  categories: CategoryData;
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
} | null = null;

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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/bootstrap', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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

export async function appendTransaction(
  accessToken: string,
  _spreadsheetId: string,
  transaction: Omit<Transaction, 'id' | 'rowIndex'>
): Promise<void> {
  try {
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/transactions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch(`/api/finance/transactions/${rowIndex}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/transactions/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/categories', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/categories', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/budgets', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/recurring', {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/finance/recurring', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch(`/api/finance/recurring/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/drive/backups', {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const token = await resolveToken(accessToken);
    const res = await fetch('/api/drive/backup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = await resolveToken(accessToken);
    const res = await fetch(`/api/drive/backups/${encodeURIComponent(backupId)}/download`, {
      headers: { Authorization: `Bearer ${token}` },
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
