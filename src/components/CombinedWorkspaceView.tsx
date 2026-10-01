/**
 * ============================================================================
 * File: src/components/CombinedWorkspaceView.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Unified Workspace & Vault Hub combining:
 *     1. Goals & Projections (financial targets, capital preserved, custom cards)
 *     2. Google Sheets Taxonomy (category hierarchy & custom category additions)
 *     3. Vault Protection (4-digit PIN security, inactivity auto-lock & recovery)
 *     4. Quick Authentication (account profile, password management & sign-out)
 *     5. Centralized Google Sheets Synchronization (authoritative connection & sync)
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Target,
  Layers,
  ShieldCheck,
  UserCheck,
  Database,
  ExternalLink,
  RefreshCw,
  Download,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Transaction,
  CategoryData,
  SpreadsheetInfo,
  TransactionType,
} from '../types';
import { GoalsView } from './GoalsView';
import { TaxonomyCard } from './TaxonomyCard';
import { VaultProtectionCard } from './VaultProtectionCard';
import { QuickAuthCard } from './QuickAuthCard';
import { SheetsSyncCard } from './SheetsSyncCard';
import { TARGET_SPREADSHEET_NAME } from '../services/sheets';

export type WorkspaceTabId = 'goals' | 'taxonomy' | 'vault' | 'auth' | 'sync';

interface CombinedWorkspaceViewProps {
  transactions: Transaction[];
  categories: CategoryData;
  sheetInfo: SpreadsheetInfo | null;
  userName?: string | null;
  userEmail?: string | null;
  userPhoto?: string | null;
  overallNetBalance?: number;
  isUnlocked?: boolean;
  onUnlockSuccess?: () => void;
  onLock?: () => void;
  onOpenUnlockModal?: () => void;
  onOpenChangePinModal?: () => void;
  onOpenAddGoal?: (type: TransactionType, category?: string) => void;
  onDeleteTransaction?: (rowIndex: number) => Promise<void>;
  onDeleteTransactionsBatch?: (rowIndices: number[]) => Promise<void>;
  onAddCategory?: (type: 'Income' | 'Expense', categoryName: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  onDownloadSheet?: () => Promise<void>;
  isDownloadingSheet?: boolean;
  onSignOut?: () => Promise<void>;
  onSheetInfoChange?: (info: SpreadsheetInfo) => void;
  initialTab?: WorkspaceTabId;
}

export const CombinedWorkspaceView: React.FC<CombinedWorkspaceViewProps> = ({
  transactions,
  categories,
  sheetInfo,
  userName,
  userEmail,
  userPhoto,
  overallNetBalance = 0,
  isUnlocked = false,
  onUnlockSuccess,
  onLock,
  onOpenUnlockModal,
  onOpenChangePinModal,
  onOpenAddGoal,
  onDeleteTransaction,
  onDeleteTransactionsBatch,
  onAddCategory,
  onRefresh,
  isRefreshing = false,
  onDownloadSheet,
  isDownloadingSheet = false,
  onSignOut,
  onSheetInfoChange,
  initialTab = 'goals',
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(initialTab);

  const tabs: Array<{ id: WorkspaceTabId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'goals', label: 'Goals & Projections', icon: Target },
    { id: 'taxonomy', label: 'Sheets Taxonomy', icon: Layers },
    { id: 'vault', label: 'Vault Protection', icon: ShieldCheck },
    { id: 'auth', label: 'Quick Authentication', icon: UserCheck },
    { id: 'sync', label: 'Google Sheets Sync', icon: Database },
  ];

  const spreadsheetUrl =
    sheetInfo?.url ||
    (sheetInfo?.id
      ? `https://docs.google.com/spreadsheets/d/${sheetInfo.id}/edit`
      : 'https://docs.google.com/spreadsheets/d/1vvrKr8DceWAlt7Dn-k10mIiPQlyDRHqxZggmH-oKOQA/edit');

  return (
    <div className="w-full space-y-4">
      {/* ========================================================================= */}
      {/* 1. CENTRALIZED GOOGLE SHEETS HEADER BAR                                   */}
      {/* Single authoritative location for spreadsheet link and sync               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-3.5 sm:p-4 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-[#141412] dark:text-[#F6F5F0] truncate">
                {sheetInfo?.name || TARGET_SPREADSHEET_NAME}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Synced ({transactions.length} rows)</span>
              </span>
            </div>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] truncate">
              Centralized Google Sheets connection • Real-time two-way synchronization
            </p>
          </div>
        </div>

        {/* Centralized Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-workspace-open-sheet"
            className="min-h-[38px] px-3.5 py-1.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Open Google Sheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {onRefresh && (
            <button
              type="button"
              id="btn-workspace-sync-now"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Synchronize now with Google Sheet"
              className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-[#1A1A17] hover:bg-[#EFECE4] dark:hover:bg-[#24231F] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C5A059]' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
            </button>
          )}

          {/* Quick Lock / Unlock Status Toggle */}
          {isUnlocked ? (
            <button
              type="button"
              onClick={onLock}
              title="Lock protected balances"
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Unlocked</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenUnlockModal}
              title="Unlock protected balances with 4-digit PIN"
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Locked</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RESPONSIVE SEGMENTED NAVIGATION CONTROL                                */}
      {/* Combines: Goals & Projections, Taxonomy, Vault, Auth, Sheets Sync        */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-1.5 sm:p-2 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-0.5 px-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-combined-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] font-semibold shadow-2xs'
                    : 'text-[#6E6A61] dark:text-[#A39F95] hover:text-[#141412] dark:hover:text-[#F6F5F0] hover:bg-[#F6F5F0] dark:hover:bg-[#22211D]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COMBINED TAB CONTENT PANELS                                            */}
      {/* ========================================================================= */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          {/* TAB 1: GOALS & PROJECTIONS */}
          {activeTab === 'goals' && (
            <motion.div
              key="workspace-goals"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <GoalsView
                transactions={transactions}
                userName={userName || userEmail}
                overallNetBalance={overallNetBalance}
                onOpenAddGoal={onOpenAddGoal}
                onDeleteTransaction={onDeleteTransaction}
                onDeleteTransactionsBatch={onDeleteTransactionsBatch}
                isUnlocked={isUnlocked}
                onUnlockSuccess={onUnlockSuccess}
                onLock={onLock}
              />
            </motion.div>
          )}

          {/* TAB 2: GOOGLE SHEETS TAXONOMY */}
          {activeTab === 'taxonomy' && (
            <motion.div
              key="workspace-taxonomy"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <TaxonomyCard
                categories={categories}
                onAddCategory={onAddCategory}
                onRefresh={onRefresh}
              />
            </motion.div>
          )}

          {/* TAB 3: VAULT PROTECTION */}
          {activeTab === 'vault' && (
            <motion.div
              key="workspace-vault"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <VaultProtectionCard
                isUnlocked={isUnlocked}
                onOpenUnlockModal={onOpenUnlockModal}
                onOpenChangePinModal={onOpenChangePinModal}
                onLock={onLock}
              />
            </motion.div>
          )}

          {/* TAB 4: QUICK AUTHENTICATION */}
          {activeTab === 'auth' && (
            <motion.div
              key="workspace-auth"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <QuickAuthCard
                userEmail={userEmail}
                userName={userName}
                userPhoto={userPhoto}
                onSignOut={onSignOut}
              />
            </motion.div>
          )}

          {/* TAB 5: CENTRALIZED GOOGLE SHEETS SYNCHRONIZATION */}
          {activeTab === 'sync' && (
            <motion.div
              key="workspace-sync"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <SheetsSyncCard
                sheetInfo={sheetInfo}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                onDownloadSheet={onDownloadSheet}
                isDownloadingSheet={isDownloadingSheet}
                onSheetInfoChange={onSheetInfoChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
