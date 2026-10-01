/**
 * ============================================================================
 * File: src/utils/calculations.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Pure financial calculation and aggregation engine for the dashboard,
 *   charts, and goals views.
 *
 * Key Responsibilities:
 *   1. calculateDashboardStats(): Aggregates Total Income, Total Expenses,
 *      Savings, Emergency Fund, Lent, Borrowed, Net Balance, and Leftover
 *      Balance for a given month or all-time.
 *   2. calculateGoalsStats() & filterGoalsTransactions(): Computes reserves
 *      and receivables/payables filtered by Month, Year, or All-Time.
 *   3. calculateCurrentMonthExpenses(): Groups monthly expenses by category
 *      with percentage breakdowns and color assignments for the Donut chart.
 *   4. calculateTrendData() & calculateMonthlyComparison(): Generates time-series
 *      datasets for the Daily/Monthly cashflow line chart and 6/12-month bar chart.
 * ============================================================================
 */

import {
  Transaction,
  DashboardStats,
  GoalsStats,
  GoalsTimeframe,
  CategoryExpense,
  TrendDataPoint,
  TrendViewMode,
} from '../types';
import { getCurrentMonthKey } from './formatters';

// Earthy olive, warm bronze, mocha, and sage palette matching the Aurora neobank aesthetic
const CATEGORY_COLORS = [
  '#4A5240', // Deep Olive
  '#7A8270', // Muted Sage Olive
  '#8C7355', // Warm Bronze / Umber
  '#6E5648', // Deep Mocha
  '#B8A38A', // Warm Sand
  '#CFCBC2', // Soft Stone
  '#363D2E', // Dark Forest Olive
  '#9E8770', // Taupe
  '#5C6453', // Moss
  '#A39E93', // Warm Pewter
  '#7D6B5D', // Earth Brown
  '#8F9785', // Lichen
  '#4F463E', // Espresso Stone
  '#D8D4CA', // Alabaster Gray
];

/**
 * Computes dashboard financial totals:
 * - Total Income = SUM(Amount WHERE Type = 'Income')
 * - Total Expenses = SUM(Amount WHERE Type = 'Expense')
 * - Savings = SUM(Amount WHERE Type = 'Savings')
 * - Emergency Fund = SUM(Amount WHERE Type = 'Emergency Fund')
 * - Lent = SUM(Amount WHERE Type = 'Lent' or Lent portion)
 * - Borrowed = SUM(Amount WHERE Type = 'Borrowed' or Borrowed portion)
 * - Leftover Balance = Total Income - Total Expenses - Savings - Emergency Fund - Lent (for the selected month)
 * - Net Balance = All-time net or monthly leftover balance
 */
export function calculateDashboardStats(
  transactions: Transaction[],
  monthKey?: string
): DashboardStats {
  let totalIncome = 0;
  let totalExpenses = 0;
  let savings = 0;
  let emergencyFund = 0;
  let lent = 0;
  let borrowed = 0;
  let allTimeNetBalance = 0;

  // First calculate all-time net balance
  for (const tx of transactions) {
    const amt = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
    if (tx.type === 'Income') allTimeNetBalance += amt;
    else if (tx.type === 'Expense') allTimeNetBalance -= amt;
    else if (tx.type === 'Savings') allTimeNetBalance -= amt;
    else if (tx.type === 'Emergency Fund') allTimeNetBalance -= amt;
    else if (tx.type === 'Lent') allTimeNetBalance -= amt;
    else if (tx.type === 'Borrowed') { /* Borrowed is liability */ }
    else if (tx.type === 'Lent & Borrowed') {
      if (isLentTransaction(tx)) allTimeNetBalance -= amt;
    }
  }

  // Calculate monthly stats if monthKey provided
  for (const tx of transactions) {
    if (monthKey && (!tx.date || !tx.date.startsWith(monthKey))) {
      continue;
    }
    const amt = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
    switch (tx.type) {
      case 'Income':
        totalIncome += amt;
        break;
      case 'Expense':
        totalExpenses += amt;
        break;
      case 'Savings':
        savings += amt;
        break;
      case 'Emergency Fund':
        emergencyFund += amt;
        break;
      case 'Lent':
        lent += amt;
        break;
      case 'Borrowed':
        borrowed += amt;
        break;
      case 'Lent & Borrowed':
        if (isBorrowedTransaction(tx)) {
          borrowed += amt;
        } else {
          lent += amt;
        }
        break;
    }
  }

  const cashFlow = totalIncome - totalExpenses;
  // Leftover Balance for selected month = Income − Expenses − Savings − Emergency Fund − Lent
  const leftoverBalance = totalIncome - totalExpenses - savings - emergencyFund - lent;
  const netBalance = monthKey ? leftoverBalance : allTimeNetBalance;

  return {
    totalIncome,
    totalExpenses,
    savings,
    emergencyFund,
    lent,
    borrowed,
    lentBorrowed: lent + borrowed,
    netBalance,
    cashFlow,
    leftoverBalance,
  };
}

