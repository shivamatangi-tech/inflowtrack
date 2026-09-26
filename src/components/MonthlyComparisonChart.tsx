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

  const data = calculateMonthlyComparison(transactions, rangeMonths);

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
      className="bg-white dark:bg-[#1A1B19] rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] p-5 sm:p-6 transition-colors flex flex-col justify-between h-full"
    >
      <div>
        {/* Top Row: Analytics Title & 6M / 12M Pill */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-[#181816] dark:text-white tracking-tight">
            Analytics
          </h3>

          <div className="flex items-center bg-[#EAE8E1] dark:bg-[#262724] p-1 rounded-full text-xs font-medium">
            <button
              type="button"
              onClick={() => setRangeMonths(6)}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                rangeMonths === 6
                  ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs'
                  : 'text-[#6E6D68] dark:text-[#9E9C94]'
              }`}
            >
              6M
            </button>
            <button
              type="button"
              onClick={() => setRangeMonths(12)}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                rangeMonths === 12
                  ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs'
                  : 'text-[#6E6D68] dark:text-[#9E9C94]'
              }`}
            >
              12M
            </button>
          </div>
        </div>

        {/* Aurora-style Segmented Pill Bar: Overview | Expenses | Income */}
        <div className="grid grid-cols-3 bg-[#EAE8E1] dark:bg-[#262724] p-1 rounded-full mb-5">
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
              className={`py-1.5 px-3 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeView === tab.id
                  ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs'
                  : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Big Metric Readout + vs Last Month */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <p className="text-xs text-[#8A8880] dark:text-[#9E9C94]">
              {activeView === 'income'
                ? 'Total income this month'
                : 'Total spent this month'}
            </p>
            <div className="tabular-nums text-2xl sm:text-3xl font-semibold text-[#181816] dark:text-white tracking-tight mt-0.5">
              {formatINR(activeHeadlineAmount)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-[#EAE8E1] dark:bg-[#282926] text-[#181816] dark:text-[#E6E4DD] font-medium tabular-nums">
              {deltaPercent <= 0 ? '↓' : '↑'} {Math.abs(deltaPercent)}%
            </span>
            <span className="text-[#8A8880] dark:text-[#9E9C94]">vs prior month</span>
          </div>
        </div>
      </div>

      {/* Rounded Pill Bar Chart Container */}
      <div className="h-56 w-full">
        {data.length === 0 || (totalRangeIncome === 0 && totalRangeExpenses === 0) ? (
          <div className="h-full flex items-center justify-center text-xs text-[#8A8880] dark:text-[#9E9C94] bg-[#F4F3EF]/60 dark:bg-[#141513] rounded-2xl">
            No transaction records found for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
                strokeOpacity={0.5}
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
                tickFormatter={(val) => formatCompactINR(val)}
                tick={{ fontSize: 10, fill: '#8A8880' }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(234, 232, 225, 0.35)', radius: 12 }}
              />
              {(activeView === 'overview' || activeView === 'income') && (
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#4A5240"
                  radius={[14, 14, 8, 8]}
                  maxBarSize={28}
                  background={{ fill: '#F4F3EF', radius: 14 }}
                />
              )}
              {(activeView === 'overview' || activeView === 'expenses') && (
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#8C7355"
                  radius={[14, 14, 8, 8]}
                  maxBarSize={28}
                  background={{ fill: '#F4F3EF', radius: 14 }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend & Footer */}
      <div className="mt-3 pt-3 border-t border-[#F0EFEA] dark:border-[#262724] flex items-center justify-between text-xs text-[#8A8880] dark:text-[#9E9C94]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4A5240]" />
            <span>Income</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8C7355]" />
            <span>Expenses</span>
          </span>
        </div>
        <span>Tap any bar to switch month</span>
      </div>
    </div>
  );
};
