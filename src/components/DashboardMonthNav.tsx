/**
 * ============================================================================
 * File: src/components/DashboardMonthNav.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Period navigation bar styled with Poppins typography and soft stone
 *   segmented pill controls.
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
  getCurrentMonthKey,
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
  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonth = selectedMonth === currentMonthKey;

  const handlePrev = () => {
    onMonthChange(getPreviousMonthKey(selectedMonth));
  };

  const handleNext = () => {
    onMonthChange(getNextMonthKey(selectedMonth));
  };

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
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      {/* Left: Active Period Heading */}
      <div className="flex items-baseline gap-3">
        <h2
          id="current-dashboard-month-label"
          className="text-xl sm:text-2xl font-semibold text-[#181816] dark:text-white tracking-tight"
        >
          {formatMonthYear(selectedMonth)}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-[#8A8880] dark:text-[#9E9C94]">
          <span>Analytics & Ledger</span>
          {!isCurrentMonth && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onMonthChange(currentMonthKey)}
                className="text-[#4A5240] dark:text-[#B8A38A] hover:underline font-medium cursor-pointer"
              >
                Current month
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right: Soft Stone Pill Selector */}
      <div className="flex items-center gap-1 self-start sm:self-auto bg-[#EAE8E1] dark:bg-[#1C1D1B] p-1 rounded-full border border-[#E2DFD7] dark:border-[#2A2B28]">
        <button
          type="button"
          id="btn-dash-prev-month"
          onClick={handlePrev}
          title="Previous Month"
          aria-label="Previous Month"
          className="w-8 h-8 flex items-center justify-center text-[#181816] dark:text-[#F4F3EF] hover:bg-white dark:hover:bg-[#2C2D2A] rounded-full transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 bg-white dark:bg-[#2C2D2A] px-3 py-1 rounded-full shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-[#8A8880] dark:text-[#9E9C94] shrink-0 mr-0.5" />
          <select
            id="select-dash-month"
            value={monthStr}
            onChange={handleMonthSelect}
            className="bg-transparent text-xs font-medium text-[#181816] dark:text-white focus:outline-none cursor-pointer"
          >
            {months.map((m) => (
              <option
                key={m.num}
                value={m.num}
                className="bg-white dark:bg-[#1C1D1B] text-[#181816] dark:text-white"
              >
                {m.name}
              </option>
            ))}
          </select>

          <span className="text-[#C7C3B8] dark:text-[#5C5B57]" aria-hidden="true">
            /
          </span>

          <select
            id="select-dash-year"
            value={yearStr}
            onChange={handleYearSelect}
            className="bg-transparent tabular-nums text-xs font-medium text-[#181816] dark:text-white focus:outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option
                key={y}
                value={String(y)}
                className="bg-white dark:bg-[#1C1D1B] text-[#181816] dark:text-white"
              >
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          id="btn-dash-next-month"
          onClick={handleNext}
          title="Next Month"
          aria-label="Next Month"
          className="w-8 h-8 flex items-center justify-center text-[#181816] dark:text-[#F4F3EF] hover:bg-white dark:hover:bg-[#2C2D2A] rounded-full transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