/**
 * Calculates expense breakdown grouped by Category for a given monthKey (e.g. "2026-08").
 */
export function calculateCurrentMonthExpenses(
  transactions: Transaction[],
  expenseCategoryList: string[],
  monthKey?: string
): CategoryExpense[] {
  const targetMonthKey = monthKey || getCurrentMonthKey();

  const expenseMap = new Map<string, number>();
  let totalMonthExpense = 0;

  // Set of valid expense categories (lowercased for resilient matching)
  const validCategoriesSet = new Set(expenseCategoryList.map((c) => c.trim().toLowerCase()));

  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue;
    if (!tx.date || !tx.date.startsWith(targetMonthKey)) continue;

    const trimmedCat = (tx.category || 'Other Expense').trim();
    const isKnown = validCategoriesSet.size === 0 || validCategoriesSet.has(trimmedCat.toLowerCase());
    const finalCategory = isKnown ? trimmedCat : 'Other Expense';

    const amt = tx.amount > 0 ? tx.amount : 0;
    const current = expenseMap.get(finalCategory) || 0;
    expenseMap.set(finalCategory, current + amt);
    totalMonthExpense += amt;
  }

  if (totalMonthExpense === 0 || expenseMap.size === 0) {
    return [];
  }

  const result: CategoryExpense[] = [];
  let colorIndex = 0;

  // Sort categories by highest amount first
  const sortedEntries = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]);

  for (const [category, amount] of sortedEntries) {
    const percentage = Math.round((amount / totalMonthExpense) * 100);
    result.push({
      category,
      amount,
      percentage,
      color: CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length],
    });
    colorIndex++;
  }

  return result;
}

/**
 * Determines whether a transaction is specifically a 'Borrowed' entry.
 */
export function isBorrowedTransaction(tx: { type: string; category?: string; description?: string }): boolean {
  if (tx.type === 'Borrowed') return true;
  if (tx.type === 'Lent') return false;
  if (tx.type !== 'Lent & Borrowed') return false;
  const cat = (tx.category || '').toLowerCase();
  const desc = (tx.description || '').toLowerCase();
  return (
    cat.includes('borrow') ||
    cat.includes('debt') ||
    cat.includes('loan taken') ||
    cat.includes('credit taken') ||
    desc.includes('borrow') ||
    desc.includes('debt')
  );
}

/**
 * Determines whether a transaction is specifically a 'Lent' entry.
 */
export function isLentTransaction(tx: { type: string; category?: string; description?: string }): boolean {
  if (tx.type === 'Lent') return true;
  if (tx.type === 'Borrowed') return false;
  if (tx.type !== 'Lent & Borrowed') return false;
  return !isBorrowedTransaction(tx);
}

/**
 * Computes Goals & Reserves financial metrics for a specific timeframe (Month, Year, or All-Time).
 */
