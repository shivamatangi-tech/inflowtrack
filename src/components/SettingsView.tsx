/**
 * ============================================================================
 * File: src/components/SettingsView.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Comprehensive Settings & Preferences view for managing appearance,
 *   financial targets, custom Google Sheets categories, account security,
 *   and private Google Drive backups in the `inflowtrack` folder.
 *
 * Key Responsibilities:
 *   1. Appearance & Theme switcher (Light / Dark / System Default).
 *   2. PIN-protected Financial Targets configuration (Savings Target &
 *      Emergency Fund Target synced to Google Sheets).
 *   3. Custom Category creator (adds Income, Expense, or Transfer categories
 *      directly to the user's Google Sheet).
 *   4. Security & Session controls: Optional 4-digit PIN setup/change/disable,
 *      inactivity auto-lock/logout timer, hashed recovery question, and
 *      Firebase Account Password change.
 *   5. Private Google Drive Backup manager: Creates and downloads JSON
 *      database backups stored privately in Google Drive.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Plus,
  CheckCircle2,
  IndianRupee,
  Database,
  Layers,
  Loader2,
  Sun,
  Moon,
  Lock,
  KeyRound,
  Shield,
  Target,
  PiggyBank,
  ShieldCheck,
  Check,
  TrendingUp,
  Download,
  CloudUpload,
  Clock,
  FileText,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { CategoryData, SpreadsheetInfo, ThemeMode, DriveBackupItem } from '../types';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  hasSecurityPinSet,
  hasPinLoginConfigured,
  getSecurityQuestions,
  saveSecurityRecoverySettings,
  updateSecurityPinWithServer,
  setupPinLoginWithServer,
} from '../utils/security';
import {
  getSavingsTarget,
  setSavingsTarget,
  getEmergencyFundTarget,
  setEmergencyFundTarget,
} from '../utils/targets';
import { formatINR } from '../utils/formatters';
import {
  TARGET_SPREADSHEET_NAME,
  TARGET_DRIVE_FOLDER_NAME,
  TARGET_DRIVE_FOLDER_ID,
  TARGET_DRIVE_FOLDER_URL,
  extractFolderIdFromUrlOrId,
  updateDriveFolderLocation,
  createNewInflowtrackSheetInDrive,
  downloadSheetFromDrive,
  updateBudgetsInSheet,
  listDriveBackups,
  createDriveBackup,
  downloadDriveBackupFile,
} from '../services/sheets';
import {
  changeUserPassword,
  getFreshAuthToken,
} from '../services/firebase';

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
  onAddCategory: (type: 'Income' | 'Expense' | 'Transfer', categoryName: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  isRefreshing?: boolean;
  isUnlocked?: boolean;
  onOpenUnlockModal?: () => void;
  onOpenChangePinModal?: () => void;
  onPinStatusChanged?: () => void;
  onSheetInfoChange?: (sheetInfo: SpreadsheetInfo) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  sheetInfo,
  categories: _categories,
  userEmail,
  userName,
  userPhoto,
  userUid,
  currentTheme,
  onThemeChange,
  onRefresh,
  onDownloadSheet,
  isDownloadingSheet: externalDownloading = false,
  onAddCategory,
  onSignOut,
  isRefreshing: _isRefreshing = false,
  isUnlocked = false,
  onOpenUnlockModal,
  onOpenChangePinModal,
  onPinStatusChanged,
  onSheetInfoChange,
}) => {
  // Category creation state
  const [newCatType, setNewCatType] = useState<'Income' | 'Expense' | 'Transfer'>('Expense');
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [catSuccess, setCatSuccess] = useState<string | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  // Targets state & target values
  const [savingsInput, setSavingsInput] = useState<string>(() => getSavingsTarget().toString());
  const [emergencyInput, setEmergencyInput] = useState<string>(() => getEmergencyFundTarget().toString());
  const [targetSuccess, setTargetSuccess] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  // Account Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Security PIN & Inactivity Configuration state
  const secQuestions = getSecurityQuestions();
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(
    secQuestions.inactivityTimeoutMinutes ?? 15
  );
  const [inactivityAction, setInactivityAction] = useState<'lock' | 'logout'>(
    secQuestions.inactivityAction || 'lock'
  );
  const [recoveryQuestion, setRecoveryQuestion] = useState<string>(secQuestions.question1 || '');
  const [recoveryAnswer, setRecoveryAnswer] = useState<string>('');
  const [disablePinInput, setDisablePinInput] = useState<string>('');
  const [showDisablePinPrompt, setShowDisablePinPrompt] = useState<boolean>(false);
  const [secConfigMsg, setSecConfigMsg] = useState<string | null>(null);
  const [secConfigErr, setSecConfigErr] = useState<string | null>(null);
  const [isSavingSecConfig, setIsSavingSecConfig] = useState<boolean>(false);

  // Easy PIN Login in Firebase
  const [pinLoginConfigured, setPinLoginConfigured] = useState<boolean>(() => hasPinLoginConfigured());
  const [showPinLoginForm, setShowPinLoginForm] = useState<boolean>(false);
  const [easyLoginPin, setEasyLoginPin] = useState<string>('');
  const [easyLoginPinConfirm, setEasyLoginPinConfirm] = useState<string>('');
  const [easyLoginPassword, setEasyLoginPassword] = useState<string>('');
  const [isSavingPinLogin, setIsSavingPinLogin] = useState<boolean>(false);
  const [pinLoginMsg, setPinLoginMsg] = useState<string | null>(null);
  const [pinLoginErr, setPinLoginErr] = useState<string | null>(null);

  // Private Google Drive Backups, Drive Location & Sheet Creation state
  const [backups, setBackups] = useState<DriveBackupItem[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [receiptTitle, setReceiptTitle] = useState<string>('');
  const [receiptNote, setReceiptNote] = useState<string>('');
  const [showReceiptForm, setShowReceiptForm] = useState<boolean>(false);
  const [driveMessage, setDriveMessage] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [driveFolderUrlInput, setDriveFolderUrlInput] = useState<string>(
    sheetInfo?.driveFolderUrl || TARGET_DRIVE_FOLDER_URL
  );
  const [spreadsheetNameInput, setSpreadsheetNameInput] = useState<string>(
    sheetInfo?.name || TARGET_SPREADSHEET_NAME
  );
  const [isUpdatingDriveLocation, setIsUpdatingDriveLocation] = useState<boolean>(false);
  const [isCreatingNewSheet, setIsCreatingNewSheet] = useState<boolean>(false);
  const [isLocalDownloadingSheet, setIsLocalDownloadingSheet] = useState<boolean>(false);
  const [confirmActionType, setConfirmActionType] = useState<'create_sheet' | 'update_location' | null>(null);

  const pinConfigured = hasSecurityPinSet();

  useEffect(() => {
    if (sheetInfo?.driveFolderUrl) {
      setDriveFolderUrlInput(sheetInfo.driveFolderUrl);
    }
    if (sheetInfo?.name) {
      setSpreadsheetNameInput(sheetInfo.name);
    }
  }, [sheetInfo?.driveFolderUrl, sheetInfo?.name]);

  useEffect(() => {
    void (async () => {
      const list = await listDriveBackups();
      setBackups(list);
    })();
  }, []);

  const handleConfirmDriveMutation = async () => {
    const action = confirmActionType;
    setConfirmActionType(null);
    if (!action) return;

    setDriveError(null);
    setDriveMessage(null);

    if (action === 'create_sheet') {
      setIsCreatingNewSheet(true);
      try {
        const res = await createNewInflowtrackSheetInDrive(null, {
          driveFolderUrl: driveFolderUrlInput.trim() || TARGET_DRIVE_FOLDER_URL,
          spreadsheetName: spreadsheetNameInput.trim() || TARGET_SPREADSHEET_NAME,
        });
        if (onSheetInfoChange && res.sheetInfo) {
          onSheetInfoChange(res.sheetInfo);
        }
        await onRefresh();
        setDriveMessage(res.message);
        setTimeout(() => setDriveMessage(null), 6000);
      } catch (err: any) {
        setDriveError(err.message || 'Failed to create new inflowtrack sheet in Google Drive.');
      } finally {
        setIsCreatingNewSheet(false);
      }
      return;
    }

    if (action === 'update_location') {
      setIsUpdatingDriveLocation(true);
      try {
        const res = await updateDriveFolderLocation(null, {
          driveFolderUrl: driveFolderUrlInput.trim() || TARGET_DRIVE_FOLDER_URL,
          spreadsheetName: spreadsheetNameInput.trim() || TARGET_SPREADSHEET_NAME,
          createNewSheet: false,
        });
        if (onSheetInfoChange && res.sheetInfo) {
          onSheetInfoChange(res.sheetInfo);
        }
        await onRefresh();
        setDriveMessage(res.message);
        setTimeout(() => setDriveMessage(null), 6000);
      } catch (err: any) {
        setDriveError(err.message || 'Failed to update Google Drive folder location.');
      } finally {
        setIsUpdatingDriveLocation(false);
      }
    }
  };

  const handleTriggerDownloadSheet = async () => {
    setDriveError(null);
    setDriveMessage(null);
    if (onDownloadSheet) {
      await onDownloadSheet();
      return;
    }
    setIsLocalDownloadingSheet(true);
    try {
      const result = await downloadSheetFromDrive(null, {
        driveFolderUrl: driveFolderUrlInput.trim() || TARGET_DRIVE_FOLDER_URL,
        spreadsheetName: spreadsheetNameInput.trim() || TARGET_SPREADSHEET_NAME,
      });
      setDriveMessage(
        `Stored latest sheet in Drive folder (${extractFolderIdFromUrlOrId(
          driveFolderUrlInput
        )}) and downloaded "${result.fileName}".`
      );
      setTimeout(() => setDriveMessage(null), 5000);
    } catch (err: any) {
      setDriveError(err.message || 'Failed to store and download sheet.');
    } finally {
      setIsLocalDownloadingSheet(false);
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsAddingCat(true);
    setCatSuccess(null);
    setCatError(null);

    try {
      await onAddCategory(newCatType, newCatName.trim());
      setCatSuccess(
        `Successfully created "${newCatName.trim()}" in ${newCatType} Categories directly in your Google Sheet.`
      );
      setNewCatName('');
      setTimeout(() => setCatSuccess(null), 5000);
    } catch (err: any) {
      setCatError(err.message || 'Failed to add category to Google Sheets.');
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleSaveTargetsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSavings = parseFloat(savingsInput);
    const parsedEmergency = parseFloat(emergencyInput);

    if (isNaN(parsedSavings) || parsedSavings <= 0) {
      setTargetError('Savings target must be a valid positive amount.');
      return;
    }
    if (isNaN(parsedEmergency) || parsedEmergency <= 0) {
      setTargetError('Emergency fund target must be a valid positive amount.');
      return;
    }

    setSavingsTarget(parsedSavings);
    setEmergencyFundTarget(parsedEmergency);
    setTargetError(null);

    try {
      const token = await getFreshAuthToken();
      if (token) {
        await updateBudgetsInSheet(token, {
          savingsTarget: parsedSavings,
          emergencyFundTarget: parsedEmergency,
        });
      }
      setTargetSuccess('Financial targets saved to Google Sheets! Goals and progress percentages updated.');
      setTimeout(() => setTargetSuccess(null), 4000);
    } catch (err: any) {
      setTargetError(err.message || 'Saved locally, but could not sync targets to Google Sheets.');
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setPasswordSuccess('Your account password has been updated securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Please verify your current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveSecurityPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecConfigErr(null);
    setSecConfigMsg(null);
    setIsSavingSecConfig(true);

    try {
      const token = await getFreshAuthToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const res = await saveSecurityRecoverySettings(token, {
        question1: recoveryQuestion.trim() || undefined,
        answer1: recoveryAnswer.trim() || undefined,
        inactivityTimeoutMinutes: inactivityMinutes,
        inactivityAction,
      });

      if (!res.success) {
        throw new Error(res.error || 'Unable to save security settings.');
      }

      setRecoveryAnswer('');
      setSecConfigMsg(
        'Security & session protection settings saved (recovery answer stored as a salted PBKDF2 hash).'
      );
      if (onPinStatusChanged) onPinStatusChanged();
      setTimeout(() => setSecConfigMsg(null), 4500);
    } catch (err: any) {
      setSecConfigErr(err.message || 'Failed to update security settings.');
    } finally {
      setIsSavingSecConfig(false);
    }
  };

  const handleDisablePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecConfigErr(null);
    setSecConfigMsg(null);

    try {
      const token = await getFreshAuthToken();
      if (!token) throw new Error('Your session has expired.');
      const res = await updateSecurityPinWithServer(token, {
        currentPin: disablePinInput.trim(),
        disablePin: true,
      });
      if (!res.success) {
        setSecConfigErr(res.error || 'Current PIN is required to disable PIN lock.');
        return;
      }
      setDisablePinInput('');
      setShowDisablePinPrompt(false);
      setSecConfigMsg('Optional Quick-Unlock PIN has been disabled.');
      if (onPinStatusChanged) onPinStatusChanged();
    } catch (err: any) {
      setSecConfigErr(err.message || 'Failed to disable PIN.');
    }
  };

  const handleSavePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoginErr(null);
    setPinLoginMsg(null);

    const cleanPin = easyLoginPin.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) {
      setPinLoginErr('PIN must be 4 to 8 digits.');
      return;
    }
    if (cleanPin !== easyLoginPinConfirm.trim()) {
      setPinLoginErr('PIN confirmation does not match.');
      return;
    }
    if (!easyLoginPassword.trim()) {
      setPinLoginErr('Your Firebase account password is required to securely authorize PIN login.');
      return;
    }

    setIsSavingPinLogin(true);
    try {
      const freshToken = await getFreshAuthToken();
      if (!freshToken) throw new Error('Your session has expired. Please sign in again.');

      const res = await setupPinLoginWithServer(freshToken, {
        pin: cleanPin,
        accountPassword: easyLoginPassword.trim(),
        enable: true,
      });

      if (!res.success) {
        setPinLoginErr(res.error || 'Failed to configure Easy PIN Login.');
        return;
      }

      setPinLoginConfigured(true);
      setShowPinLoginForm(false);
      setEasyLoginPin('');
      setEasyLoginPinConfirm('');
      setEasyLoginPassword('');
      setPinLoginMsg(res.message || 'Easy PIN Login has been configured and stored in Firebase!');
      if (onPinStatusChanged) onPinStatusChanged();
    } catch (err: any) {
      setPinLoginErr(err.message || 'Failed to setup Easy PIN Login.');
    } finally {
      setIsSavingPinLogin(false);
    }
  };

  const handleDisablePinLogin = async () => {
    setPinLoginErr(null);
    setPinLoginMsg(null);
    setIsSavingPinLogin(true);
    try {
      const freshToken = await getFreshAuthToken();
      if (!freshToken) throw new Error('Your session has expired.');

      const res = await setupPinLoginWithServer(freshToken, { enable: false });
      if (!res.success) {
        setPinLoginErr(res.error || 'Failed to disable PIN login.');
        return;
      }
      setPinLoginConfigured(false);
      setShowPinLoginForm(false);
      setPinLoginMsg('Easy PIN Login has been disabled.');
      if (onPinStatusChanged) onPinStatusChanged();
    } catch (err: any) {
      setPinLoginErr(err.message || 'Failed to disable Easy PIN Login.');
    } finally {
      setIsSavingPinLogin(false);
    }
  };

  const handleCreateDriveBackup = async () => {
    setIsCreatingBackup(true);
    setDriveError(null);
    setDriveMessage(null);
    try {
      const created = await createDriveBackup(null, { kind: 'backup' });
      setBackups((prev) => [created, ...prev]);
      setDriveMessage(`Private backup "${created.name}" saved to Google Drive storage.`);
      setTimeout(() => setDriveMessage(null), 5000);
    } catch (err: any) {
      setDriveError(err.message || 'Google Drive backup failed. Please try again.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleSaveReceiptToDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptTitle.trim()) return;
    setIsCreatingBackup(true);
    setDriveError(null);
    setDriveMessage(null);
    try {
      const created = await createDriveBackup(null, {
        kind: 'receipt',
        receiptName: receiptTitle.trim(),
        customNote: receiptNote.trim(),
      });
      setBackups((prev) => [created, ...prev]);
      setReceiptTitle('');
      setReceiptNote('');
      setShowReceiptForm(false);
      setDriveMessage(`Private receipt "${created.name}" archived to Google Drive.`);
      setTimeout(() => setDriveMessage(null), 5000);
    } catch (err: any) {
      setDriveError(err.message || 'Failed to archive receipt to Google Drive.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const parsedSavingsNum = parseFloat(savingsInput) || 0;
  const parsedEmergencyNum = parseFloat(emergencyInput) || 0;
  const combinedTargetNum = parsedSavingsNum + parsedEmergencyNum;

  const savingsPresets = [50000, 100000, 200000, 500000, 1000000];
  const emergencyPresets = [25000, 50000, 100000, 200000, 300000];

  return (
    <div id="settings-view" className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* 1. Appearance / Theme Option */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              Visual Preferences
            </p>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight flex items-center gap-2 mt-0.5">
              {currentTheme === 'dark' ? (
                <Moon className="w-4 h-4 text-[#C5A059]" />
              ) : (
                <Sun className="w-4 h-4 text-[#C5A059]" />
              )}
              Appearance &amp; Theme
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-0.5">
              Toggle between Dark mode and Light mode interface
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
              {currentTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
            <button
              type="button"
              id="theme-toggle-switch"
              role="switch"
              aria-checked={currentTheme === 'dark'}
              onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                currentTheme === 'dark' ? 'bg-[#C5A059]' : 'bg-[#D5D0C5] dark:bg-[#3A3832]'
              }`}
            >
              <span className="sr-only">Toggle Dark Mode</span>
              <span
                className={`pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white dark:bg-[#111110] shadow-sm ring-0 transition duration-200 ease-in-out ${
                  currentTheme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              >
                {currentTheme === 'dark' ? (
                  <Moon className="w-3 h-3 text-[#C5A059] shrink-0" />
                ) : (
                  <Sun className="w-3 h-3 text-[#8E7952] shrink-0" />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Financial Targets Configuration (Synced to Google Sheets) */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              Goals &amp; Projections
            </p>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight flex items-center gap-2 mt-0.5">
              <Target className="w-4 h-4 text-[#C5A059]" />
              Financial Targets &amp; Budgets Configuration
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-0.5">
              Set target goals for Savings &amp; Emergency Fund stored directly in your Google Sheet
            </p>
          </div>
        </div>

        {targetSuccess && (
          <div className="mb-4 p-3 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#C5A059]/40 rounded-xl text-xs text-[#8E7952] dark:text-[#C5A059] flex items-center gap-2 font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#C5A059]" />
            <span>{targetSuccess}</span>
          </div>
        )}

        {targetError && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium animate-fadeIn">
            {targetError}
          </div>
        )}

        {pinConfigured && !isUnlocked ? (
          <div className="p-6 sm:p-8 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-2xl flex flex-col items-center justify-center text-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#282622] text-[#C5A059] flex items-center justify-center shadow-xs">
              <Lock className="w-6 h-6 text-[#C5A059]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0]">
                Financial Targets are Protected by PIN Lock
              </div>
              <div className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-1 max-w-md">
                Unlock with your 4-digit security PIN to configure Savings &amp; Emergency Fund targets.
              </div>
            </div>

            <button
              type="button"
              id="btn-settings-unlock-targets"
              onClick={onOpenUnlockModal}
              className="mt-1 px-5 py-2.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Unlock to Edit Targets</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveTargetsSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Savings Target */}
              <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="settings-savings-target-input"
                      className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5"
                    >
                      <PiggyBank className="w-4 h-4 text-[#C5A059]" />
                      <span>Savings &amp; Investment Target</span>
                    </label>
                    <span className="text-xs font-bold text-[#8E7952] dark:text-[#C5A059] font-mono">
                      {formatINR(parsedSavingsNum)}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#78746B] dark:text-[#9E9B92]">
                      ₹
                    </span>
                    <input
                      type="number"
                      id="settings-savings-target-input"
                      value={savingsInput}
                      onChange={(e) => {
                        setSavingsInput(e.target.value);
                        setTargetError(null);
                      }}
                      min="1000"
                      step="1000"
                      placeholder="100000"
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                      required
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {savingsPresets.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setSavingsInput(amt.toString())}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                          parsedSavingsNum === amt
                            ? 'bg-[#141412] text-[#F6F5F0] dark:bg-[#C5A059] dark:text-[#111110] border-transparent shadow-xs'
                            : 'bg-white dark:bg-[#161614] text-[#78746B] dark:text-[#9E9B92] border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/60'
                        }`}
                      >
                        {formatINR(amt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Emergency Fund Target */}
              <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="settings-emergency-target-input"
                      className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                      <span>Emergency Fund Target</span>
                    </label>
                    <span className="text-xs font-bold text-[#8E7952] dark:text-[#C5A059] font-mono">
                      {formatINR(parsedEmergencyNum)}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#78746B] dark:text-[#9E9B92]">
                      ₹
                    </span>
                    <input
                      type="number"
                      id="settings-emergency-target-input"
                      value={emergencyInput}
                      onChange={(e) => {
                        setEmergencyInput(e.target.value);
                        setTargetError(null);
                      }}
                      min="1000"
                      step="1000"
                      placeholder="50000"
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                      required
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {emergencyPresets.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setEmergencyInput(amt.toString())}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                          parsedEmergencyNum === amt
                            ? 'bg-[#141412] text-[#F6F5F0] dark:bg-[#C5A059] dark:text-[#111110] border-transparent shadow-xs'
                            : 'bg-white dark:bg-[#161614] text-[#78746B] dark:text-[#9E9B92] border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/60'
                        }`}
                      >
                        {formatINR(amt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#282622] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#282622] text-[#C5A059] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Combined Capital Preserved Target
                  </div>
                  <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
                    Savings Target + Emergency Fund Target
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-base font-bold text-[#8E7952] dark:text-[#C5A059] font-mono">
                  {formatINR(combinedTargetNum)}
                </div>
                <button
                  type="submit"
                  id="btn-save-settings-targets"
                  className="px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Targets</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 3. Create New Category in Google Sheet */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              Google Sheets Taxonomy
            </p>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight flex items-center gap-2 mt-0.5">
              <Layers className="w-4 h-4 text-[#C5A059]" />
              Create New Category in Google Sheet
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-0.5">
              Add custom categories directly into your Google Spreadsheet for Expenses, Income, or Transfers
            </p>
          </div>
        </div>

        {catSuccess && (
          <div className="mb-4 p-3.5 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#C5A059]/40 rounded-xl flex items-center gap-2 text-[#8E7952] dark:text-[#C5A059] text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0" />
            <div>{catSuccess}</div>
          </div>
        )}

        {catError && (
          <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-medium">
            {catError}
          </div>
        )}

        <form
          onSubmit={handleAddCategorySubmit}
          className="p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] space-y-3.5"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="md:col-span-4">
              <label
                htmlFor="select-category-type"
                className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1.5"
              >
                Category Type
              </label>
              <select
                id="select-category-type"
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as 'Income' | 'Expense' | 'Transfer')}
                className="w-full px-3 py-2.5 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
              >
                <option value="Expense">Expenses Category</option>
                <option value="Income">Income Category</option>
                <option value="Transfer">Transfer Category</option>
              </select>
            </div>

            <div className="md:col-span-5">
              <label
                htmlFor="input-new-category-name"
                className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1.5"
              >
                New Category Name
              </label>
              <input
                type="text"
                id="input-new-category-name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Health Insurance, Subscriptions..."
                className="w-full px-3 py-2.5 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-medium text-[#141412] dark:text-[#F6F5F0] placeholder-[#78746B]/60 focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                id="btn-submit-add-category"
                disabled={isAddingCat || !newCatName.trim()}
                className="w-full px-4 py-2.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isAddingCat ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>Create Category</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
            New categories are linked to your verified Firebase UID in Google Sheets and immediately selectable.
          </p>
        </form>
      </div>

      {/* 4. Easy PIN Login (Firebase) Section */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
                Quick Authentication
              </p>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="font-display text-base sm:text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#C5A059]" />
                Easy PIN Login (Firebase)
              </h2>
              {pinLoginConfigured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Active on Login Screen
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F5F0] dark:bg-[#22211D] text-[#78746B] dark:text-[#9E9B92] border border-[#E5E0D4] dark:border-[#2C2A25]">
                  Not Configured
                </span>
              )}
            </div>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-1">
              Sign in with a simple 4 to 8 digit PIN from the login screen instead of typing your full password. Your credentials are authenticated with Firebase.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-toggle-pin-login-form"
              onClick={() => {
                setShowPinLoginForm(!showPinLoginForm);
                setPinLoginErr(null);
                setPinLoginMsg(null);
              }}
              className="px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{pinLoginConfigured ? 'Update Login PIN' : 'Set Up Easy PIN Login'}</span>
            </button>

            {pinLoginConfigured && (
              <button
                type="button"
                id="btn-disable-pin-login"
                disabled={isSavingPinLogin}
                onClick={handleDisablePinLogin}
                className="px-3 py-2 bg-[#F6F5F0] hover:bg-rose-50 dark:bg-[#22211D] dark:hover:bg-rose-950/40 border border-[#E5E0D4] dark:border-[#2C2A25] text-[#78746B] dark:text-[#9E9B92] hover:text-rose-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Disable PIN Login
              </button>
            )}
          </div>
        </div>

        {pinLoginMsg && (
          <div className="p-3 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#C5A059]/40 rounded-xl text-xs text-[#8E7952] dark:text-[#C5A059] font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#C5A059]" />
            <span>{pinLoginMsg}</span>
          </div>
        )}

        {pinLoginErr && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {pinLoginErr}
          </div>
        )}

        {showPinLoginForm && (
          <form
            onSubmit={handleSavePinLogin}
            className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl space-y-3.5"
          >
            <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
              {pinLoginConfigured
                ? 'Update your Easy Login PIN'
                : 'Configure Easy PIN Login for this account'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                  New Easy PIN (4-8 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={easyLoginPin}
                  onChange={(e) => setEasyLoginPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                  Confirm Easy PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={easyLoginPinConfirm}
                  onChange={(e) => setEasyLoginPinConfirm(e.target.value.replace(/\D/g, ''))}
                  placeholder="Re-enter PIN"
                  className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                  Account Password (Required)
                </label>
                <input
                  type="password"
                  required
                  value={easyLoginPassword}
                  onChange={(e) => setEasyLoginPassword(e.target.value)}
                  placeholder="Enter Firebase password"
                  className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E5E0D4] dark:border-[#2C2A25]">
              <span className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
                Your password is authenticated with Firebase and securely linked to your PIN.
              </span>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPinLoginForm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPinLogin}
                  className="px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPinLogin ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isSavingPinLogin ? 'Saving...' : 'Save Easy PIN Login'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 5. Optional Quick-Unlock PIN, Session Inactivity & Password Security */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] transition-colors space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              Vault Protection
            </p>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight flex items-center gap-2 mt-0.5">
              <Shield className="w-4 h-4 text-[#C5A059]" />
              Optional Quick-Unlock PIN &amp; Session Security
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-0.5">
              Salted PBKDF2-SHA256 PIN protection, inactivity auto-lock/logout, and Firebase password management
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-settings-change-pin"
              onClick={onOpenChangePinModal}
              className="px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{pinConfigured ? 'Change PIN' : 'Set Optional PIN'}</span>
            </button>

            {pinConfigured && (
              <button
                type="button"
                onClick={() => setShowDisablePinPrompt(!showDisablePinPrompt)}
                className="px-3 py-2 bg-[#F6F5F0] hover:bg-rose-50 dark:bg-[#22211D] dark:hover:bg-rose-950/40 border border-[#E5E0D4] dark:border-[#2C2A25] text-[#78746B] dark:text-[#9E9B92] hover:text-rose-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Disable PIN
              </button>
            )}
          </div>
        </div>

        {secConfigMsg && (
          <div className="p-3 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#C5A059]/40 rounded-xl text-xs text-[#8E7952] dark:text-[#C5A059] font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#C5A059]" />
            <span>{secConfigMsg}</span>
          </div>
        )}

        {secConfigErr && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {secConfigErr}
          </div>
        )}

        {showDisablePinPrompt && pinConfigured && (
          <form
            onSubmit={handleDisablePin}
            className="p-3.5 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <input
              type="password"
              maxLength={8}
              value={disablePinInput}
              onChange={(e) => setDisablePinInput(e.target.value)}
              placeholder="Enter current 4-digit PIN to disable..."
              className="flex-1 px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Confirm Disable PIN
            </button>
          </form>
        )}

        {/* Session Inactivity & Hashed Recovery Question Form */}
        <form
          onSubmit={handleSaveSecurityPreferences}
          className="p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl space-y-3.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                Inactivity Timeout
              </label>
              <select
                value={inactivityMinutes}
                onChange={(e) => setInactivityMinutes(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              >
                <option value={5}>After 5 minutes of inactivity</option>
                <option value={15}>After 15 minutes of inactivity</option>
                <option value={30}>After 30 minutes of inactivity</option>
                <option value={60}>After 60 minutes of inactivity</option>
                <option value={0}>Never (Manual lock/logout only)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                When Inactive
              </label>
              <select
                value={inactivityAction}
                onChange={(e) => setInactivityAction(e.target.value as 'lock' | 'logout')}
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              >
                <option value="lock">Lock Protected Balances (Require PIN)</option>
                <option value="logout">Automatically Log Out Session</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-[#E5E0D4] dark:border-[#2C2A25]">
            <div>
              <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                Optional Recovery Question
              </label>
              <input
                type="text"
                value={recoveryQuestion}
                onChange={(e) => setRecoveryQuestion(e.target.value)}
                placeholder="e.g. What is your primary bank keyword?"
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] placeholder-[#78746B]/60 focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1">
                Recovery Answer (Salted Hash Only)
              </label>
              <input
                type="password"
                value={recoveryAnswer}
                onChange={(e) => setRecoveryAnswer(e.target.value)}
                placeholder={
                  secQuestions.hasQuestion1Set
                    ? '•••••• (Configured — enter new to update)'
                    : 'Set optional recovery answer...'
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] placeholder-[#78746B]/60 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingSecConfig}
              className="px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSavingSecConfig ? 'Saving...' : 'Save Security Settings'}</span>
            </button>
          </div>
        </form>

        {/* Change Account Password Form */}
        <form
          onSubmit={handleChangePasswordSubmit}
          className="p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl space-y-3"
        >
          <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Change Account Login Password</span>
          </div>

          {passwordSuccess && (
            <div className="p-2.5 bg-white dark:bg-[#161614] border border-[#C5A059]/40 rounded-xl text-xs text-[#8E7952] dark:text-[#C5A059] font-medium">
              {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              {passwordError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              required
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                required
              />
              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isChangingPassword ? '...' : 'Update'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 6. App Info & Private Google Drive Backup / Storage */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              Cloud &amp; Storage
            </p>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight flex items-center gap-2 mt-0.5">
              <IndianRupee className="w-4 h-4 text-[#C5A059]" />
              Google Drive Location &amp; inflowtrack Sheet Management
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-settings-download-sheet"
              onClick={() => void handleTriggerDownloadSheet()}
              disabled={externalDownloading || isLocalDownloadingSheet}
              className="px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {externalDownloading || isLocalDownloadingSheet ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Sheet</span>
            </button>

            <button
              type="button"
              id="btn-settings-create-new-sheet"
              onClick={() => setConfirmActionType('create_sheet')}
              disabled={isCreatingNewSheet}
              className="px-3.5 py-2 bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {isCreatingNewSheet ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>New Sheet</span>
            </button>

            <button
              type="button"
              id="btn-create-drive-backup"
              onClick={handleCreateDriveBackup}
              disabled={isCreatingBackup}
              className="px-3.5 py-2 bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {isCreatingBackup ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              <span>Backup JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReceiptForm(!showReceiptForm)}
              className="px-3.5 py-2 bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#8E7952] dark:text-[#C5A059] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Archive Receipt</span>
            </button>
          </div>
        </div>

        {/* Google Drive Location & Sheet Configuration Form */}
        <div className="mb-4 p-4 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[#C5A059]" />
                <span>Google Drive Folder Location &amp; Sheet Name</span>
              </div>
              <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-0.5">
                Stores and downloads your <strong className="text-[#141412] dark:text-[#F6F5F0]">inflowtrack</strong> spreadsheet directly inside your Google Drive folder
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <label
                htmlFor="input-drive-folder-url"
                className="block text-[10px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1"
              >
                Google Drive Folder URL or ID
              </label>
              <input
                type="text"
                id="input-drive-folder-url"
                value={driveFolderUrlInput}
                onChange={(e) => setDriveFolderUrlInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1WTHHDzwzO79ypcP06ZmDkBuDADosnH30"
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-mono text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="input-spreadsheet-name"
                className="block text-[10px] font-medium text-[#5E5B52] dark:text-[#A39F95] uppercase tracking-wider mb-1"
              >
                Sheet Name
              </label>
              <input
                type="text"
                id="input-spreadsheet-name"
                value={spreadsheetNameInput}
                onChange={(e) => setSpreadsheetNameInput(e.target.value)}
                placeholder="inflowtrack"
                className="w-full px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="button"
                id="btn-save-drive-location"
                onClick={() => setConfirmActionType('update_location')}
                disabled={isUpdatingDriveLocation}
                className="w-full px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUpdatingDriveLocation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>Update Location</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#78746B] dark:text-[#9E9B92]">
            <span>
              Resolved Folder ID:{' '}
              <strong className="font-mono text-[#141412] dark:text-[#F6F5F0]">
                {extractFolderIdFromUrlOrId(driveFolderUrlInput)}
              </strong>
            </span>
            <div className="flex items-center gap-3">
              {sheetInfo?.url && (
                <a
                  href={sheetInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8E7952] dark:text-[#C5A059] font-medium hover:underline inline-flex items-center gap-1"
                >
                  <span>Open {sheetInfo.name || TARGET_SPREADSHEET_NAME} Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <a
                href={`https://drive.google.com/drive/folders/${extractFolderIdFromUrlOrId(driveFolderUrlInput)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8E7952] dark:text-[#C5A059] font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Drive Folder</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {driveMessage && (
          <div className="mb-4 p-3 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#C5A059]/40 rounded-xl text-xs text-[#8E7952] dark:text-[#C5A059] font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#C5A059]" />
            <span>{driveMessage}</span>
          </div>
        )}

        {driveError && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {driveError}
          </div>
        )}

        {showReceiptForm && (
          <form
            onSubmit={handleSaveReceiptToDrive}
            className="mb-4 p-4 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl space-y-3"
          >
            <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
              Archive Private Receipt / Document Reference in Google Drive
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={receiptTitle}
                onChange={(e) => setReceiptTitle(e.target.value)}
                placeholder="Receipt Title (e.g. Laptop Invoice #402)"
                className="px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
              <input
                type="text"
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                placeholder="Warranty / Payment Reference / Notes"
                className="px-3 py-2 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptForm(false)}
                className="px-3 py-1.5 text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingBackup}
                className="px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl cursor-pointer"
              >
                Save Private Receipt
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059] uppercase tracking-wider">
              Google Cloud Project
            </div>
            <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] mt-1 font-mono truncate">
              inflowtrack-06
            </div>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-1">
              Project #472293799820 (Firebase Auth)
            </p>
          </div>

          <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059] uppercase tracking-wider">
              Base Currency
            </div>
            <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] mt-1 flex items-center gap-1.5">
              Indian Rupee (₹)
              <span className="px-2 py-0.5 bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] text-[10px] font-bold rounded-md border border-[#C5A059]/30">
                INR
              </span>
            </div>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-1">
              Indian numbering format (e.g. ₹1,50,000) for all balances.
            </p>
          </div>

          <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059] uppercase tracking-wider">
              Google Sheet Database
            </div>
            <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] mt-1 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#C5A059]" />
              {sheetInfo?.name || TARGET_SPREADSHEET_NAME}
            </div>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-1">
              Synced with your <strong className="text-[#141412] dark:text-[#F6F5F0]">{TARGET_SPREADSHEET_NAME}</strong> sheet.
            </p>
          </div>

          <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059] uppercase tracking-wider">
              Google Drive Folder
            </div>
            <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] mt-1 flex items-center justify-between gap-1.5">
              <span className="truncate">{sheetInfo?.driveFolderName || TARGET_DRIVE_FOLDER_NAME}</span>
              <a
                href={sheetInfo?.driveFolderUrl || TARGET_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#8E7952] dark:text-[#C5A059] text-[10px] font-medium rounded-md hover:underline shrink-0"
              >
                Open
              </a>
            </div>
            <p className="text-[10px] font-mono text-[#78746B] dark:text-[#9E9B92] mt-1 truncate" title={sheetInfo?.driveFolderId || TARGET_DRIVE_FOLDER_ID}>
              ID: {sheetInfo?.driveFolderId || TARGET_DRIVE_FOLDER_ID}
            </p>
          </div>
        </div>

        {/* Private Backups List */}
        {backups.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059] uppercase tracking-wider mb-2">
              Recent Private Google Drive Backups &amp; Receipts ({backups.length})
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {backups.slice(0, 5).map((bkp) => (
                <div
                  key={bkp.id}
                  className="px-3 py-2 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-[#141412] dark:text-[#F6F5F0]">{bkp.name}</span>
                    <span className="ml-2 text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                      {new Date(bkp.createdTime).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadDriveBackupFile(null, bkp.id, bkp.name)}
                    className="px-2.5 py-1 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/60 rounded-lg text-[11px] font-semibold text-[#8E7952] dark:text-[#C5A059] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7. Connected Account & Sign Out */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl p-5 md:p-6 shadow-2xs border border-[#E5E0D4] dark:border-[#282622] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt="User profile"
              className="w-10 h-10 rounded-full border border-[#E5E0D4] dark:border-[#2C2A25]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] flex items-center justify-center font-bold text-sm">
              {userName ? userName[0].toUpperCase() : userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0]">
              {userName || 'inflowtrack Personal Account'}
            </div>
            <div className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              {userEmail || 'Authenticated via Firebase'}
            </div>
            {userUid && (
              <div className="text-[10px] font-mono text-[#8E7952] dark:text-[#C5A059] mt-0.5">
                Verified UID: {userUid}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          id="btn-sign-out"
          onClick={onSignOut}
          className="px-4 py-2 bg-[#F6F5F0] hover:bg-rose-50 dark:bg-[#22211D] dark:hover:bg-rose-950/40 text-[#78746B] dark:text-[#9E9B92] hover:text-rose-600 text-xs font-semibold rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Confirmation Dialog for Creating / Updating Google Drive Sheet */}
      <ConfirmationDialog
        isOpen={confirmActionType !== null}
        title={
          confirmActionType === 'create_sheet'
            ? `Create New "${spreadsheetNameInput.trim() || TARGET_SPREADSHEET_NAME}" Sheet in Google Drive?`
            : 'Update Google Drive Folder Location?'
        }
        message={
          confirmActionType === 'create_sheet'
            ? `This will create a new Google Sheet named "${
                spreadsheetNameInput.trim() || TARGET_SPREADSHEET_NAME
              }" inside your Google Drive folder (${extractFolderIdFromUrlOrId(
                driveFolderUrlInput
              )}) and sync your categories, budgets, and transactions into it.`
            : `This will update your target Google Drive folder to ${
                driveFolderUrlInput.trim() || TARGET_DRIVE_FOLDER_URL
              } (ID: ${extractFolderIdFromUrlOrId(
                driveFolderUrlInput
              )}) and sync your "${
                spreadsheetNameInput.trim() || TARGET_SPREADSHEET_NAME
              }" spreadsheet.`
        }
        confirmLabel={
          confirmActionType === 'create_sheet' ? 'Create Sheet in Drive' : 'Confirm Update Location'
        }
        cancelLabel="Cancel"
        isDestructive={false}
        isLoading={isCreatingNewSheet || isUpdatingDriveLocation}
        onConfirm={() => void handleConfirmDriveMutation()}
        onCancel={() => setConfirmActionType(null)}
      />
    </div>
  );
};
