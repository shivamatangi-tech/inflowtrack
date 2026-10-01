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
  FolderOpen,
  Calendar,
  Layers,
} from 'lucide-react';
import { SpreadsheetInfo } from '../types';
import { updateSyncConfig, TARGET_SPREADSHEET_NAME, TARGET_DRIVE_FOLDER_URL } from '../services/sheets';
import { getFreshAuthToken, getGoogleAccessToken, connectGoogleAccount } from '../services/firebase';

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
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const hasGoogleToken = Boolean(getGoogleAccessToken());

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setStatusMessage(null);
    setStatusError(null);
    try {
      await connectGoogleAccount();
      setStatusMessage('Google Account connected successfully! Two-way Google Sheets sync is now active.');
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to connect Google Account.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

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
    if (hasGoogleToken || sheetInfo?.connectionMode === 'google_sheets_api') return 'Google Sheets API';
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
              Google Sheets Database & Two-Way Sync
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Real-time two-way synchronization between inflotrack and your Google Sheet
            </p>
          </div>
        </div>

        {/* Live Status Pill & Google Connection Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{connectionLabel} Active</span>
          </div>

          {!hasGoogleToken && (
            <button
              type="button"
              id="btn-connect-google-account"
              onClick={handleConnectGoogle}
              disabled={isConnectingGoogle}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#22211E] border border-[#D5D0C5] dark:border-[#383630] text-xs font-semibold text-[#181816] dark:text-[#F4F3EF] hover:bg-[#F8F7F4] dark:hover:bg-[#2A2925] transition-all cursor-pointer disabled:opacity-60"
            >
              {isConnectingGoogle ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C5A059]" />
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>Connect Google</span>
            </button>
          )}
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
            Connected Spreadsheet & Database
          </div>
          <div className="text-base font-bold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-2 flex-wrap">
            <span>{sheetInfo?.name || TARGET_SPREADSHEET_NAME}</span>
            <span className="text-xs font-normal text-[#78746B] dark:text-[#9E9B92]">
              ({sheetInfo?.transactionsCount ?? 0} transactions synced)
            </span>
          </div>
          <div className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
            Website changes update Google Sheets automatically. Spreadsheet edits are synced back on focus or refresh without duplicating records.
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

          {/* 2. Open Google Drive Folder */}
          <a
            href={TARGET_DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-central-open-folder"
            className="min-h-[42px] px-3.5 py-2 bg-white dark:bg-[#161614] hover:bg-[#EFECE4] dark:hover:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Drive Folder</span>
          </a>

          {/* 3. Sync Now */}
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

          {/* 4. Download Spreadsheet */}
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

      {/* Monthly Expense Tabs & Two-Way Sync Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3 bg-[#F9F8F5] dark:bg-[#1E1D19] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <span className="font-semibold text-[#141412] dark:text-[#F6F5F0] block">
              Automatic Monthly Tabs (e.g. "Sep-2026", "Oct-2026")
            </span>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] leading-relaxed">
              When an expense is recorded, inflotrack determines the month from its date and uses or auto-creates that month's tab with standard headers. Future months are supported automatically.
            </p>
          </div>
        </div>

        <div className="p-3 bg-[#F9F8F5] dark:bg-[#1E1D19] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] flex items-start gap-2.5">
          <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <span className="font-semibold text-[#141412] dark:text-[#F6F5F0] block">
              Unique Record IDs & Duplicate Prevention
            </span>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] leading-relaxed">
              Every transaction carries an immutable Transaction ID matched bidirectionally with Google Sheets. Updates, creations, and deletions synchronize without duplicating records.
            </p>
          </div>
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
