/**
 * ============================================================================
 * File: src/components/SummaryCards.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Home Screen Executive Ledger Summary featuring the 3 core
 *   monthly KPI cards (Total Income, Total Spent, Leftover Balance) styled in
 *   the Warm Ivory, Deep Charcoal, and Muted Champagne Gold luxury aesthetic.
 *   (Total Balance and the Stacked Cards Showcase reside in the Cards section.)
 * ============================================================================
 */

import React from 'react';
import {
  Plus,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from 'lucide-react';
import { DashboardStats, TransactionType, CategoryData } from '../types';
import { formatINR } from '../utils/formatters';

interface SummaryCardsProps {
  stats: DashboardStats;
  overallNetBalance?: number;
  userName?: string | null;
  categories?: CategoryData;
  onQuickAction?: (type: TransactionType, category?: string) => void;
  onOpenRecordTransaction?: () => void;
  onOpenCardsSection?: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  onQuickAction,
  onOpenRecordTransaction,
  onOpenCardsSection,
}) => {
  const leftover =
    stats.leftoverBalance ??
    (stats.totalIncome -
      stats.totalExpenses -
      stats.savings -
      stats.emergencyFund -
      (stats.lentBorrowed || 0));

  const expenseRatio =
    stats.totalIncome > 0
      ? Math.min(100, Math.round((stats.totalExpenses / stats.totalIncome) * 100))
      : 0;

  const savingsRatio =
    stats.totalIncome > 0
      ? Math.max(0, Math.round(((stats.savings + stats.emergencyFund) / stats.totalIncome) * 100))
      : 0;

  const handleTriggerRecord = () => {
    if (onOpenRecordTransaction) {
      onOpenRecordTransaction();
    } else if (onQuickAction) {
      onQuickAction('Expense');
    }
  };

  return (
    <section id="summary-cards-container" className="w-full space-y-4 shrink-0">
      {/* Executive Section Header Bar with Responsive Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
            Monthly Financial Position
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
            Executive Cash-Flow Summary
          </h2>
        </div>

        <div className="flex flex-col min-[380px]:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {onOpenCardsSection && (
            <button
              type="button"
              id="btn-home-open-cards"
              onClick={onOpenCardsSection}
              className="w-full sm:w-auto min-h-[44px] py-2.5 px-4 rounded-xl bg-white dark:bg-[#181815] hover:bg-[#F3F0E8] dark:hover:bg-[#22211D] border border-[#E4DFD3] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              <span>Cards & Vault</span>
            </button>
          )}

          <button
            type="button"
            id="btn-home-plus-record"
            onClick={handleTriggerRecord}
            className="w-full sm:w-auto min-h-[44px] py-2.5 px-4 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.4] shrink-0" />
            <span>Record Transaction</span>
          </button>
        </div>
      </div>

      {/* 3 Classic Luxury KPI Cards (Total Balance Removed from Home Screen) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. Total Income */}
        <div
          id="card-income"
          className="bg-white dark:bg-[#161614] p-5 sm:p-6 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 flex flex-col justify-between transition-all shadow-2xs min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
              <span className="font-medium tracking-wide">Total Income</span>
              <span className="inline-flex items-center gap-1 text-[#2E6F40] dark:text-emerald-400 font-medium shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Inflow
              </span>
            </div>

            <div className="mt-3.5 sm:mt-4">
              <div className="font-display tabular-nums fluid-kpi-value font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight truncate">
                {formatINR(stats.totalIncome)}
              </div>
            </div>
          </div>

          <div className="pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-[#EFECE4] dark:border-[#24231F] flex items-center justify-between gap-2 text-xs">
            <span className="text-[#78746B] dark:text-[#9E9B92]">Allocated to reserves</span>
            <span className="tabular-nums font-semibold text-[#8E7952] dark:text-[#C5A059]">
              {savingsRatio}%
            </span>
          </div>
        </div>

        {/* 2. Total Spent */}
        <div
          id="card-expenses"
          className="bg-white dark:bg-[#161614] p-5 sm:p-6 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 flex flex-col justify-between transition-all shadow-2xs min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
              <span className="font-medium tracking-wide">Total Spent</span>
              <span className="inline-flex items-center gap-1 text-[#8E7952] dark:text-[#C5A059] font-medium shrink-0">
                <ArrowDownRight className="w-3.5 h-3.5" />
                Outflow
              </span>
            </div>

            <div className="mt-3.5 sm:mt-4">
              <div className="font-display tabular-nums fluid-kpi-value font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight truncate">
                {formatINR(stats.totalExpenses)}
              </div>
            </div>
          </div>

          <div className="pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-[#EFECE4] dark:border-[#24231F] flex items-center justify-between gap-2 text-xs">
            <span className="text-[#78746B] dark:text-[#9E9B92]">Share of monthly income</span>
            <span className="tabular-nums font-semibold text-[#141412] dark:text-[#E6E4DD]">
              {expenseRatio}%
            </span>
          </div>
        </div>

        {/* 3. Leftover Balance */}
        <div
          id="card-leftover-balance"
          className="sm:col-span-2 lg:col-span-1 bg-white dark:bg-[#161614] p-5 sm:p-6 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 flex flex-col justify-between transition-all shadow-2xs min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
              <span className="font-medium tracking-wide">Leftover Balance</span>
              <span
                className={`inline-flex items-center gap-1 font-medium shrink-0 ${
                  leftover >= 0
                    ? 'text-[#2E6F40] dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                {leftover >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>

            <div className="mt-3.5 sm:mt-4">
              <div
                className={`font-display tabular-nums fluid-kpi-value font-semibold tracking-tight truncate ${
                  leftover >= 0
                    ? 'text-[#141412] dark:text-[#F6F5F0]'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {leftover >= 0 ? '' : '−'}
                {formatINR(Math.abs(leftover))}
              </div>
            </div>
          </div>

          <div className="pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-[#EFECE4] dark:border-[#24231F] flex items-center justify-between gap-2 text-xs">
            <span className="text-[#78746B] dark:text-[#9E9B92]">Unallocated liquidity</span>
            <span className="text-[#8E7952] dark:text-[#C5A059] font-medium">
              Net Position
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
