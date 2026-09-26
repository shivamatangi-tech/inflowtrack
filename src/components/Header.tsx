/**
 * ============================================================================
 * File: src/components/Header.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Sticky top navigation bar styled in the warm stone & obsidian neobank
 *   aesthetic using Poppins typography, soft stone pill tabs, and circular
 *   utility buttons.
 * ============================================================================
 */

import React from 'react';
import {
  RefreshCw,
  Settings,
  Lock,
  Unlock,
  Sun,
  Moon,
  Download,
} from 'lucide-react';
import { SpreadsheetInfo, AppViewTab, ThemeMode } from '../types';
import { formatINR } from '../utils/formatters';

interface HeaderProps {
  sheetInfo: SpreadsheetInfo | null;
  netBalance?: number;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onDownloadSheet?: () => Promise<void>;
  isDownloadingSheet?: boolean;
  onOpenSettings: () => void;
  userEmail?: string | null;
  userName?: string | null;
  userPhoto?: string | null;
  activeDesktopTab?: AppViewTab;
  onTabChange?: (tab: AppViewTab) => void;
  isUnlocked?: boolean;
  onOpenUnlockModal?: () => void;
  onLock?: () => void;
  currentTheme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export const Header: React.FC<HeaderProps> = ({
  netBalance,
  onRefresh,
  isRefreshing,
  onDownloadSheet,
  isDownloadingSheet = false,
  onOpenSettings,
  userEmail,
  userName,
  userPhoto,
  activeDesktopTab = 'dashboard',
  onTabChange,
  isUnlocked = false,
  onOpenUnlockModal,
  onLock,
  currentTheme,
  onThemeChange,
}) => {
  const displayUser =
    userName || (userEmail ? userEmail.split('@')[0] : 'inflotrack');

  return (
    <header className="bg-[#F4F3EF]/95 dark:bg-[#121311]/95 backdrop-blur-md border-b border-[#E6E4DD] dark:border-[#262724] px-4 sm:px-6 h-18 sticky top-0 z-30 flex items-center transition-colors">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Emblem & Personal Greeting (Aurora style) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#1C1D1B] border border-[#E6E4DD] dark:border-[#2C2D2A] shadow-2xs flex items-center justify-center shrink-0">
            <div className="flex items-center -space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#181816] dark:bg-[#F4F3EF]" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#4A5240] dark:bg-[#8C7355] opacity-90" />
            </div>
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-normal text-[#8A8880] dark:text-[#9E9C94]">
              {getGreeting()}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-semibold tracking-tight text-[#181816] dark:text-white capitalize truncate max-w-[160px] sm:max-w-[220px]">
                {displayUser}
              </span>
              <span className="hidden sm:inline text-xs font-medium text-[#8A8880] dark:text-[#7A7870]">
                · inflotrack
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Soft Stone Segmented Pill Navigation */}
        {onTabChange && (
          <nav className="hidden md:flex items-center bg-[#EAE8E1] dark:bg-[#1C1D1B] p-1 rounded-full border border-[#E2DFD7] dark:border-[#2A2B28]">
            <button
              type="button"
              id="desktop-tab-dashboard"
              onClick={() => onTabChange('dashboard')}
              className={`px-5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeDesktopTab === 'dashboard'
                  ? 'bg-white dark:bg-[#2C2D2A] text-[#181816] dark:text-white shadow-2xs'
                  : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              id="desktop-tab-goals"
              onClick={() => onTabChange('goals')}
              className={`px-5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeDesktopTab === 'goals'
                  ? 'bg-white dark:bg-[#2C2D2A] text-[#181816] dark:text-white shadow-2xs'
                  : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
              }`}
            >
              Goals & Reserves
            </button>
          </nav>
        )}

        {/* Zone 3: Live Balance & Circular Stone Controls */}
        <div className="flex items-center gap-2">
          {typeof netBalance === 'number' && (
            <div className="hidden lg:flex items-center gap-2 pr-3 mr-1 border-r border-[#E2DFD7] dark:border-[#262724]">
              <span className="text-xs text-[#8A8880] dark:text-[#9E9C94]">Total balance</span>
              <span
                className={`tabular-nums text-sm font-semibold ${
                  netBalance >= 0
                    ? 'text-[#181816] dark:text-white'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatINR(netBalance)}
              </span>
            </div>
          )}

          {/* Security Lock / Unlock Pill */}
          {isUnlocked ? (
            <button
              type="button"
              id="btn-header-lock-toggle"
              onClick={onLock}
              title="Lock protected balances and targets"
              className="h-9 px-3.5 text-xs font-medium text-[#181816] dark:text-[#F4F3EF] bg-[#EAE8E1] dark:bg-[#1C1D1B] hover:bg-[#DFDDD4] dark:hover:bg-[#282926] rounded-full flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Unlock className="w-3.5 h-3.5 text-[#2E7D32] dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Unlocked</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-header-unlock-toggle"
              onClick={onOpenUnlockModal}
              title="Unlock protected balances and targets with 4-digit PIN"
              className="h-9 px-3.5 text-xs font-medium text-[#181816] dark:text-[#F4F3EF] bg-[#EAE8E1] dark:bg-[#1C1D1B] hover:bg-[#DFDDD4] dark:hover:bg-[#282926] rounded-full flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-[#8C7355] dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Locked</span>
            </button>
          )}

          {/* Sync Button */}
          <button
            type="button"
            id="btn-header-refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sync with Google Sheets"
            className="h-9 px-3.5 text-xs font-medium text-[#181816] dark:text-[#F4F3EF] bg-[#EAE8E1] dark:bg-[#1C1D1B] hover:bg-[#DFDDD4] dark:hover:bg-[#282926] rounded-full flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${
                isRefreshing
                  ? 'animate-spin text-[#4A5240] dark:text-emerald-400'
                  : 'text-[#6E6D68] dark:text-[#9E9C94]'
              }`}
            />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing' : 'Sync'}</span>
          </button>

          {/* Store in Drive & Download Sheet Button */}
          {onDownloadSheet && (
            <button
              type="button"
              id="btn-header-download-sheet"
              onClick={() => void onDownloadSheet()}
              disabled={isDownloadingSheet}
              title="Store in Google Drive folder and download inflotrack sheet"
              className="h-9 px-4 text-xs font-medium text-white dark:text-[#181816] bg-[#181816] hover:bg-[#2C2D2A] dark:bg-[#F4F3EF] dark:hover:bg-[#E6E4DD] rounded-full flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {isDownloadingSheet ? 'Exporting...' : 'Download Sheet'}
              </span>
            </button>
          )}

          {/* Theme Switcher */}
          {onThemeChange && currentTheme && (
            <button
              type="button"
              id="btn-header-theme-toggle"
              onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#181816] dark:text-[#F4F3EF] bg-[#EAE8E1] dark:bg-[#1C1D1B] hover:bg-[#DFDDD4] dark:hover:bg-[#282926] transition-colors cursor-pointer"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-[#181816] shrink-0" />
              )}
            </button>
          )}

          {/* Settings Trigger */}
          <button
            type="button"
            id="btn-header-settings"
            onClick={onOpenSettings}
            title="Open Settings"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#181816] dark:text-[#F4F3EF] bg-[#EAE8E1] dark:bg-[#1C1D1B] hover:bg-[#DFDDD4] dark:hover:bg-[#282926] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Avatar */}
          {userPhoto ? (
            <img
              src={userPhoto}
              alt="Profile"
              className="w-9 h-9 rounded-full border border-[#E2DFD7] dark:border-[#2C2D2A] shrink-0 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#181816] dark:bg-[#2C2D2A] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
