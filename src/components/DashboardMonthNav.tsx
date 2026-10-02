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
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E0D4] dark:border-[#262521]"
    >
      {/* Left: Active Period Heading */}
      <div className="flex items-baseline gap-3">
        <h2
          id="current-dashboard-month-label"
          className="font-display text-2xl sm:text-3xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight"
        >
          {formatMonthYear(selectedMonth)}
        </h2>
        {!isCurrentMonth && (
          <div className="flex items-center gap-1.5 text-xs text-[#78746B] dark:text-[#9E9B92]">
            <button
              type="button"
              onClick={() => onMonthChange(currentMonthKey)}
              className="text-[#8E7952] dark:text-[#C5A059] hover:underline font-medium cursor-pointer"
            >
              Return to current month
            </button>
          </div>
        )}
      </div>

      {/* Right: Refined Period Selector */}
      <div className="flex items-center justify-between sm:justify-start gap-1 w-full sm:w-auto bg-white dark:bg-[#161614] p-1 rounded-xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs">
        <button
          type="button"
          id="btn-dash-prev-month"
          onClick={handlePrev}
          title="Previous Month"
          aria-label="Previous Month"
          className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center text-[#141412] dark:text-[#F6F5F0] hover:bg-[#F6F5F0] dark:hover:bg-[#24231F] rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mr-0.5" />
          <select
            id="select-dash-month"
            value={monthStr}
            onChange={handleMonthSelect}
            className="bg-transparent text-xs font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none cursor-pointer"
          >
            {months.map((m) => (
              <option
                key={m.num}
                value={m.num}
                className="bg-white dark:bg-[#161614] text-[#141412] dark:text-[#F6F5F0]"
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
            className="bg-transparent tabular-nums text-xs font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option
                key={y}
                value={String(y)}
                className="bg-white dark:bg-[#161614] text-[#141412] dark:text-[#F6F5F0]"
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
          className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center text-[#141412] dark:text-[#F6F5F0] hover:bg-[#F6F5F0] dark:hover:bg-[#24231F] rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
