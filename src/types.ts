/**
 * ============================================================================
 * File: src/types.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Central TypeScript type definitions and data contracts shared across the
 *   entire inflotrack web application (frontend UI, services, and calculations).
 *
 * Key Data Models Defined:
 *   - TransactionType & Transaction: Core financial entry schema (Income,
 *     Expense, Transfer, Savings, Emergency Fund, Lent, Borrowed) mapped to
 *     rows in Google Sheets.
 *   - GoogleUser: Authenticated user profile identified by verified Firebase UID.
 *   - SecurityQuestionConfig: Non-sensitive metadata for optional PIN unlock,
 *     recovery questions, and session inactivity timers.
 *   - BudgetConfig & GoalsStats: Targets and progress metrics for Savings,
 *     Emergency Fund, and monthly budgets.
 *   - CategoryData: Dynamic categories, payment modes, and accounts synced
 *     from the Google Sheet 'Categories' tab.
 *   - DashboardStats, CategoryExpense, TrendDataPoint: Computed metrics for
 *     summary cards, pie charts, bar charts, and cash-flow trend lines.
 *   - DriveBackupItem & RecurringTemplate: Private Google Drive backup
 *     metadata and monthly recurring transaction templates.
 * ============================================================================
 */

export type TransactionType =
  | 'Income'
  | 'Expense'
  | 'Transfer'
  | 'Savings'
  | 'Emergency Fund'
  | 'Lent'
  | 'Borrowed'
  | 'Lent & Borrowed';

export interface GoogleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string | null;
  photoURL: string | null;
  authProvider?: 'firebase' | 'personal';
}

export interface Transaction {
  id?: string;
  transactionId?: string; // Immutable unique transaction ID stored in Google Sheets
  uid?: string; // Verified Firebase user UID
  rowIndex?: number; // 1-based row index in Google Sheet
  sheetName?: string; // e.g. "AUG_2026", "SEP_2026", or "Transactions"
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  type: TransactionType;
  category: string;
  subcategory?: string;
  amount: number;
  paymentMode?: string;
  account?: string; // Account or wallet name
  description: string; // Notes
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
  deletedAt?: string | null; // ISO timestamp when soft deleted
  isDeleted?: boolean; // Soft delete flag
}

export interface SecurityQuestionConfig {
  pinEnabled: boolean;
  hasPinSet: boolean;
  pinLoginEnabled?: boolean;
  hasPinLoginSet?: boolean;
  question1: string;
  hasQuestion1Set: boolean;
  question2?: string;
  hasQuestion2Set?: boolean;
  inactivityTimeoutMinutes?: number;
  inactivityAction?: 'lock' | 'logout';
}

export interface BudgetConfig {
  savingsTarget: number;
  emergencyFundTarget: number;
  monthlyExpenseBudget?: number;
  updatedAt?: string;
}

export interface DriveBackupItem {
  id: string;
  name: string;
  createdTime: string;
  sizeBytes?: number;
  transactionsCount?: number;
  kind: 'backup' | 'csv' | 'receipt';
}

export interface CategoryData {
  incomeCategories: string[];
  expenseCategories: string[];
  transferCategories?: string[];
  savingsCategories: string[];
  emergencyFundCategories: string[];
  lentCategories?: string[];
  borrowedCategories?: string[];
  lentBorrowedCategories?: string[];
  subcategories?: Record<string, string[]>;
  paymentModes?: string[];
  accounts?: string[];
  securityConfig?: SecurityQuestionConfig;
  budgetConfig?: BudgetConfig;
}

export interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  emergencyFund: number;
  lent: number;
  borrowed: number;
  lentBorrowed?: number;
  netBalance: number;
  cashFlow?: number;
  leftoverBalance: number;
}

export interface GoalsStats {
  savings: number;
  emergencyFund: number;
  lent: number;
  borrowed: number;
  lentBorrowed: number;
  totalAllocated: number;
}

export interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface TrendDataPoint {
  dateKey: string; // YYYY-MM-DD or YYYY-MM
  displayDate: string;
  income: number;
  expense: number;
}

export type TrendViewMode = 'daily' | 'monthly';

export type GoalsTimeframe = 'month' | 'year' | 'alltime';

export type AppViewTab = 'dashboard' | 'goals' | 'calculator';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SpreadsheetInfo {
  id: string;
  name: string;
  url?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  driveFolderUrl?: string;
  driveConnected?: boolean;
  createdTime?: string;
  transactionsCount: number;
  connectionMode?: 'google_sheets_api' | 'apps_script' | 'local_sheet_workbook';
  ownerUid?: string;
}

export type MobileTab = 'home' | 'goals' | 'add' | 'calc' | 'analysis' | 'settings';

export interface RecurringTemplate {
  id: string;
  uid?: string;
  name: string;
  type: TransactionType;
  category: string;
  subcategory?: string;
  amount: number;
  paymentMode?: string;
  account?: string;
  dayOfMonth: number; // 1-31
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MonthComparisonData {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Aug 2026"
  income: number;
  expenses: number;
  savings: number;
  net: number;
}
