/**
 * ============================================================================
 * File: src/components/SummaryCards.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the three primary monthly KPI metric cards at the top of the
 *   dashboard: Total Income, Total Expenses, and Leftover Balance.
 *
 * Key Responsibilities:
 *   1. Formats monthly financial totals in Indian Rupee (₹) notation.
 *   2. Dynamically highlights positive vs. deficit Leftover Balance after
 *      accounting for Expenses, Savings, Emergency Fund, and Lent allocations.
 * ============================================================================
 */

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { formatINR } from '../utils/formatters';

interface SummaryCardsProps {
  stats: DashboardStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  const leftover =
    stats.leftoverBalance ??
    (stats.totalIncome -
      stats.totalExpenses -
      stats.savings -
      stats.emergencyFund -
      stats.lentBorrowed);

  return (
    <div
      id="summary-cards-container"
      className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 shrink-0"
    >
      {/* 1. Total Income */}
      <div
        id="card-income"
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-800 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Income
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 text-center sm:text-left">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight truncate">
            {formatINR(stats.totalIncome)}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1 truncate">
            Total earnings for month
          </p>
        </div>
      </div>

      {/* 2. Total Expenses */}
      <div
        id="card-expenses"
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-rose-300 dark:hover:border-rose-800 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Expenses
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 text-center sm:text-left">
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight truncate">
            {formatINR(stats.totalExpenses)}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1 truncate">
            Total spending for month
          </p>
        </div>
      </div>

      {/* 3. Leftover Balance */}
      <div
        id="card-leftover-balance"
        className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition-all ${
          leftover >= 0
            ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Leftover Balance
          </div>
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              leftover >= 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 text-center sm:text-left">
          <div
            className={`text-2xl font-black tracking-tight truncate ${
              leftover >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {leftover >= 0 ? '' : '−'}{formatINR(Math.abs(leftover))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1 truncate">
            After all goal allocations
          </p>
        </div>
      </div>
    </div>
  );
};
