/**
 * ============================================================================
 * File: src/components/DashboardMonthNav.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Dashboard period navigation bar allowing users to step forward/backward
 *   month-by-month or jump directly to any Month and Year via dropdowns.
 *
 * Key Responsibilities:
 *   1. Displays the currently active dashboard period (e.g., "September 2026").
 *   2. Emits `onMonthChange('YYYY-MM')` to filter dashboard summary cards,
 *      charts, and the transactions table.
 * ============================================================================
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import {
  formatMonthYear,
  getPreviousMonthKey,
  getNextMonthKey,
} from '../utils/formatters';

interface DashboardMonthNavProps {
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  availableMonths?: string[];
}

export const DashboardMonthNav: React.FC<DashboardMonthNavProps> = ({
  selectedMonth,
  onMonthChange,
}) => {
  const handlePrev = () => {
    onMonthChange(getPreviousMonthKey(selectedMonth));
  };

  const handleNext = () => {
    onMonthChange(getNextMonthKey(selectedMonth));
  };

  // Split selectedMonth into year and month for select dropdowns
  const [yearStr, monthStr] = selectedMonth.split('-');
  const currentYear = parseInt(yearStr || '2026', 10);

  const months = [
    { num: '01', name: 'January' },
    { num: '02', name: 'February' },
    { num: '03', name: 'March' },
    { num: '04', name: 'April' },
    { num: '05', name: 'May' },
    { num: '06', name: 'June' },
    { num: '07', name: 'July' },
    { num: '08', name: 'August' },
    { num: '09', name: 'September' },
    { num: '10', name: 'October' },
    { num: '11', name: 'November' },
    { num: '12', name: 'December' },
  ];

  // Generate range of years around current year
  const years = Array.from({ length: 9 }, (_, i) => currentYear - 4 + i);

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    onMonthChange(`${yearStr}-${newMonth}`);
  };

  const handleYearSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = e.target.value;
    onMonthChange(`${newYear}-${monthStr}`);
  };

  return (
    <div
      id="dashboard-month-nav"
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
    >
      {/* Left: Section Label & Clear Selected Period Indicator */}
      <div className="flex items-center justify-center sm:justify-start gap-2.5 text-center sm:text-left">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Dashboard Period
          </div>
          <div
            id="current-dashboard-month-label"
            className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight"
          >
            {formatMonthYear(selectedMonth)}
          </div>
        </div>
      </div>

      {/* Right: Smooth Month / Year Stepper and Direct Selectors */}
      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
        {/* Previous Month */}
        <button
          type="button"
          id="btn-dash-prev-month"
          onClick={handlePrev}
          title="Previous Month"
          aria-label="Previous Month"
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Month Dropdown */}
        <select
          id="select-dash-month"
          value={monthStr}
          onChange={handleMonthSelect}
          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          {months.map((m) => (
            <option key={m.num} value={m.num}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Year Dropdown */}
        <select
          id="select-dash-year"
          value={yearStr}
          onChange={handleYearSelect}
          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>

        {/* Next Month */}
        <button
          type="button"
          id="btn-dash-next-month"
          onClick={handleNext}
          title="Next Month"
          aria-label="Next Month"
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
