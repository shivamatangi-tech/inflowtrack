/**
 * ============================================================================
 * File: src/components/ExpensePieChart.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Renders the "Spending by category" card styled directly after the right
 *   screen of the Aurora reference image: side-by-side Donut Chart (with
 *   INR / Amount / Total in the center) + Category Breakdown list + bottom
 *   warm-stone Spending Insight card.
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

interface ExpensePieChartProps {
  data: CategoryExpense[];
  monthLabel?: string;
}

export const ExpensePieChart: React.FC<ExpensePieChartProps> = ({ data, monthLabel }) => {
  const displayMonth = monthLabel || 'Selected Period';
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const topCategory = data.length > 0 ? data[0] : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: CategoryExpense = payload[0].payload;
      return (
        <div className="bg-[#181816] text-white p-2.5 rounded-2xl shadow-xl text-xs border border-white/10 min-w-[150px] pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-semibold text-white truncate">{item.category}</span>
          </div>
          <div className="text-[#D4B896] tabular-nums font-semibold text-sm mt-0.5">
            {formatINR(item.amount)}
          </div>
          <div className="text-white/60 tabular-nums text-[11px] mt-0.5">
            {item.percentage}% of spending
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="expense-pie-chart-card"
      className="bg-white dark:bg-[#1A1B19] rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] flex flex-col justify-between p-5 sm:p-6 h-full transition-colors gap-4"
    >
      <div>
        {/* Card Header matching "Spending by category | See all" */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#181816] dark:text-white tracking-tight">
            Spending by category
          </h2>
          <span className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94]">
            {displayMonth}
          </span>
        </div>

        {data.length === 0 ? (
          <div
            id="empty-pie-state"
            className="min-h-[210px] flex flex-col items-center justify-center text-center p-6 bg-[#F4F3EF]/60 dark:bg-[#141513] rounded-2xl"
          >
            <p className="text-sm font-medium text-[#181816] dark:text-white">
              No expenses in {displayMonth}
            </p>
            <p className="text-xs text-[#8A8880] dark:text-[#9E9C94] mt-1 max-w-[210px]">
              Record an expense entry to view your category distribution.
            </p>
          </div>
        ) : (
          /* Side-by-side Donut + Legend Layout matching reference image */
          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
            {/* Left: Donut Chart with INR / Amount / Total in center */}
            <div className="sm:col-span-5 h-[165px] w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="currentColor"
                    className="text-white dark:text-[#1A1B19]"
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

              {/* Center Readout: INR / Amount / Total */}
              <div className="absolute rounded-full w-22 h-22 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-[#8A8880] dark:text-[#9E9C94] font-medium">
                  INR
                </span>
                <span className="tabular-nums text-xs font-semibold text-[#181816] dark:text-white leading-tight mt-0.5">
                  {formatCompactINR(totalAmount)}
                </span>
                <span className="text-[10px] text-[#8A8880] dark:text-[#9E9C94] mt-0.5">
                  Total
                </span>
              </div>
            </div>

            {/* Right: Category Breakdown List with stacked amount & right percentage */}
            <div className="sm:col-span-7 space-y-2.5 max-h-[185px] overflow-y-auto pr-1">
              {data.map((item) => (
                <div
                  key={item.category}
                  className="flex items-start justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-[#181816] dark:text-white truncate">
                        {item.category}
                      </div>
                      <div className="tabular-nums text-[11px] text-[#8A8880] dark:text-[#9E9C94]">
                        {formatINR(item.amount)}
                      </div>
                    </div>
                  </div>
                  <span className="tabular-nums font-semibold text-[#181816] dark:text-white shrink-0">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Warm Stone Insight Card (matching bottom of right screen in reference image) */}
      <div className="rounded-2xl bg-[#8E8C84] dark:bg-[#262724] text-white p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/75 font-medium">
          {topCategory ? 'Top spending category' : 'Monthly spending insight'}
        </p>
        <p className="text-sm font-semibold text-white mt-0.5">
          {topCategory
            ? `${topCategory.category} (${topCategory.percentage}%)`
            : 'Balanced Monthly Outflow'}
        </p>
        <p className="text-[11px] text-white/80 mt-1 leading-relaxed">
          {topCategory
            ? `${formatINR(topCategory.amount)} allocated to ${topCategory.category} in ${displayMonth}.`
            : 'Your category breakdown updates automatically as you record transactions.'}
        </p>
      </div>
    </div>
  );
};