export function calculateGoalsStats(
  transactions: Transaction[],
  timeframe: GoalsTimeframe,
  selectedMonthKey: string,
  selectedYearKey: string
): GoalsStats {
  let savings = 0;
  let emergencyFund = 0;
  let lent = 0;
  let borrowed = 0;

  for (const tx of transactions) {
    if (
      tx.type !== 'Savings' &&
      tx.type !== 'Emergency Fund' &&
      tx.type !== 'Lent' &&
      tx.type !== 'Borrowed' &&
      tx.type !== 'Lent & Borrowed'
    ) {
      continue;
    }

    if (timeframe === 'month') {
      if (!tx.date || !tx.date.startsWith(selectedMonthKey)) continue;
    } else if (timeframe === 'year') {
      if (!tx.date || !tx.date.startsWith(selectedYearKey)) continue;
    }

    const amt = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
    if (tx.type === 'Savings') {
      savings += amt;
    } else if (tx.type === 'Emergency Fund') {
      emergencyFund += amt;
    } else if (tx.type === 'Lent') {
      lent += amt;
    } else if (tx.type === 'Borrowed') {
      borrowed += amt;
    } else if (tx.type === 'Lent & Borrowed') {
      if (isBorrowedTransaction(tx)) {
        borrowed += amt;
      } else {
        lent += amt;
      }
    }
  }

  return {
    savings,
    emergencyFund,
    lent,
    borrowed,
    lentBorrowed: lent + borrowed,
    totalAllocated: savings + emergencyFund,
  };
}

/**
 * Filters transactions that belong to Goals (Savings, Emergency Fund, Lent, Borrowed) for given timeframe.
 */
export function filterGoalsTransactions(
  transactions: Transaction[],
  timeframe: GoalsTimeframe,
  selectedMonthKey: string,
  selectedYearKey: string
): Transaction[] {
  return transactions.filter((tx) => {
    if (
      tx.type !== 'Savings' &&
      tx.type !== 'Emergency Fund' &&
      tx.type !== 'Lent' &&
      tx.type !== 'Borrowed' &&
      tx.type !== 'Lent & Borrowed'
    ) {
      return false;
    }
    if (timeframe === 'month') {
      return tx.date && tx.date.startsWith(selectedMonthKey);
    }
    if (timeframe === 'year') {
      return tx.date && tx.date.startsWith(selectedYearKey);
    }
    return true;
  });
}

/**
 * Generates trend series data for Income vs Expense.
 * Supports Daily (YYYY-MM-DD) and Monthly (YYYY-MM) aggregation.
 */
export function calculateTrendData(
  transactions: Transaction[],
  mode: TrendViewMode,
  monthFilter?: string
): TrendDataPoint[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    if (!tx.date) continue;
    if (tx.type !== 'Income' && tx.type !== 'Expense') continue;

    if (mode === 'daily' && monthFilter && !tx.date.startsWith(monthFilter)) {
      continue;
    }

    let key = tx.date;
    if (mode === 'monthly') {
      key = tx.date.substring(0, 7); // YYYY-MM
    }

    if (!map.has(key)) {
      map.set(key, { income: 0, expense: 0 });
    }

    const current = map.get(key)!;
    const amt = tx.amount > 0 ? tx.amount : 0;

    if (tx.type === 'Income') {
      current.income += amt;
    } else if (tx.type === 'Expense') {
      current.expense += amt;
    }
  }

  const sortedKeys = Array.from(map.keys()).sort();

  return sortedKeys.map((key) => {
    let displayDate = key;
    if (mode === 'monthly') {
      const [y, m] = key.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      displayDate = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    } else {
      const parts = key.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        displayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
    }

    const item = map.get(key)!;
    return {
      dateKey: key,
      displayDate,
      income: item.income,
      expense: item.expense,
    };
  });
}

/**
 * Normalizes any transaction date (e.g. "2026-09-26", "26-09-2026", "26/09/2026", "Sep-2026")
 * into a standard year-month key "YYYY-MM".
 */
