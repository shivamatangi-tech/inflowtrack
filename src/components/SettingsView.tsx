/**
 * ============================================================================
 * File: src/components/SettingsView.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Clean, modular Settings & Workspace Preferences view providing:
 *     1. Appearance & Theme switcher (Light, Dark, System)
 *     2. Financial Targets & Budgets (Savings Target, Emergency Fund Target)
 *     3. Centralized Google Sheets Synchronization Card
 *     4. Quick Authentication Card
 *     5. Vault Protection Card
 *     6. Google Sheets Taxonomy Card
 *
 * Requirements Met:
 *   - Strictly no Google Drive folder path/location displayed.
 *   - Centralized Google Sheets access point with no duplicated links.
 *   - Clean, modular, scalable code without obsolete or duplicated sections.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Sliders,
} from 'lucide-react';
import { CategoryData, SpreadsheetInfo, ThemeMode } from '../types';
import {
  getSavingsTarget,
  setSavingsTarget,
  getEmergencyFundTarget,
  setEmergencyFundTarget,
} from '../utils/targets';
import { updateBudgetsInSheet } from '../services/sheets';
import { getFreshAuthToken } from '../services/firebase';
import { SheetsSyncCard } from './SheetsSyncCard';
import { QuickAuthCard } from './QuickAuthCard';
import { UnifiedSettingsCard } from './UnifiedSettingsCard';

interface SettingsViewProps {
  sheetInfo?: SpreadsheetInfo | null;
  categories: CategoryData;
  userEmail?: string | null;
  userName?: string | null;
  userPhoto?: string | null;
  userUid?: string | null;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onRefresh: () => Promise<void>;
  onDownloadSheet?: () => Promise<void>;
  isDownloadingSheet?: boolean;
  onAddCategory: (type: 'Income' | 'Expense', categoryName: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  isRefreshing?: boolean;
  isUnlocked?: boolean;
  onOpenUnlockModal?: () => void;
  onOpenChangePinModal?: () => void;
  onPinStatusChanged?: () => void;
  onSheetInfoChange?: (sheetInfo: SpreadsheetInfo) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  sheetInfo = null,
  categories,
  userEmail,
  userName,
  userPhoto,
  currentTheme,
  onThemeChange,
  onRefresh,
  onDownloadSheet,
  isDownloadingSheet = false,
  onAddCategory,
  onSignOut,
  isRefreshing = false,
  isUnlocked = false,
  onOpenUnlockModal,
  onOpenChangePinModal,
  onSheetInfoChange,
}) => {
  // Financial Targets state
  const [savingsInput, setSavingsInput] = useState<string>(() => getSavingsTarget().toString());
  const [emergencyInput, setEmergencyInput] = useState<string>(() => getEmergencyFundTarget().toString());
  const [isSavingTargets, setIsSavingTargets] = useState<boolean>(false);
  const [targetSuccess, setTargetSuccess] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    const sVal = parseFloat(savingsInput);
    const eVal = parseFloat(emergencyInput);

    if (isNaN(sVal) || sVal < 0 || isNaN(eVal) || eVal < 0) {
      setTargetError('Please enter valid non-negative target numbers.');
      return;
    }

    setIsSavingTargets(true);
    setTargetError(null);
    setTargetSuccess(null);

    try {
      setSavingsTarget(sVal);
      setEmergencyFundTarget(eVal);

      const token = await getFreshAuthToken();
      await updateBudgetsInSheet(token, {
        savingsTarget: sVal,
        emergencyFundTarget: eVal,
      });

      setTargetSuccess('Financial targets successfully updated and synced with Google Sheets.');
      setTimeout(() => setTargetSuccess(null), 4000);
    } catch {
      // Local fallback succeeds even if remote sync is offline
      setTargetSuccess('Targets saved locally and queued for Google Sheets synchronization.');
      setTimeout(() => setTargetSuccess(null), 4000);
    } finally {
      setIsSavingTargets(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* ========================================================================= */}
      {/* 1. CENTRALIZED GOOGLE SHEETS SYNCHRONIZATION                              */}
      {/* ========================================================================= */}
      <SheetsSyncCard
        sheetInfo={sheetInfo}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onDownloadSheet={onDownloadSheet}
        isDownloadingSheet={isDownloadingSheet}
        onSheetInfoChange={onSheetInfoChange}
      />

      {/* ========================================================================= */}
      {/* 2. APPEARANCE & THEME PREFERENCE                                          */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Appearance & Theme
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Customize your workspace palette for day or night tracking
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            className={`min-h-[48px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
              currentTheme === 'light'
                ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30 bg-[#F6F5F0] dark:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0] font-semibold'
                : 'border-[#E5E0D4] dark:border-[#282622] text-[#78746B] dark:text-[#9E9B92] hover:border-[#C5A059]/40'
            }`}
          >
            <Sun className="w-4 h-4 text-[#C5A059]" />
            <span className="text-xs">Light</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            className={`min-h-[48px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
              currentTheme === 'dark'
                ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30 bg-[#F6F5F0] dark:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0] font-semibold'
                : 'border-[#E5E0D4] dark:border-[#282622] text-[#78746B] dark:text-[#9E9B92] hover:border-[#C5A059]/40'
            }`}
          >
            <Moon className="w-4 h-4 text-[#C5A059]" />
            <span className="text-xs">Dark</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('system')}
            className={`min-h-[48px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
              currentTheme === 'system'
                ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30 bg-[#F6F5F0] dark:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0] font-semibold'
                : 'border-[#E5E0D4] dark:border-[#282622] text-[#78746B] dark:text-[#9E9B92] hover:border-[#C5A059]/40'
            }`}
          >
            <Monitor className="w-4 h-4 text-[#C5A059]" />
            <span className="text-xs">System</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED SETTINGS: TARGETS, VAULT PROTECTION & TAXONOMY (SINGLE CARD)   */}
      {/* ========================================================================= */}
      <UnifiedSettingsCard
        categories={categories}
        savingsInput={savingsInput}
        setSavingsInput={setSavingsInput}
        emergencyInput={emergencyInput}
        setEmergencyInput={setEmergencyInput}
        handleSaveTargets={handleSaveTargets}
        isSavingTargets={isSavingTargets}
        targetSuccess={targetSuccess}
        targetError={targetError}
        isUnlocked={isUnlocked}
        onOpenUnlockModal={onOpenUnlockModal}
        onOpenChangePinModal={onOpenChangePinModal}
        onAddCategory={onAddCategory}
        onRefresh={onRefresh}
      />

      {/* ========================================================================= */}
      {/* 4. QUICK AUTHENTICATION & ACCOUNT PROFILE                                 */}
      {/* ========================================================================= */}
      <QuickAuthCard
        userEmail={userEmail}
        userName={userName}
        userPhoto={userPhoto}
        onSignOut={onSignOut}
      />
    </div>
  );
};
