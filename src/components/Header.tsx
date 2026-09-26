/**
 * ============================================================================
 * File: src/components/Header.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Responsive luxury navigation bar with desktop horizontal links and a
 *   clean viewport-fitted mobile hamburger drawer in Warm Ivory, Deep
 *   Charcoal, and Muted Champagne Gold (#C5A059).
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  RefreshCw,
  Settings,
  Lock,
  Unlock,
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { SpreadsheetInfo, AppViewTab, ThemeMode } from '../types';

interface HeaderProps {
  sheetInfo: SpreadsheetInfo | null;
  netBalance?: number;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onDownloadSheet?: () => Promise<void>;
  isDownloadingSheet?: boolean;
  onOpenSettings: () => void;
  onOpenRecordEntry?: () => void;
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

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isRefreshing,
  onOpenSettings,
  onOpenRecordEntry,
  activeDesktopTab = 'dashboard',
  onTabChange,
  isUnlocked = false,
  onOpenUnlockModal,
  onLock,
  currentTheme,
  onThemeChange,
}) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleNavClick = (action: () => void) => {
    setIsMobileDrawerOpen(false);
    action();
  };

  return (
    <header className="w-full bg-[#F6F5F0]/95 dark:bg-[#111110]/95 backdrop-blur-md border-b border-[#E5E0D4] dark:border-[#262521] sticky top-0 z-30 transition-colors">
      <div className="fluid-container h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Single Text Element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setIsMobileDrawerOpen(false);
            if (onTabChange) onTabChange('dashboard');
          }}
          className="font-display text-2xl sm:text-[26px] font-semibold tracking-tight text-[#141412] dark:text-[#F6F5F0] whitespace-nowrap shrink-0"
        >
          inflotrack
        </a>

        {/* Zone 2: Minimal Clean Typography Navigation Links (Desktop / Tablet) */}
        {onTabChange && (
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium text-[#6E6A61] dark:text-[#A39F95]">
            <button
              type="button"
              id="desktop-tab-dashboard"
              onClick={() => onTabChange('dashboard')}
              className={`min-h-[44px] py-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center ${
                activeDesktopTab === 'dashboard'
                  ? 'border-[#C5A059] text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'border-transparent hover:text-[#141412] dark:hover:text-[#F6F5F0] hover:border-[#C5A059]/40'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              id="desktop-tab-goals"
              onClick={() => onTabChange('goals')}
              className={`min-h-[44px] py-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center ${
                activeDesktopTab === 'goals'
                  ? 'border-[#C5A059] text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'border-transparent hover:text-[#141412] dark:hover:text-[#F6F5F0] hover:border-[#C5A059]/40'
              }`}
            >
              Cards & Goals
            </button>
            {onOpenRecordEntry && (
              <button
                type="button"
                onClick={onOpenRecordEntry}
                className="min-h-[44px] py-1.5 border-b-2 border-transparent hover:text-[#141412] dark:hover:text-[#F6F5F0] hover:border-[#C5A059]/40 transition-all cursor-pointer whitespace-nowrap flex items-center"
              >
                Record Entry
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[44px] py-1.5 border-b-2 border-transparent hover:text-[#141412] dark:hover:text-[#F6F5F0] hover:border-[#C5A059]/40 transition-all cursor-pointer whitespace-nowrap flex items-center"
            >
              Preferences
            </button>
          </nav>
        )}

        {/* Zone 3: Refined Executive Actions (44x44px touch targets) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Security Lock / Unlock */}
          {isUnlocked ? (
            <button
              type="button"
              id="btn-header-lock-toggle"
              onClick={onLock}
              title="Lock protected balances and targets"
              className="min-h-[42px] min-w-[42px] sm:min-h-[40px] sm:px-3.5 text-xs font-medium text-[#141412] dark:text-[#F6F5F0] bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Unlock className="w-4 h-4 text-[#2E6F40] dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Unlocked</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-header-unlock-toggle"
              onClick={onOpenUnlockModal}
              title="Unlock protected balances and targets with 4-digit PIN"
              className="min-h-[42px] min-w-[42px] sm:min-h-[40px] sm:px-3.5 text-xs font-medium text-[#141412] dark:text-[#F6F5F0] bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-4 h-4 text-[#C5A059] shrink-0" />
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
            className="min-h-[42px] min-w-[42px] sm:min-h-[40px] sm:px-3.5 text-xs font-medium text-[#141412] dark:text-[#F6F5F0] bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${
                isRefreshing
                  ? 'animate-spin text-[#C5A059]'
                  : 'text-[#78746B] dark:text-[#9E9B92]'
              }`}
            />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing' : 'Sync'}</span>
          </button>

          {/* Theme Switcher */}
          {onThemeChange && currentTheme && (
            <button
              type="button"
              id="btn-header-theme-toggle"
              onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="min-h-[42px] min-w-[42px] sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-[#141412] dark:text-[#F6F5F0] bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] transition-colors cursor-pointer"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#C5A059] shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-[#141412] shrink-0" />
              )}
            </button>
          )}

          {/* Desktop Settings Trigger */}
          <button
            type="button"
            id="btn-header-settings"
            onClick={onOpenSettings}
            title="Open Settings"
            className="hidden md:flex w-10 h-10 rounded-xl items-center justify-center text-[#141412] dark:text-[#F6F5F0] bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            id="btn-header-mobile-drawer"
            onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
            aria-expanded={isMobileDrawerOpen}
            aria-label="Open navigation menu"
            className="md:hidden min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center text-[#141412] dark:text-[#F6F5F0] bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] transition-colors cursor-pointer"
          >
            {isMobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Navigation Menu */}
      {isMobileDrawerOpen && (
        <div className="md:hidden w-full bg-[#F6F5F0] dark:bg-[#141412] border-b border-[#E5E0D4] dark:border-[#262521] px-4 py-4 space-y-2 shadow-lg">
          {onTabChange && (
            <button
              type="button"
              onClick={() => handleNavClick(() => onTabChange('dashboard'))}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-xs font-medium text-[#141412] dark:text-[#F6F5F0] hover:bg-white dark:hover:bg-[#1E1E1B] transition-colors cursor-pointer"
            >
              <span>Executive Overview</span>
              <ArrowUpRight className="w-4 h-4 text-[#C5A059]" />
            </button>
          )}
          {onTabChange && (
            <button
              type="button"
              onClick={() => handleNavClick(() => onTabChange('goals'))}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-xs font-medium text-[#141412] dark:text-[#F6F5F0] hover:bg-white dark:hover:bg-[#1E1E1B] transition-colors cursor-pointer"
            >
              <span>Cards, Vault & Goals</span>
              <ArrowUpRight className="w-4 h-4 text-[#C5A059]" />
            </button>
          )}
          {onOpenRecordEntry && (
            <button
              type="button"
              onClick={() => handleNavClick(onOpenRecordEntry)}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-xs font-semibold bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] transition-colors cursor-pointer"
            >
              <span>+ Record Transaction</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNavClick(onOpenSettings)}
            className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-xs font-medium text-[#141412] dark:text-[#F6F5F0] hover:bg-white dark:hover:bg-[#1E1E1B] transition-colors cursor-pointer"
          >
            <span>Workspace Preferences & PIN</span>
            <Settings className="w-4 h-4 text-[#C5A059]" />
          </button>
        </div>
      )}
    </header>
  );
};
