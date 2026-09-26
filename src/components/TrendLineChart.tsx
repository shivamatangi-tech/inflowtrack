/**
 * ============================================================================
 * File: src/components/TrendLineChart.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the Income vs. Expense Cashflow Trajectory Line Chart styled in
 *   the warm stone, deep olive (#4A5240), and bronze (#8C7355) palette.
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const incomeVal = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
      const expenseVal = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
      const diff = incomeVal - expenseVal;

      return (
        <div className="bg-[#181816] text-white p-3.5 rounded-2xl shadow-xl border border-white/10 text-xs min-w-[170px] pointer-events-none">
          <div className="font-semibold text-[#EAE8E1] mb-2 pb-1.5 border-b border-white/10 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-white/60">Cashflow</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#A5B496]">Income</span>
              <span className="tabular-nums font-semibold text-[#A5B496]">
                {formatINR(incomeVal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[#D4B896]">Expenses</span>
              <span className="tabular-nums font-semibold text-[#D4B896]">
                {formatINR(expenseVal)}
              </span>
            </div>

            <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-white/60">Net</span>
              <span className="tabular-nums font-semibold text-white">
                {diff >= 0 ? '+' : ''}
                {formatINR(diff)}
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
      className="bg-white dark:bg-[#1A1B19] rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] flex flex-col p-5 sm:p-6 h-full transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-base font-semibold text-[#181816] dark:text-white tracking-tight">
            Cashflow trajectory
          </h2>
          <p className="text-xs text-[#8A8880] dark:text-[#9E9C94] mt-0.5">
            {mode === 'daily' ? 'Daily activity for selected month' : 'Monthly historical trajectory'}
          </p>
        </div>

        {/* Daily / Monthly Soft Stone Segmented Pill */}
        <div className="flex bg-[#EAE8E1] dark:bg-[#262724] p-1 rounded-full text-xs font-medium">
          <button
            type="button"
            id="trend-toggle-daily"
            onClick={() => setMode('daily')}
            className={`px-3.5 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              mode === 'daily'
                ? 'bg-white dark:bg-[#181816] shadow-2xs text-[#181816] dark:text-white'
                : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            id="trend-toggle-monthly"
            onClick={() => setMode('monthly')}
            className={`px-3.5 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              mode === 'monthly'
                ? 'bg-white dark:bg-[#181816] shadow-2xs text-[#181816] dark:text-white'
                : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {trendData.length === 0 ? (
        <div
          id="empty-trend-state"
          className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center p-6 bg-[#F4F3EF]/60 dark:bg-[#141513] rounded-2xl"
        >
          <p className="text-sm font-medium text-[#181816] dark:text-white">
            No cashflow trajectory yet
          </p>
          <p className="text-xs text-[#8A8880] dark:text-[#9E9C94] mt-1 max-w-[240px]">
            Add income and expense entries to visualize your daily and monthly cashflow curves.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#DCD9D0" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: '#8A8880' }}
                tickLine={false}
                axisLine={{ stroke: '#E6E4DD', strokeOpacity: 0.6 }}
              />
              <YAxis
                tickFormatter={(val) => formatCompactINR(val)}
                tick={{ fontSize: 11, fill: '#8A8880' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#4A5240', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 50 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontWeight: 500 }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#4A5240"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#4A5240', strokeWidth: 1.5, stroke: '#ffffff' }}
                activeDot={{ r: 5, stroke: '#4A5240', strokeWidth: 2, fill: '#ffffff' }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke="#8C7355"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#8C7355', strokeWidth: 1.5, stroke: '#ffffff' }}
                activeDot={{ r: 5, stroke: '#8C7355', strokeWidth: 2, fill: '#ffffff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
