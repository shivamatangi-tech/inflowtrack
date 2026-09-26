/**
 * ============================================================================
 * File: src/components/Header.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Sticky top navigation bar for both desktop and mobile views.
 *
 * Key Responsibilities:
 *   1. Displays the application brand identity ("inflotrack — Track Save Grow").
 *   2. Renders desktop view switcher tabs (Dashboard vs. Goals).
 *   3. Shows live lifetime net balance, quick Light/Dark theme toggle,
 *      4-digit Security PIN Lock/Unlock button, manual Google Sheets Sync
 *      trigger, Settings button, and authenticated user avatar.
 * ============================================================================
 */

import React from 'react';
import {
  RefreshCw,
  Settings,
  LayoutDashboard,
  Target,
  Lock,
  Unlock,
  Sun,
  Moon,
} from 'lucide-react';
import { SpreadsheetInfo, AppViewTab, ThemeMode } from '../types';
import { formatINR } from '../utils/formatters';

interface HeaderProps {
  sheetInfo: SpreadsheetInfo | null;
  netBalance?: number;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onOpenSettings: () => void;
  userEmail?: string | null;
  userPhoto?: string | null;
  activeDesktopTab?: AppViewTab;
  onTabChange?: (tab: AppViewTab) => void;
  isUnlocked?: boolean;
  onOpenUnlockModal?: () => void;
  onLock?: () => void;
  currentTheme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  netBalance,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  userEmail,
  userPhoto,
  activeDesktopTab = 'dashboard',
  onTabChange,
  isUnlocked = false,
  onOpenUnlockModal,
  onLock,
  currentTheme,
  onThemeChange,
}) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 h-9 w-9 rounded-xl flex items-center justify-center shadow-xs shrink-0 text-white">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                inflotrack
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px] sm:max-w-xs font-semibold tracking-wide">
              Track Save Grow
            </p>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs (Dashboard & Goals) */}
        {onTabChange && (
          <nav className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              id="desktop-tab-dashboard"
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDesktopTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              type="button"
              id="desktop-tab-goals"
              onClick={() => onTabChange('goals')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDesktopTab === 'goals'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Target className="w-4 h-4" />
              Goals
            </button>
          </nav>
        )}

        {/* Right: Balance & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {typeof netBalance === 'number' && (
            <div className="hidden lg:flex flex-col items-end pr-3 border-r border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">
                Live Balance
              </span>
              <span className={`text-base font-extrabold ${netBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatINR(netBalance)}
              </span>
            </div>
          )}

          {/* Quick Theme Switcher Button with centered Sun/Moon */}
          {onThemeChange && currentTheme && (
            <button
              type="button"
              id="btn-header-theme-toggle"
              onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
            </button>
          )}

          {/* Security Lock / Unlock Button with clear icon symbol */}
          {isUnlocked ? (
            <button
              type="button"
              id="btn-header-lock-toggle"
              onClick={onLock}
              title="Lock protected balances and targets"
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-header-unlock-toggle"
              onClick={onOpenUnlockModal}
              title="Unlock protected balances and targets with 4-digit PIN"
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Unlock</span>
            </button>
          )}

          {/* Sync Button */}
          <button
            type="button"
            id="btn-header-refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sync with Google Sheets"
            className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
            />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Settings Trigger */}
          <button
            type="button"
            id="btn-header-settings"
            onClick={onOpenSettings}
            title="Open Settings"
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* User Avatar */}
          {userPhoto ? (
            <img
              src={userPhoto}
              alt="Profile"
              className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
