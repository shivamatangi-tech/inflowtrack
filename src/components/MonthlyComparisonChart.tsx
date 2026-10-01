/**
 * ============================================================================
 * File: src/components/MonthlyComparisonChart.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Analytics Bar Chart styled after the Aurora reference screen:
 *   Overview / Expenses / Income segmented pill bar, large monthly total
 *   readout, percentage comparison, and rounded pill bar columns in deep
 *   olive (#4A5240) and warm bronze (#8C7355).
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Transaction } from '../types';
import { calculateMonthlyComparison } from '../utils/calculations';
import { formatINR, formatCompactINR } from '../utils/formatters';

interface MonthlyComparisonChartProps {
  transactions: Transaction[];
  onSelectMonth?: (monthKey: string) => void;
  selectedMonth?: string;
  isUnlocked?: boolean;
}

type AnalyticsTab = 'overview' | 'expenses' | 'income';

export const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({
  transactions,
  onSelectMonth,
  selectedMonth,
  isUnlocked = false,
}) => {
  const [rangeMonths, setRangeMonths] = useState<number>(6);
  const [activeView, setActiveView] = useState<AnalyticsTab>('overview');

  const data = calculateMonthlyComparison(transactions, rangeMonths, selectedMonth);

  const currentMonthItem =
    data.find((d) => d.monthKey === selectedMonth) || data[data.length - 1];
  const prevMonthItem =
    data.length >= 2 ? data[data.length - 2] : undefined;

  const activeHeadlineAmount =
    activeView === 'income'
      ? currentMonthItem?.income || 0
      : currentMonthItem?.expenses || 0;

  const deltaPercent = React.useMemo(() => {
    if (!currentMonthItem || !prevMonthItem) return 0;
    const curr =
      activeView === 'income' ? currentMonthItem.income : currentMonthItem.expenses;
    const prev =
      activeView === 'income' ? prevMonthItem.income : prevMonthItem.expenses;
    if (prev <= 0) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  }, [currentMonthItem, prevMonthItem, activeView]);

  const totalRangeIncome = data.reduce((acc, curr) => acc + curr.income, 0);
  const totalRangeExpenses = data.reduce((acc, curr) => acc + curr.expenses, 0);
  const hasTransactionsInRange = data.some(
    (d) => d.hasTransactions || d.income > 0 || d.expenses > 0
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload;
      const inc = row?.income || 0;
      const exp = row?.expenses || 0;
      const net = inc - exp;

      return (
        <div className="bg-[#181816] text-white p-3.5 rounded-2xl shadow-xl text-xs border border-white/10 space-y-1.5 min-w-[175px]">
          <p className="font-semibold text-[#EAE8E1] border-b border-white/10 pb-1">
            {label}
          </p>
          <div className="flex items-center justify-between text-[#A5B496]">
            <span>Income</span>
            <span className="tabular-nums font-semibold">
              {isUnlocked ? formatINR(inc) : '••••••'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#D4B896]">
            <span>Expenses</span>
            <span className="tabular-nums font-semibold">
              {isUnlocked ? formatINR(exp) : '••••••'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-white font-semibold">
            <span>Net</span>
            <span className="tabular-nums">
              {isUnlocked ? `${net >= 0 ? '+' : '−'}${formatINR(Math.abs(net))}` : '••••••'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="monthly-comparison-card"
      className="bg-white dark:bg-[#161614] rounded-2xl border border-[#E5E0D4] dark:border-[#282622] p-5 sm:p-6 transition-colors flex flex-col justify-between h-full shadow-2xs"
    >
      <div>
        {/* Top Row: Analytics Title & 6M / 12M Selector */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-[#8E7952] dark:text-[#C5A059]">
              Comparative Performance
            </p>
            <h3 className="font-display text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Monthly Cash-Flow Analytics
            </h3>
          </div>

          <div className="flex items-center bg-[#F6F5F0] dark:bg-[#22211D] p-1 rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium">
            <button
              type="button"
              onClick={() => setRangeMonths(6)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                rangeMonths === 6
                  ? 'bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] shadow-2xs'
                  : 'text-[#78746B] dark:text-[#9E9B92]'
              }`}
            >
              6M
            </button>
            <button
              type="button"
              onClick={() => setRangeMonths(12)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                rangeMonths === 12
                  ? 'bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] shadow-2xs'
                  : 'text-[#78746B] dark:text-[#9E9B92]'
              }`}
            >
              12M
            </button>
          </div>
        </div>

        {/* Segmented Control: Overview | Expenses | Income */}
        <div className="grid grid-cols-3 bg-[#F6F5F0] dark:bg-[#22211D] p-1 rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] mb-5">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'expenses', label: 'Expenses' },
              { id: 'income', label: 'Income' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeView === tab.id
                  ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs'
                  : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Big Metric Readout + vs Last Month */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              {activeView === 'income'
                ? 'Total income this month'
                : 'Total spent this month'}
            </p>
            <div className="font-display tabular-nums text-3xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight mt-0.5">
              {formatINR(activeHeadlineAmount)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-2.5 py-0.5 rounded-md bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#8E7952] dark:text-[#C5A059] font-medium tabular-nums">
              {deltaPercent <= 0 ? '↓' : '↑'} {Math.abs(deltaPercent)}%
            </span>
            <span className="text-[#78746B] dark:text-[#9E9B92]">vs prior month</span>
          </div>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="h-56 w-full">
        {data.length === 0 || (!hasTransactionsInRange && totalRangeIncome === 0 && totalRangeExpenses === 0) ? (
          <div className="h-full flex items-center justify-center text-xs text-[#78746B] dark:text-[#9E9B92] bg-[#F6F5F0]/60 dark:bg-[#121210] rounded-xl">
            No transaction records found for this {rangeMonths}M period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              accessibilityLayer={false}
              style={{ outline: 'none' }}
              margin={{ top: 10, right: 6, left: -22, bottom: 0 }}
              barGap={6}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0] && onSelectMonth) {
                  const clickedKey = e.activePayload[0].payload.monthKey;
                  onSelectMonth(clickedKey);
                }
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#DCD9D0"
                strokeOpacity={0.4}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#8A8880', fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
                allowDecimals={false}
                tickFormatter={(val) => formatCompactINR(val)}
                tick={{ fontSize: 10, fill: '#8A8880' }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(197, 160, 89, 0.08)' }}
              />
              {(activeView === 'overview' || activeView === 'income') && (
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#3B82F6"
                  radius={[6, 6, 2, 2]}
                  maxBarSize={28}
                  minPointSize={6}
                />
              )}
              {(activeView === 'overview' || activeView === 'expenses') && (
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#C5A059"
                  radius={[6, 6, 2, 2]}
                  maxBarSize={28}
                  minPointSize={6}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend & Footer */}
      <div className="mt-3 pt-3 border-t border-[#EFECE4] dark:border-[#24231F] flex items-center justify-between text-xs text-[#78746B] dark:text-[#9E9B92]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#3B82F6]" />
            <span>Income</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#C5A059]" />
            <span>Expenses</span>
          </span>
        </div>
        <span>Select any bar to inspect month</span>
      </div>
    </div>
  );
};
