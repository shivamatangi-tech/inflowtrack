/**
 * ============================================================================
 * File: src/components/MonthlyComparisonChart.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Monthly Income vs. Expenses Bar Chart comparing cash inflows
 *   and outflows across the last 6 or 12 months.
 *
 * Key Responsibilities:
 *   1. Supports toggling between Last 6 Months and Last 12 Months views.
 *   2. Allows clicking any monthly bar to filter the entire dashboard to
 *      that month (`onSelectMonth`).
 *   3. Masks exact tooltip currency values with '••••••' until the user
 *      unlocks the session with their 4-digit PIN (if enabled).
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
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { Transaction } from '../types';
import { calculateMonthlyComparison } from '../utils/calculations';
import { formatINR, formatCompactINR } from '../utils/formatters';

interface MonthlyComparisonChartProps {
  transactions: Transaction[];
  onSelectMonth?: (monthKey: string) => void;
  selectedMonth?: string;
  isUnlocked?: boolean;
}

export const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({
  transactions,
  onSelectMonth,
  selectedMonth,
  isUnlocked = false,
}) => {
  const [rangeMonths, setRangeMonths] = useState<number>(6);

  const data = calculateMonthlyComparison(transactions, rangeMonths);

  // Calculate totals across the comparison range
  const totalRangeIncome = data.reduce((acc, curr) => acc + curr.income, 0);
  const totalRangeExpenses = data.reduce((acc, curr) => acc + curr.expenses, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const inc = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
      const exp = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;
      const net = inc - exp;

      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-800 space-y-1.5 min-w-[160px]">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
          <div className="flex items-center justify-between text-emerald-400">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Income:
            </span>
            <span className="font-bold">{isUnlocked ? formatINR(inc) : '••••••'}</span>
          </div>
          <div className="flex items-center justify-between text-rose-400">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Expense:
            </span>
            <span className="font-bold">{isUnlocked ? formatINR(exp) : '••••••'}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-slate-300 font-bold">
            <span>Net Balance:</span>
            <span className={net >= 0 ? 'text-indigo-300' : 'text-rose-400'}>
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
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors flex flex-col justify-between"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Monthly Income vs Expenses
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Bar graph comparison of Total Income, Expenses & Net Balance
          </p>
        </div>

        {/* Range switcher (6 Months vs 12 Months) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setRangeMonths(6)}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              rangeMonths === 6
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Last 6 Months
          </button>
          <button
            type="button"
            onClick={() => setRangeMonths(12)}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              rangeMonths === 12
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Last 12 Months
          </button>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="h-64 w-full">
        {data.length === 0 || (totalRangeIncome === 0 && totalRangeExpenses === 0) ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
            No transaction records found for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0] && onSelectMonth) {
                  const clickedKey = e.activePayload[0].payload.monthKey;
                  onSelectMonth(clickedKey);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatCompactINR(val)}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '10px' }}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeOpacity={0.4} />
              <Bar
                dataKey="income"
                name="Total Income"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="expenses"
                name="Total Expenses"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Info / Monthly Switch Helper */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>Click any bar to filter and view details for that month</span>
        {selectedMonth && (
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            Active: {data.find((d) => d.monthKey === selectedMonth)?.label || selectedMonth}
          </span>
        )}
      </div>
    </div>
  );
};
