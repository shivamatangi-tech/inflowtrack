/**
 * ============================================================================
 * File: src/components/ExpensePieChart.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Category Expense Breakdown Donut Chart and sorted category
 *   percentage list for the selected dashboard month.
 *
 * Key Responsibilities:
 *   1. Visualizes each expense category's share of total monthly spending
 *      using a Recharts `<PieChart>` with a center total badge.
 *   2. Displays an interactive tooltip and a scrollable category-by-category
 *      amount and percentage breakdown list.
 * ============================================================================
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CategoryExpense } from '../types';
import { formatINR, formatCompactINR } from '../utils/formatters';
import { AlertCircle } from 'lucide-react';

interface ExpensePieChartProps {
  data: CategoryExpense[];
  monthLabel?: string;
}

export const ExpensePieChart: React.FC<ExpensePieChartProps> = ({ data, monthLabel }) => {
  const displayMonth = monthLabel || 'Selected Period';
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  // Clean, high-contrast tooltip for dark/light
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: CategoryExpense = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-100 p-2.5 rounded-xl shadow-xl text-xs border border-slate-200 dark:border-slate-800 min-w-[150px] pointer-events-none transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-bold text-slate-900 dark:text-white truncate">{item.category}</span>
          </div>
          <div className="text-rose-600 dark:text-rose-400 font-bold text-sm mt-0.5">{formatINR(item.amount)}</div>
          <div className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5 font-medium">
            {item.percentage}% of month's expenses
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="expense-pie-chart-card"
      className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col p-5 h-full transition-colors"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Expense Breakdown
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            {displayMonth} • Total: {formatINR(totalAmount)}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div
          id="empty-pie-state"
          className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No expenses recorded for this period.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
            Add expense transactions for {displayMonth} to see your category breakdown.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          {/* Chart visual with center donut badge */}
          <div className="h-[180px] w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={74}
                  paddingAngle={2}
                  stroke="currentColor"
                  className="text-white dark:text-slate-900"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 50 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute bg-white dark:bg-slate-900 rounded-full w-20 h-20 shadow-xs flex flex-col items-center justify-center pointer-events-none border border-slate-100 dark:border-slate-800">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Total</span>
              <span className="text-xs font-black text-slate-800 dark:text-white">{formatCompactINR(totalAmount)}</span>
            </div>
          </div>

          {/* Category Percentage Breakdown List */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {data.map((item) => (
              <div key={item.category} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-medium truncate">{item.category}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{formatINR(item.amount)}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs w-9 text-right">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
