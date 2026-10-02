/**
 * ============================================================================
 * File: src/components/UnifiedSettingsCard.tsx
 * Application: inflowtrack — Track Save Grow
 * Purpose:
 *   Combines Financial Targets & Budgets, Vault Protection, and Google Sheets
 *   Taxonomy into a single unified card with a dropdown accordion.
 *   Collapsed by default; clicking the arrow expands the dropdown and shows
 *   the 3 interactive tabs: Targets, Vault, and Taxonomy.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Target,
  ShieldCheck,
  Layers,
  ChevronDown,
  PiggyBank,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { CategoryData } from '../types';
import { formatINR } from '../utils/formatters';
import { VaultProtectionCard } from './VaultProtectionCard';
import { TaxonomyCard } from './TaxonomyCard';

export type UnifiedTabId = 'targets' | 'vault' | 'taxonomy';

interface UnifiedSettingsCardProps {
  categories: CategoryData;
  savingsInput: string;
  setSavingsInput: (val: string) => void;
  emergencyInput: string;
  setEmergencyInput: (val: string) => void;
  handleSaveTargets: (e: React.FormEvent) => Promise<void>;
  isSavingTargets: boolean;
  targetSuccess: string | null;
  targetError: string | null;
  isUnlocked?: boolean;
  onOpenUnlockModal?: () => void;
  onOpenChangePinModal?: () => void;
  onAddCategory: (type: 'Income' | 'Expense', categoryName: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const UnifiedSettingsCard: React.FC<UnifiedSettingsCardProps> = ({
  categories,
  savingsInput,
  setSavingsInput,
  emergencyInput,
  setEmergencyInput,
  handleSaveTargets,
  isSavingTargets,
  targetSuccess,
  targetError,
  isUnlocked = false,
  onOpenUnlockModal,
  onOpenChangePinModal,
  onAddCategory,
  onRefresh,
}) => {
  // Collapsed by default: "Don't display all when click on arrow then drop down then thistabs should display"
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<UnifiedTabId>('targets');

  return (
    <div
      id="unified-settings-card"
      className="bg-white dark:bg-[#161614] rounded-2xl sm:rounded-3xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-all overflow-hidden"
    >
      {/* 1. Accordion Header: Always Visible */}
      <button
        type="button"
        id="btn-toggle-unified-settings"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls="unified-settings-content"
        className="w-full p-4 sm:p-6 flex items-center justify-between gap-3 sm:gap-4 text-left hover:bg-[#FAF8F5] dark:hover:bg-[#1C1B18] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0 border border-[#E5E0D4] dark:border-[#2C2A25]">
            <Sparkles className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg lg:text-xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight truncate">
              Financial Targets, Vault Protection & Taxonomy
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] truncate">
              {isExpanded
                ? 'Click arrow to collapse tabs'
                : 'Click arrow to expand Financial Targets, Vault Security, and Category Taxonomy'}
            </p>
          </div>
        </div>

        {/* Dropdown Arrow Toggle Button */}
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-center text-[#78746B] dark:text-[#9E9B92] shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180 text-[#141412] dark:text-[#F6F5F0]' : ''
          }`}
        >
          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </button>

      {/* 2. Dropdown Content: Rendered only when expanded */}
      {isExpanded && (
        <div
          id="unified-settings-content"
          className="border-t border-[#E5E0D4] dark:border-[#282622] p-4 sm:p-6 space-y-5 animate-fadeIn"
        >
          {/* Sub-Tabs Navigation (3 Tabs) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-[#F6F5F0] dark:bg-[#201F1B] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            {/* Tab 1: Targets */}
            <button
              type="button"
              id="tab-btn-targets"
              onClick={() => setActiveTab('targets')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'targets'
                  ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-xs font-bold'
                  : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
              }`}
            >
              <Target className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span className="truncate">Financial Targets & Budgets</span>
            </button>

            {/* Tab 2: Vault */}
            <button
              type="button"
              id="tab-btn-vault"
              onClick={() => setActiveTab('vault')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-xs font-bold'
                  : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Vault Protection</span>
            </button>

            {/* Tab 3: Taxonomy */}
            <button
              type="button"
              id="tab-btn-taxonomy"
              onClick={() => setActiveTab('taxonomy')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'taxonomy'
                  ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-xs font-bold'
                  : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
              }`}
            >
              <Layers className="w-4 h-4 text-[#8E7952] dark:text-[#C5A059] shrink-0" />
              <span className="truncate">Google Sheets Taxonomy</span>
            </button>
          </div>

          {/* Tab 1 Content: Financial Targets & Budgets */}
          {activeTab === 'targets' && (
            <div className="space-y-4 pt-1 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-[#C5A059]" />
                <div>
                  <h3 className="text-sm font-bold text-[#141412] dark:text-[#F6F5F0]">
                    Financial Targets & Budgets
                  </h3>
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
                      htmlFor="unified-savings-target-input"
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
                        id="unified-savings-target-input"
                        type="number"
                        min="0"
                        step="1000"
                        value={savingsInput}
                        onChange={(e) => setSavingsInput(e.target.value)}
                        className="w-full min-h-[44px] pl-8 pr-3.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <p className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                      Current target: {formatINR(parseFloat(savingsInput) || 0)}
                    </p>
                  </div>

                  {/* Emergency Fund Target */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="unified-emergency-target-input"
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
                        id="unified-emergency-target-input"
                        type="number"
                        min="0"
                        step="1000"
                        value={emergencyInput}
                        onChange={(e) => setEmergencyInput(e.target.value)}
                        className="w-full min-h-[44px] pl-8 pr-3.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
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
                    className="min-h-[44px] px-5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
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
          )}

          {/* Tab 2 Content: Vault Protection */}
          {activeTab === 'vault' && (
            <div className="animate-fadeIn">
              <VaultProtectionCard
                isUnlocked={isUnlocked}
                onOpenUnlockModal={onOpenUnlockModal}
                onOpenChangePinModal={onOpenChangePinModal}
              />
            </div>
          )}

          {/* Tab 3 Content: Google Sheets Taxonomy */}
          {activeTab === 'taxonomy' && (
            <div className="animate-fadeIn">
              <TaxonomyCard
                categories={categories}
                onAddCategory={onAddCategory}
                onRefresh={onRefresh}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
