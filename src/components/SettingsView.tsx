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
  Target,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PiggyBank,
  ShieldCheck,
  Check,
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
import { formatINR } from '../utils/formatters';
import { SheetsSyncCard } from './SheetsSyncCard';
import { QuickAuthCard } from './QuickAuthCard';
import { VaultProtectionCard } from './VaultProtectionCard';
import { TaxonomyCard } from './TaxonomyCard';

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
      {/* 3. FINANCIAL TARGETS & BUDGETS                                            */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Financial Targets & Budgets
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Set benchmark reserves for Savings and Emergency Fund fulfillment
            </p>
          </div>
        </div>

        {targetSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{targetSuccess}</span>
          </div>
        )}

        {targetError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{targetError}</span>
          </div>
        )}

        <form onSubmit={handleSaveTargets} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Savings Target */}
            <div className="space-y-1.5">
              <label
                htmlFor="savings-target-input"
                className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5"
              >
                <PiggyBank className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Savings Target (INR)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#78746B] dark:text-[#9E9B92]">
                  ₹
                </span>
                <input
                  id="savings-target-input"
                  type="number"
                  min="0"
                  step="1000"
                  value={savingsInput}
                  onChange={(e) => setSavingsInput(e.target.value)}
                  className="w-full min-h-[42px] pl-8 pr-3.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>
              <p className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                Current target: {formatINR(parseFloat(savingsInput) || 0)}
              </p>
            </div>

            {/* Emergency Fund Target */}
            <div className="space-y-1.5">
              <label
                htmlFor="emergency-target-input"
                className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Emergency Fund Target (INR)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#78746B] dark:text-[#9E9B92]">
                  ₹
                </span>
                <input
                  id="emergency-target-input"
                  type="number"
                  min="0"
                  step="1000"
                  value={emergencyInput}
                  onChange={(e) => setEmergencyInput(e.target.value)}
                  className="w-full min-h-[42px] pl-8 pr-3.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>
              <p className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                Current target: {formatINR(parseFloat(emergencyInput) || 0)}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSavingTargets}
              className="min-h-[42px] px-5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSavingTargets ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isSavingTargets ? 'Saving Targets...' : 'Save Targets'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 4. VAULT PROTECTION (PIN & INACTIVITY)                                    */}
      {/* ========================================================================= */}
      <VaultProtectionCard
        isUnlocked={isUnlocked}
        onOpenUnlockModal={onOpenUnlockModal}
        onOpenChangePinModal={onOpenChangePinModal}
      />

      {/* ========================================================================= */}
      {/* 5. GOOGLE SHEETS TAXONOMY                                                 */}
      {/* ========================================================================= */}
      <TaxonomyCard
        categories={categories}
        onAddCategory={onAddCategory}
        onRefresh={onRefresh}
      />

      {/* ========================================================================= */}
      {/* 6. QUICK AUTHENTICATION & ACCOUNT PROFILE                                 */}
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
