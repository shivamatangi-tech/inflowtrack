/**
 * ============================================================================
 * File: src/components/TrendLineChart.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Income vs. Expense Cash-Flow Trend Line Chart with Daily and
 *   Monthly granularity toggles.
 *
 * Key Responsibilities:
 *   1. Plots dual monotone trend lines (Income in emerald, Expenses in rose)
 *      over time using Recharts `<LineChart>`.
 *   2. Supports switching between Daily cash flow (for the active month) and
 *      Monthly overview across all recorded months.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Transaction, TrendViewMode } from '../types';
import { calculateTrendData } from '../utils/calculations';
import { formatINR, formatCompactINR } from '../utils/formatters';
import { BarChart2 } from 'lucide-react';

interface TrendLineChartProps {
  transactions: Transaction[];
  monthFilter?: string;
  selectedMonth?: string;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  transactions,
  monthFilter,
  selectedMonth,
}) => {
  const [mode, setMode] = useState<TrendViewMode>('daily');
  const activeMonth = monthFilter || selectedMonth;

  const trendData = React.useMemo(() => {
    return calculateTrendData(transactions, mode, activeMonth);
  }, [transactions, mode, activeMonth]);

  // Clean, adaptive tooltip for both light & dark
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const incomeVal = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
      const expenseVal = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
      const diff = incomeVal - expenseVal;

      return (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-100 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-[170px] pointer-events-none transition-colors">
          <div className="font-bold text-slate-900 dark:text-white mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Cash Flow</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                Income
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(incomeVal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                Expenses
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatINR(expenseVal)}</span>
            </div>

            <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Net:</span>
              <span className={`font-black ${diff >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                {diff >= 0 ? '+' : ''}{formatINR(diff)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="trend-line-chart-card"
      className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col p-5 h-full transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Income vs Expense Trend
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            {mode === 'daily' ? 'Daily cash flow' : 'Monthly overview'}
          </p>
        </div>

        {/* Daily / Monthly View Toggle Pill */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[10px] sm:text-xs font-bold">
          <button
            type="button"
            id="trend-toggle-daily"
            onClick={() => setMode('daily')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              mode === 'daily'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            id="trend-toggle-monthly"
            onClick={() => setMode('monthly')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              mode === 'monthly'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {trendData.length === 0 ? (
        <div
          id="empty-trend-state"
          className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
            <BarChart2 className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No income or expense data yet.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
            Add income and expense transactions to generate cash flow trends.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1', strokeOpacity: 0.3 }}
              />
              <YAxis
                tickFormatter={(val) => formatCompactINR(val)}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 50 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#059669', strokeWidth: 1.5, stroke: '#ffffff' }}
                activeDot={{ r: 5, stroke: '#059669', strokeWidth: 2, fill: '#ffffff' }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke="#dc2626"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#dc2626', strokeWidth: 1.5, stroke: '#ffffff' }}
                activeDot={{ r: 5, stroke: '#dc2626', strokeWidth: 2, fill: '#ffffff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