export function normalizeMonthKey(rawDate?: string): string | null {
  if (!rawDate) return null;
  const s = String(rawDate).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = s.match(/^(\d{4})[-\/\.](\d{1,2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
  if (dmy) {
    const y = parseInt(dmy[3], 10);
    const m = parseInt(dmy[2], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // Named month format: Sep-2026, September 2026, sept-2026
  const monthMap: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const named = s.match(/([a-zA-Z]+)[\s\-_]+(\d{4})/);
  if (named) {
    const prefix = named[1].toLowerCase().slice(0, 3);
    if (monthMap[prefix]) {
      return `${named[2]}-${monthMap[prefix]}`;
    }
  }

  // ISO string fallback
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Calculates month-by-month Income, Expenses, and Net Balance for comparison bar graphs.
 * Returns sorted chronologically. Supports both 6M and 12M ranges, ensuring any transaction
 * in the dataset is displayed as a visible bar.
 */
export function calculateMonthlyComparison(
  transactions: Transaction[],
  monthCount = 6,
  selectedMonth?: string
): Array<{
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
  hasTransactions: boolean;
}> {
  const monthMap = new Map<string, { income: number; expenses: number; count: number }>();

  // 1. Process all transactions with robust date and type normalization
  const txMonthKeys: string[] = [];
  for (const tx of transactions) {
    const monthKey = normalizeMonthKey(tx.date);
    if (!monthKey) continue;

    txMonthKeys.push(monthKey);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { income: 0, expenses: 0, count: 0 });
    }

    const current = monthMap.get(monthKey)!;
    current.count += 1;

    const amt =
      typeof tx.amount === 'number'
        ? isNaN(tx.amount)
          ? 0
          : Math.max(0, tx.amount)
        : Math.max(0, Number(tx.amount) || 0);

    const typeLower = (tx.type || '').trim().toLowerCase();
    if (typeLower === 'income') {
      current.income += amt;
    } else if (
      typeLower === 'expense' ||
      typeLower === 'savings' ||
      typeLower === 'emergency fund' ||
      typeLower === 'lent' ||
      typeLower === 'borrowed' ||
      typeLower === 'lent & borrowed'
    ) {
      current.expenses += amt;
    }
  }

  // 2. Determine anchor reference month (latest between transactions, selectedMonth, and calendar today)
  const today = new Date();
  const currentCalKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let anchorKey = currentCalKey;
  if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
    anchorKey = selectedMonth;
  }
  if (txMonthKeys.length > 0) {
    const latestTxKey = [...txMonthKeys].sort().pop()!;
    if (latestTxKey > anchorKey) {
      anchorKey = latestTxKey;
    }
  }

  // 3. Ensure at least `monthCount` consecutive calendar months ending at `anchorKey` exist
  const [anchorY, anchorM] = anchorKey.split('-').map(Number);
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(anchorY, anchorM - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${y}-${m}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { income: 0, expenses: 0, count: 0 });
    }
  }

  // 4. Sort chronologically and determine the window of length `monthCount`
  const sortedKeys = Array.from(monthMap.keys()).sort();
  const anchorIndex = sortedKeys.indexOf(anchorKey);

  let sliceKeys: string[];
  if (anchorIndex !== -1 && sortedKeys.length > monthCount) {
    const startIdx = Math.max(0, anchorIndex - monthCount + 1);
    sliceKeys = sortedKeys.slice(startIdx, startIdx + monthCount);
    if (sliceKeys.length < monthCount) {
      sliceKeys = sortedKeys.slice(-monthCount);
    }
  } else {
    sliceKeys = sortedKeys.slice(-monthCount);
  }

  return sliceKeys.map((key) => {
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const data = monthMap.get(key) || { income: 0, expenses: 0, count: 0 };
    return {
      monthKey: key,
      label,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      hasTransactions: data.count > 0,
    };
  });
}


