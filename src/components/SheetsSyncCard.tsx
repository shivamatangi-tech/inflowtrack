/**
 * ============================================================================
 * File: src/components/SheetsSyncCard.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Single centralized access point for Google Sheets bidirectional
 *   synchronization, live status monitoring, spreadsheet opening, and export.
 *   Strictly omits redundant Google Drive folder paths and technical IDs.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Database,
  RefreshCw,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Check,
  Loader2,
} from 'lucide-react';
import { SpreadsheetInfo } from '../types';
import { updateSyncConfig, TARGET_SPREADSHEET_NAME } from '../services/sheets';
import { getFreshAuthToken } from '../services/firebase';

interface SheetsSyncCardProps {
  sheetInfo: SpreadsheetInfo | null;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  onDownloadSheet?: () => Promise<void>;
  isDownloadingSheet?: boolean;
  onSheetInfoChange?: (info: SpreadsheetInfo) => void;
}

export const SheetsSyncCard: React.FC<SheetsSyncCardProps> = ({
  sheetInfo,
  onRefresh,
  isRefreshing = false,
  onDownloadSheet,
  isDownloadingSheet = false,
  onSheetInfoChange,
}) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState(sheetInfo?.id || '');
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setStatusError(null);

    try {
      const token = await getFreshAuthToken();
      const res = await updateSyncConfig(token, {
        spreadsheetId: sheetIdInput.trim() || undefined,
        appsScriptUrl: appsScriptUrlInput.trim() || undefined,
      });

      if (onSheetInfoChange && res.sheetInfo) {
        onSheetInfoChange(res.sheetInfo);
      }
      setStatusMessage('Google Sheets synchronization settings updated and reconciled.');
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to update Google Sheets connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const spreadsheetUrl =
    sheetInfo?.url ||
    (sheetInfo?.id
      ? `https://docs.google.com/spreadsheets/d/${sheetInfo.id}/edit`
      : 'https://docs.google.com/spreadsheets/d/1vvrKr8DceWAlt7Dn-k10mIiPQlyDRHqxZggmH-oKOQA/edit');

  const connectionLabel = (() => {
    if (sheetInfo?.connectionMode === 'google_sheets_api') return 'Google Sheets API';
    if (sheetInfo?.connectionMode === 'apps_script') return 'Apps Script Bridge';
    return 'Google Sheets Workbook';
  })();

  return (
    <div className="bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Google Sheets Synchronization
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Real-time two-way synchronization between inflotrack and your spreadsheet
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{connectionLabel} Active</span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {statusError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Main Connection Overview Card */}
      <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
            Connected Spreadsheet
          </div>
          <div className="text-base font-bold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-2">
            <span>{sheetInfo?.name || TARGET_SPREADSHEET_NAME}</span>
            <span className="text-xs font-normal text-[#78746B] dark:text-[#9E9B92]">
              ({sheetInfo?.transactionsCount ?? 0} transactions synced)
            </span>
          </div>
          <div className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
            Changes made on the website update your sheet. Remote spreadsheet edits are synced back on focus or refresh.
          </div>
        </div>

        {/* Centralized Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* 1. Centralized "Open Google Sheet" Link */}
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-central-open-sheet"
            className="min-h-[42px] px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Open Google Sheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* 2. Sync Now */}
          {onRefresh && (
            <button
              type="button"
              id="btn-central-sync-now"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-h-[42px] px-3.5 py-2 bg-white dark:bg-[#161614] hover:bg-[#EFECE4] dark:hover:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C5A059]' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}

          {/* 3. Download Spreadsheet */}
          {onDownloadSheet && (
            <button
              type="button"
              id="btn-central-download-sheet"
              onClick={onDownloadSheet}
              disabled={isDownloadingSheet}
              className="min-h-[42px] px-3.5 py-2 bg-white dark:bg-[#161614] hover:bg-[#EFECE4] dark:hover:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-2xs"
            >
              {isDownloadingSheet ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloadingSheet ? 'Exporting...' : 'Export'}</span>
            </button>
          )}

          {/* Toggle Advanced Connection Settings */}
          <button
            type="button"
            onClick={() => setIsConfigOpen((prev) => !prev)}
            title="Configure Spreadsheet ID or Apps Script Bridge"
            className="min-h-[42px] w-10 h-10 rounded-xl bg-white dark:bg-[#161614] hover:bg-[#EFECE4] dark:hover:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-center text-[#78746B] dark:text-[#9E9B92] transition-colors cursor-pointer shadow-2xs"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Connection Settings (Sheet ID & Apps Script Bridge) */}
      {isConfigOpen && (
        <form
          onSubmit={handleSaveConfig}
          className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
              Custom Google Sheet Connection
            </span>
            <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
              Optional: Connect a specific Spreadsheet ID or Google Apps Script Web App
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="input-custom-sheet-id"
                className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
              >
                Google Sheet ID or URL
              </label>
              <input
                type="text"
                id="input-custom-sheet-id"
                value={sheetIdInput}
                onChange={(e) => setSheetIdInput(e.target.value)}
                placeholder="1vvrKr8DceWAlt7Dn-k10mIiPQlyDRHqxZggmH-oKOQA"
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-mono text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label
                htmlFor="input-custom-apps-script"
                className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
              >
                Google Apps Script Web App URL (Optional)
              </label>
              <input
                type="url"
                id="input-custom-apps-script"
                value={appsScriptUrlInput}
                onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-mono text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[40px] px-4 py-1.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving...' : 'Save & Reconnect'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
