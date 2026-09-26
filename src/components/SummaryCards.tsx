/**
 * ============================================================================
 * File: src/components/SummaryCards.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Aurora-inspired stacked matte-black card hero, Total Balance
 *   readout, circular stone quick-action buttons (Top Up / Withdraw / Transfer /
 *   Invest / Emergency), and the monthly KPI summary cards.
 * ============================================================================
 */

import React from 'react';
import {
  Plus,
  ArrowDown,
  ArrowUp,
  PieChart,
  MoreHorizontal,
  Wifi,
} from 'lucide-react';
import { DashboardStats, TransactionType } from '../types';
import { formatINR } from '../utils/formatters';

interface SummaryCardsProps {
  stats: DashboardStats;
  overallNetBalance?: number;
  userName?: string | null;
  onQuickAction?: (type: TransactionType) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  overallNetBalance,
  userName,
  onQuickAction,
}) => {
  const leftover =
    stats.leftoverBalance ??
    (stats.totalIncome -
      stats.totalExpenses -
      stats.savings -
      stats.emergencyFund -
      (stats.lentBorrowed || 0));

  const displayTotalBalance =
    typeof overallNetBalance === 'number' ? overallNetBalance : stats.netBalance;

  const expenseRatio =
    stats.totalIncome > 0
      ? Math.min(100, Math.round((stats.totalExpenses / stats.totalIncome) * 100))
      : 0;

  const savingsRatio =
    stats.totalIncome > 0
      ? Math.max(0, Math.round(((stats.savings + stats.emergencyFund) / stats.totalIncome) * 100))
      : 0;

  const cardHolder = (userName || 'INFLOTRACK MEMBER').toUpperCase();

  const quickActions: Array<{
    label: string;
    type: TransactionType;
    icon: React.ReactNode;
  }> = [
    {
      label: 'Top Up',
      type: 'Income',
      icon: (
        <div className="w-5 h-5 rounded-md bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816] flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      ),
    },
    {
      label: 'Withdraw',
      type: 'Expense',
      icon: (
        <div className="w-5 h-5 rounded-full bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816] flex items-center justify-center">
          <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      ),
    },
    {
      label: 'Transfer',
      type: 'Transfer',
      icon: (
        <div className="w-5 h-5 rounded-full bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816] flex items-center justify-center">
          <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      ),
    },
    {
      label: 'Invest',
      type: 'Savings',
      icon: (
        <div className="w-5 h-5 rounded-md bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816] flex items-center justify-center">
          <PieChart className="w-3.5 h-3.5 stroke-[2.2]" />
        </div>
      ),
    },
    {
      label: 'Reserve',
      type: 'Emergency Fund',
      icon: <MoreHorizontal className="w-5 h-5 text-[#181816] dark:text-[#F4F3EF]" />,
    },
  ];

  return (
    <div id="summary-cards-container" className="grid grid-cols-1 lg:grid-cols-12 gap-5 shrink-0">
      {/* Left Column: Stacked Matte Black Card + Total Balance + Circular Action Buttons */}
      <div className="lg:col-span-5 bg-white dark:bg-[#1A1B19] rounded-3xl p-6 border border-[#E6E4DD] dark:border-[#2A2B28] flex flex-col items-center justify-between transition-colors">
        {/* Stacked 3-Card Showcase matching reference image */}
        <div className="relative w-full max-w-[340px] h-[188px] flex items-center justify-center my-1 select-none">
          {/* Left Background Silver/Stone Card */}
          <div
            aria-hidden="true"
            className="absolute left-0 w-[210px] h-[142px] rounded-2xl bg-gradient-to-br from-[#D6D4CE] to-[#B8B5AD] dark:from-[#2C2D2A] dark:to-[#1F201D] p-4 flex flex-col justify-between opacity-90 -rotate-3 shadow-sm border border-white/40"
          >
            <div className="text-[10px] font-medium text-[#4A4945] dark:text-[#9E9C94]">
              inflotrack
            </div>
            <div className="text-[11px] tracking-widest text-[#4A4945] dark:text-[#9E9C94] tabular-nums">
              4532 ••••
            </div>
          </div>

          {/* Right Background Obsidian Card */}
          <div
            aria-hidden="true"
            className="absolute right-0 w-[210px] h-[142px] rounded-2xl bg-gradient-to-br from-[#232422] to-[#0E0F0E] p-4 flex flex-col justify-between opacity-95 rotate-3 shadow-sm border border-white/10"
          >
            <div className="flex justify-end">
              <Wifi className="w-3.5 h-3.5 text-white/60 rotate-90" />
            </div>
            <div className="text-right text-xs font-bold italic tracking-wider text-white/80">
              VISA
            </div>
          </div>

          {/* Center Primary Matte Black Card */}
          <div className="relative z-10 w-[268px] h-[168px] rounded-2xl bg-gradient-to-br from-[#323330] via-[#1E1F1D] to-[#111210] text-white p-5 flex flex-col justify-between shadow-xl border border-white/15 overflow-hidden">
            {/* Subtle diagonal sheen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/[0.04] blur-xl"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tracking-tight text-white/95">
                  ▲ inflotrack
                </span>
                <span className="text-[10px] text-white/60 font-light"> Vault</span>
              </div>
              <Wifi className="w-4 h-4 text-white/80 rotate-90" />
            </div>

            {/* Metallic Chip & Card Number */}
            <div className="space-y-2.5 my-auto pt-2">
              <div className="w-9 h-6 rounded-md bg-gradient-to-br from-[#D4CFC4] via-[#B8B2A6] to-[#8C867A] border border-white/20 opacity-90" />
              <div className="text-xs sm:text-[13px] tracking-[0.18em] font-medium text-white/90 tabular-nums">
                4532 8901 2345 6789
              </div>
            </div>

            {/* Expiry, Holder & VISA Platinum */}
            <div className="flex items-end justify-between pt-1">
              <div>
                <div className="text-[9px] text-white/50 tracking-wider">
                  VALID 09/28
                </div>
                <div className="text-[10px] font-medium tracking-wider text-white/80 truncate max-w-[140px] mt-0.5">
                  {cardHolder}
                </div>
              </div>
              <div className="text-right leading-none">
                <div className="text-base font-bold italic tracking-wider text-white">
                  VISA
                </div>
                <div className="text-[8px] text-white/60 tracking-wide mt-0.5">
                  Platinum
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Total Balance Readout */}
        <div className="text-center mt-3 mb-5">
          <p className="text-xs font-normal text-[#8A8880] dark:text-[#9E9C94]">
            Total balance
          </p>
          <div className="tabular-nums text-3xl sm:text-[34px] font-semibold text-[#181816] dark:text-white tracking-tight mt-1">
            {formatINR(displayTotalBalance)}
          </div>
        </div>

        {/* 5 Circular Stone Quick-Action Buttons */}
        <div className="w-full flex items-center justify-between gap-2 max-w-[340px]">
          {quickActions.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onQuickAction && onQuickAction(item.type)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#DBD9D0] hover:bg-[#CECBC0] dark:bg-[#282926] dark:hover:bg-[#343531] flex items-center justify-center transition-transform active:scale-95">
                {item.icon}
              </div>
              <span className="text-[11px] font-medium text-[#181816] dark:text-[#E6E4DD] whitespace-nowrap">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: 3 Monthly KPI Breakdown Cards */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Total Income */}
        <div
          id="card-income"
          className="bg-white dark:bg-[#1A1B19] p-6 rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] flex flex-col justify-between transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-[#8A8880] dark:text-[#9E9C94]">
              <span className="font-normal">Total income</span>
              <span className="text-[#2E7D32] dark:text-emerald-400 font-medium">
                Inflow
              </span>
            </div>

            <div className="mt-3">
              <div className="tabular-nums text-2xl xl:text-[26px] font-semibold text-[#181816] dark:text-white tracking-tight truncate">
                {formatINR(stats.totalIncome)}
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-[#F0EFEA] dark:border-[#262724] flex items-center justify-between text-xs">
            <span className="text-[#8A8880] dark:text-[#9E9C94]">Saved to goals</span>
            <span className="tabular-nums font-semibold text-[#2E7D32] dark:text-emerald-400">
              {savingsRatio}%
            </span>
          </div>
        </div>

        {/* 2. Total Expenses */}
        <div
          id="card-expenses"
          className="bg-white dark:bg-[#1A1B19] p-6 rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] flex flex-col justify-between transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-[#8A8880] dark:text-[#9E9C94]">
              <span className="font-normal">Total spent</span>
              <span className="text-[#8C7355] dark:text-[#B8A38A] font-medium">
                Outflow
              </span>
            </div>

            <div className="mt-3">
              <div className="tabular-nums text-2xl xl:text-[26px] font-semibold text-[#181816] dark:text-white tracking-tight truncate">
                {formatINR(stats.totalExpenses)}
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-[#F0EFEA] dark:border-[#262724] flex items-center justify-between text-xs">
            <span className="text-[#8A8880] dark:text-[#9E9C94]">Of income</span>
            <span className="tabular-nums font-semibold text-[#4A5240] dark:text-[#B8A38A]">
              {expenseRatio}%
            </span>
          </div>
        </div>

        {/* 3. Leftover Balance */}
        <div
          id="card-leftover-balance"
          className="bg-white dark:bg-[#1A1B19] p-6 rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] flex flex-col justify-between transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-[#8A8880] dark:text-[#9E9C94]">
              <span className="font-normal">Leftover balance</span>
              <span
                className={`font-medium ${
                  leftover >= 0
                    ? 'text-[#2E7D32] dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {leftover >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>

            <div className="mt-3">
              <div
                className={`tabular-nums text-2xl xl:text-[26px] font-semibold tracking-tight truncate ${
                  leftover >= 0
                    ? 'text-[#181816] dark:text-white'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {leftover >= 0 ? '' : '−'}
                {formatINR(Math.abs(leftover))}
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-[#F0EFEA] dark:border-[#262724] flex items-center justify-between text-xs">
            <span className="text-[#8A8880] dark:text-[#9E9C94]">Unallocated</span>
            <span className="text-[#181816] dark:text-[#E6E4DD] font-medium">
              Net cash
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
