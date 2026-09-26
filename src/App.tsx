/**
 * ============================================================================
 * File: src/App.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Root React application container orchestrating authentication state,
 *   Google Sheets data synchronization, PIN lock/unlock state, inactivity
 *   session protection, and responsive Desktop/Mobile navigation views.
 *
 * Key Responsibilities:
 *   1. Subscribes to Firebase Authentication state (`initAuth`) and gates
 *      access behind `<AuthScreen />` until a verified user & ID token exist.
 *   2. Synchronizes dynamic categories, monthly transactions, budgets, and
 *      security metadata with Google Sheets via backend-verified APIs.
 *   3. Enforces configurable session inactivity protection (auto-locking
 *      protected balances with the 4-digit PIN or auto-signing out when idle).
 *   4. Coordinates responsive layouts for Mobile (Bottom Navigation tabs:
 *      Dashboard, Goals, Add, Trends, Settings) and Desktop (Dashboard & Goals
 *      tabs + Settings modal).
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  initAuth,
  logout,
  getAccessToken,
} from './services/googleAuth';
import {
  findOrCreateFinanceSpreadsheet,
  readCategories,
  readTransactions,
  appendTransaction,
  updateTransactionRow,
  addCategoryToSheet,
  deleteTransactionRow,
  deleteTransactionsBatch,
  downloadSheetFromDrive,
} from './services/sheets';
import {
  Transaction,
  TransactionType,
  CategoryData,
  DashboardStats,
  SpreadsheetInfo,
  MobileTab,
  AppViewTab,
  ThemeMode,
  GoogleUser,
} from './types';
import {
  calculateDashboardStats,
  calculateCurrentMonthExpenses,
} from './utils/calculations';
import {
  getCurrentMonthKey,
  formatMonthYear,
} from './utils/formatters';
import { getInitialTheme, applyTheme } from './utils/theme';
import {
  hasSecurityPinSet,
  getInactivityTimeoutMinutes,
  getInactivityAction,
} from './utils/security';

import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { DashboardMonthNav } from './components/DashboardMonthNav';
import { AddTransactionForm } from './components/AddTransactionForm';
import { ExpensePieChart } from './components/ExpensePieChart';
import { MonthlyComparisonChart } from './components/MonthlyComparisonChart';
import { TrendLineChart } from './components/TrendLineChart';
import { RecentActivity } from './components/RecentActivity';
import { GoalsView } from './components/GoalsView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SettingsView } from './components/SettingsView';
import { AuthScreen } from './components/AuthScreen';
import { SecurityPinModal, PinModalMode } from './components/SecurityPinModal';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Minus,
  AlertCircle,
  X,
  Wallet,
  Lock,
} from 'lucide-react';

export default function App() {
  // Global Security PIN Lock state (Masks amounts and protects targets until unlocked if PIN is enabled)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<PinModalMode>('unlock');
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);
  const initialSecurityCheckDone = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Theme State (Light / Dark / System Default)
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(currentTheme);

    if (currentTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyTheme('system');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [currentTheme]);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
  };

  // Authentication State
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Spreadsheet Data State
  const [sheetInfo, setSheetInfo] = useState<SpreadsheetInfo | null>(null);
  const [categories, setCategories] = useState<CategoryData>({
    incomeCategories: [],
    expenseCategories: [],
    savingsCategories: [],
    emergencyFundCategories: [],
    lentBorrowedCategories: [],
    paymentModes: [],
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDownloadingSheet, setIsDownloadingSheet] = useState<boolean>(false);
  const [sheetActionNotice, setSheetActionNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Navigation & View State
  const [activeDesktopTab, setActiveDesktopTab] = useState<AppViewTab>('dashboard');
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('home');
  const [selectedDashboardMonth, setSelectedDashboardMonth] = useState<string>(getCurrentMonthKey());
  const [preSelectedType, setPreSelectedType] = useState<TransactionType>('Expense');
  const [preSelectedCategory, setPreSelectedCategory] = useState<string>('');
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState<boolean>(false);

  // Initialize Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, cachedToken) => {
        setCurrentUser(user);
        setToken(cachedToken);
        setIsAuthLoading(false);
        lastActivityRef.current = Date.now();
      },
      () => {
        setCurrentUser(null);
        setToken(null);
        setIsUnlocked(false);
        initialSecurityCheckDone.current = false;
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch / Sync Spreadsheet Data & Security Status
  const loadData = useCallback(
    async (accessToken: string, showRefreshSpinner = false) => {
      if (showRefreshSpinner) {
        setIsRefreshing(true);
      } else {
        setIsLoadingData(true);
      }
      setErrorMessage(null);

      try {
        // 1. Locate or initialize the Personal Finance Tracker spreadsheet
        const info = await findOrCreateFinanceSpreadsheet(accessToken);
        setSheetInfo(info);

        // 2. Read dynamic Categories and Transactions (bootstrap also syncs Budgets & Security metadata)
        const [catData, txList] = await Promise.all([
          readCategories(accessToken, info.id),
          readTransactions(accessToken, info.id),
        ]);

        setCategories(catData);
        setTransactions(txList);

        // If user has NOT enabled an optional PIN, unlock targets/masked amounts automatically.
        // If user HAS enabled a PIN, keep locked on initial login until they unlock with PIN.
        if (!initialSecurityCheckDone.current) {
          initialSecurityCheckDone.current = true;
          if (!hasSecurityPinSet()) {
            setIsUnlocked(true);
          } else {
            setIsUnlocked(false);
          }
        }
      } catch (err: any) {
        const msg = err?.message || 'Failed to sync with your Google Spreadsheet.';
        if (
          msg.toLowerCase().includes('session expired') ||
          msg.toLowerCase().includes('unauthorized')
        ) {
          setErrorMessage('Your session has expired. Please sign out and sign in again.');
        } else {
          setErrorMessage(msg);
        }
      } finally {
        setIsLoadingData(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Load spreadsheet data when token becomes available
  useEffect(() => {
    if (token) {
      loadData(token);
    }
  }, [token, loadData]);

  // Handle Sign Out
  const handleSignOut = useCallback(async (expiredReason?: string) => {
    await logout();
    setCurrentUser(null);
    setToken(null);
    setSheetInfo(null);
    setTransactions([]);
    setIsUnlocked(false);
    initialSecurityCheckDone.current = false;
    setIsDesktopSettingsOpen(false);
    setActiveMobileTab('home');
    setActiveDesktopTab('dashboard');
    if (expiredReason) {
      setAuthError(expiredReason);
    }
  }, []);

  // Configurable Session Inactivity Protection (Auto-Lock PIN & Auto-Logout)
  useEffect(() => {
    if (!currentUser || !token) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const inactivityInterval = setInterval(() => {
      const timeoutMinutes = getInactivityTimeoutMinutes();
      if (!timeoutMinutes || timeoutMinutes <= 0) return;

      const elapsedMs = Date.now() - lastActivityRef.current;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const action = getInactivityAction();

      // If action is logout, or inactive for 2x timeout, or no PIN configured when timeout expires
      if (
        (action === 'logout' && elapsedMs >= timeoutMs) ||
        elapsedMs >= timeoutMs * 2 ||
        (!hasSecurityPinSet() && elapsedMs >= timeoutMs)
      ) {
        handleSignOut('Your session was automatically signed out due to inactivity. Please log in again.');
        return;
      }

      // If PIN is configured and elapsed >= timeoutMs, lock the PIN session
      if (hasSecurityPinSet() && isUnlocked && elapsedMs >= timeoutMs) {
        setIsUnlocked(false);
        setInactivityNotice(
          `Session locked after ${timeoutMinutes} minutes of inactivity. Unlock with your PIN to view protected balances.`
        );
      }
    }, 15000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(inactivityInterval);
    };
  }, [currentUser, token, isUnlocked, handleSignOut]);

  // Auto-Sync: Periodic background poll (every 30s) and on window focus
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isRefreshing && !isLoadingData) {
        const currentToken = token || getAccessToken();
        if (currentToken) {
          loadData(currentToken, false);
        }
      }
    }, 30000);

    const handleFocus = () => {
      const currentToken = token || getAccessToken();
      if (currentToken && !isRefreshing) {
        loadData(currentToken, false);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, isRefreshing, isLoadingData, loadData]);

  // Handle Manual Refresh
  const handleManualRefresh = async () => {
    const currentToken = token || getAccessToken();
    if (currentToken) {
      await loadData(currentToken, true);
    }
  };

  // Handle Store in Drive & Download Sheet
  const handleDownloadSheet = async () => {
    const currentToken = token || getAccessToken();
    if (!currentToken) return;
    setIsDownloadingSheet(true);
    setErrorMessage(null);
    setSheetActionNotice(null);
    try {
      const result = await downloadSheetFromDrive(currentToken);
      const updatedInfo = await findOrCreateFinanceSpreadsheet(currentToken);
      if (updatedInfo) {
        setSheetInfo(updatedInfo);
      }
      setSheetActionNotice(
        `Stored "${updatedInfo?.name || 'inflowtrack'}" in your Google Drive folder and downloaded ${result.fileName}!`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to store and download sheet.');
    } finally {
      setIsDownloadingSheet(false);
    }
  };

  // Handle Save New Transaction
  const handleSaveTransaction = async (newTx: {
    date: string;
    time?: string;
    type: TransactionType;
    category: string;
    subcategory?: string;
    amount: number;
    paymentMode?: string;
    accountWallet?: string;
    description: string;
  }) => {
    const currentToken = token || getAccessToken();
    if (!currentToken || !sheetInfo) {
      throw new Error('Google Spreadsheet connection is unavailable. Please sign in again.');
    }

    await appendTransaction(currentToken, sheetInfo.id, newTx);
    await loadData(currentToken, true);

    if (activeMobileTab === 'add') {
      setActiveMobileTab('home');
    }
  };

  // Handle Modify / Update Existing Transaction in Google Sheet
  const handleUpdateTransaction = async (
    rowIndex: number,
    updatedData: {
      date: string;
      time?: string;
      type: TransactionType;
      category: string;
      subcategory?: string;
      amount: number;
      paymentMode?: string;
      accountWallet?: string;
      description: string;
    }
  ) => {
    const currentToken = token || getAccessToken();
    if (!currentToken || !sheetInfo) {
      throw new Error('Google Spreadsheet connection is unavailable. Please sign in again.');
    }

    await updateTransactionRow(currentToken, sheetInfo.id, rowIndex, updatedData);
    await loadData(currentToken, true);
  };

  // Handle Apply Recurring Transaction
  const handleApplyRecurring = async (tx: {
    date: string;
    time?: string;
    type: TransactionType;
    category: string;
    subcategory?: string;
    amount: number;
    paymentMode?: string;
    accountWallet?: string;
    description: string;
  }) => {
    const currentToken = token || getAccessToken();
    if (!currentToken || !sheetInfo) {
      throw new Error('Google Spreadsheet connection is unavailable.');
    }

    await appendTransaction(currentToken, sheetInfo.id, tx);
    await loadData(currentToken, true);
  };

  // Handle Add Category to Sheet
  const handleAddCategory = async (type: 'Income' | 'Expense', categoryName: string) => {
    const currentToken = token || getAccessToken();
    if (!currentToken || !sheetInfo) {
      throw new Error('Google Spreadsheet connection is unavailable.');
    }

    await addCategoryToSheet(currentToken, sheetInfo.id, type, categoryName);
    const updatedCats = await readCategories(currentToken, sheetInfo.id);
    setCategories(updatedCats);
  };

  // Handle Delete Single Transaction
  const handleDeleteTransaction = async (rowIndex: number) => {
    const currentToken = token || getAccessToken();
    if (!currentToken || !sheetInfo) {
      throw new Error('Google Spreadsheet connection is unavailable.');
    }

    await deleteTransactionRow(currentToken, sheetInfo.id, rowIndex);
    await loadData(currentToken, true);
  };

  // Handle Delete Batch Transactions
  const handleDeleteTransactionsBatch = async (rowIndices: number[]) => {
    const currentToken = token || getAccessToken();
    if (!currentToken || !sheetInfo) {
      throw new Error('Google Spreadsheet connection is unavailable.');
    }

    await deleteTransactionsBatch(currentToken, sheetInfo.id, rowIndices);
    await loadData(currentToken, true);
  };

  // Quick Action Handlers (+ Income & − Expense)
  const handleOpenAddIncome = () => {
    setPreSelectedType('Income');
    setActiveMobileTab('add');
  };

  const handleOpenAddExpense = () => {
    setPreSelectedType('Expense');
    setActiveMobileTab('add');
  };

  const handleOpenAddGoal = (type: TransactionType, category?: string) => {
    setPreSelectedType(type);
    if (category) {
      setPreSelectedCategory(category);
    }
    setActiveMobileTab('add');
    setActiveDesktopTab('dashboard');
  };

  // Dashboard Stats scoped to selected month
  const stats: DashboardStats = useMemo(() => {
    return calculateDashboardStats(transactions, selectedDashboardMonth);
  }, [transactions, selectedDashboardMonth]);

  // Overall lifetime net balance for header
  const overallStats: DashboardStats = useMemo(() => {
    return calculateDashboardStats(transactions);
  }, [transactions]);

  // Category Expenses for selected month
  const currentMonthExpenses = useMemo(() => {
    return calculateCurrentMonthExpenses(
      transactions,
      categories.expenseCategories,
      selectedDashboardMonth
    );
  }, [transactions, categories.expenseCategories, selectedDashboardMonth]);

  const monthLabel = formatMonthYear(selectedDashboardMonth);

  // Loading Splash Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F4F3EF] dark:bg-[#111110] flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816] flex items-center justify-center font-display font-bold text-xl mb-3 animate-pulse shadow-sm">
          i
        </div>
        <p className="text-xs font-medium text-[#78756E] dark:text-[#9C9990]">
          Opening inflotrack workspace...
        </p>
      </div>
    );
  }

  // Not Authenticated -> Show Auth Screen
  if (!currentUser || !token) {
    return (
      <AuthScreen
        onAuthSuccess={(user, idToken) => {
          setAuthError(null);
          setCurrentUser(user);
          setToken(idToken);
          lastActivityRef.current = Date.now();
        }}
        errorMessage={authError}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F6F5F0] dark:bg-[#111110] text-[#141412] dark:text-[#F6F5F0] flex flex-col font-sans antialiased transition-colors duration-150">
      {/* Top Header with Desktop Navigation Tabs */}
      <Header
        sheetInfo={sheetInfo}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        onDownloadSheet={handleDownloadSheet}
        isDownloadingSheet={isDownloadingSheet}
        onOpenSettings={() => {
          setIsDesktopSettingsOpen(true);
          setActiveMobileTab('settings');
        }}
        onOpenRecordEntry={() => {
          setActiveDesktopTab('dashboard');
          setActiveMobileTab('add');
          setTimeout(() => {
            const formEl = document.getElementById('add-transaction-form-card');
            if (formEl) {
              formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const amountInput = document.getElementById('tx-amount');
            if (amountInput) {
              amountInput.focus({ preventScroll: true });
            }
          }, 80);
        }}
        userEmail={currentUser.email}
        userPhoto={currentUser.photoURL}
        netBalance={overallStats.netBalance}
        activeDesktopTab={activeDesktopTab}
        onTabChange={(tab) => setActiveDesktopTab(tab)}
        isUnlocked={isUnlocked}
        onOpenUnlockModal={() => {
          setPinModalMode('unlock');
          setIsPinModalOpen(true);
        }}
        onLock={() => setIsUnlocked(false)}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
      />

      {/* Sheet Stored & Downloaded Notice Banner */}
      {sheetActionNotice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{sheetActionNotice}</span>
              {sheetInfo?.driveFolderUrl && (
                <a
                  href={sheetInfo.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold text-emerald-900 dark:text-emerald-200 hover:text-emerald-700"
                >
                  Open Drive Folder
                </a>
              )}
              {sheetInfo?.url && (
                <a
                  href={sheetInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold text-emerald-900 dark:text-emerald-200 hover:text-emerald-700"
                >
                  Open inflowtrack Sheet
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSheetActionNotice(null)}
              className="p-0.5 text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Inactivity Lock Banner */}
      {inactivityNotice && !isUnlocked && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-medium text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{inactivityNotice}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInactivityNotice(null);
                  setPinModalMode('unlock');
                  setIsPinModalOpen(true);
                }}
                className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/80 hover:bg-amber-200 dark:hover:bg-amber-900 rounded text-amber-900 dark:text-amber-200 font-bold cursor-pointer"
              >
                Unlock PIN
              </button>
              <button
                type="button"
                onClick={() => setInactivityNotice(null)}
                className="p-0.5 text-amber-600 hover:text-amber-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-medium text-rose-800 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/80 hover:bg-rose-200 dark:hover:bg-rose-900 rounded text-rose-900 dark:text-rose-200 font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 fluid-container py-4 sm:py-5 lg:py-6 mb-4 flex flex-col gap-5 min-w-0">
        {/* ========================================================================= */}
        {/* MOBILE VIEW (Screens controlled by mobile bottom navigation)              */}
        {/* ========================================================================= */}
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            {/* MOBILE TAB 1: HOME (DASHBOARD) */}
            {activeMobileTab === 'home' && (
              <motion.div
                key="mobile-home"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="space-y-4"
              >
                {/* Month Navigation on Mobile */}
                <DashboardMonthNav
                  selectedMonth={selectedDashboardMonth}
                  onMonthChange={setSelectedDashboardMonth}
                />

                {/* 1. Total Balance + KPIs */}
                <SummaryCards
                  stats={stats}
                  overallNetBalance={overallStats.netBalance}
                  userName={currentUser.displayName || currentUser.email}
                  categories={categories}
                  onOpenRecordTransaction={() => {
                    setPreSelectedType('Expense');
                    setPreSelectedCategory('');
                    setActiveMobileTab('add');
                  }}
                  onQuickAction={(type, category) => {
                    setPreSelectedType(type);
                    setPreSelectedCategory(category || '');
                    setActiveMobileTab('add');
                  }}
                  onOpenCardsSection={() => setActiveMobileTab('goals')}
                />

                {/* 4. Mobile Monthly Income vs Expenses Comparison Chart */}
                <MonthlyComparisonChart
                  transactions={transactions}
                  selectedMonth={selectedDashboardMonth}
                  onSelectMonth={(monthKey) => setSelectedDashboardMonth(monthKey)}
                  isUnlocked={isUnlocked}
                />

                {/* 5. Mobile Expense Breakdown Pie Chart */}
                <ExpensePieChart data={currentMonthExpenses} monthLabel={monthLabel} />

                {/* 6. Mobile Recent Activity Table & Categorized Tabs */}
                <RecentActivity
                  transactions={transactions}
                  categories={categories}
                  onAddNewClick={() => setActiveMobileTab('add')}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteTransactionsBatch={handleDeleteTransactionsBatch}
                  onUpdateTransaction={handleUpdateTransaction}
                  onApplyRecurring={handleApplyRecurring}
                  selectedMonth={selectedDashboardMonth}
                  onDownloadSheet={handleDownloadSheet}
                  isDownloadingSheet={isDownloadingSheet}
                />
              </motion.div>
            )}

            {/* MOBILE TAB 2: GOALS TAB */}
            {activeMobileTab === 'goals' && (
              <motion.div
                key="mobile-goals"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="space-y-4"
              >
                <GoalsView
                  transactions={transactions}
                  userName={currentUser.displayName || currentUser.email}
                  overallNetBalance={overallStats.netBalance}
                  onOpenAddGoal={handleOpenAddGoal}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteTransactionsBatch={handleDeleteTransactionsBatch}
                  isUnlocked={isUnlocked}
                />
              </motion.div>
            )}

            {/* MOBILE TAB 3: ADD NEW */}
            {activeMobileTab === 'add' && (
              <motion.div
                key="mobile-add"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="space-y-4"
              >
                <AddTransactionForm
                  categories={categories}
                  initialType={preSelectedType}
                  initialCategory={preSelectedCategory}
                  onSave={handleSaveTransaction}
                  onSuccessCallback={() => {
                    setActiveMobileTab('home');
                  }}
                />
              </motion.div>
            )}

            {/* MOBILE TAB 4: ANALYSIS */}
            {activeMobileTab === 'analysis' && (
              <motion.div
                key="mobile-analysis"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="space-y-4"
              >
                <MonthlyComparisonChart
                  transactions={transactions}
                  selectedMonth={selectedDashboardMonth}
                  onSelectMonth={(monthKey) => setSelectedDashboardMonth(monthKey)}
                  isUnlocked={isUnlocked}
                />
                <ExpensePieChart data={currentMonthExpenses} monthLabel={monthLabel} />
                <TrendLineChart
                  transactions={transactions}
                  selectedMonth={selectedDashboardMonth}
                />
              </motion.div>
            )}

            {/* MOBILE TAB 5: SETTINGS */}
            {activeMobileTab === 'settings' && (
              <motion.div
                key="mobile-settings"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <SettingsView
                  sheetInfo={sheetInfo}
                  categories={categories}
                  userEmail={currentUser.email}
                  userName={currentUser.displayName}
                  userPhoto={currentUser.photoURL}
                  currentTheme={currentTheme}
                  onThemeChange={handleThemeChange}
                  onRefresh={handleManualRefresh}
                  onAddCategory={handleAddCategory}
                  onSignOut={() => handleSignOut()}
                  isRefreshing={isRefreshing}
                  isUnlocked={isUnlocked}
                  onOpenUnlockModal={() => {
                    setPinModalMode('unlock');
                    setIsPinModalOpen(true);
                  }}
                  onOpenChangePinModal={() => {
                    setPinModalMode('change');
                    setIsPinModalOpen(true);
                  }}
                  onSheetInfoChange={(updatedInfo) => setSheetInfo(updatedInfo)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ========================================================================= */}
        {/* DESKTOP VIEW (Tabbed: Dashboard & Goals)                                  */}
        {/* ========================================================================= */}
        <div className="hidden md:flex md:flex-col gap-5">
          <AnimatePresence mode="wait">
            {activeDesktopTab === 'dashboard' ? (
              <motion.div
                key="desktop-dashboard"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex flex-col gap-5"
              >
                {/* Month Navigation Control Bar */}
                <DashboardMonthNav
                  selectedMonth={selectedDashboardMonth}
                  onMonthChange={setSelectedDashboardMonth}
                />

                {/* Top Metric Cards: Total Balance & KPIs */}
                <SummaryCards
                  stats={stats}
                  overallNetBalance={overallStats.netBalance}
                  userName={currentUser.displayName || currentUser.email}
                  categories={categories}
                  onOpenRecordTransaction={() => {
                    setPreSelectedType('Expense');
                    setPreSelectedCategory('');
                    const formEl = document.getElementById('add-transaction-form-card');
                    if (formEl) {
                      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    const amountInput = document.getElementById('tx-amount');
                    if (amountInput) {
                      amountInput.focus({ preventScroll: true });
                    }
                  }}
                  onQuickAction={(type, category) => {
                    setPreSelectedType(type);
                    setPreSelectedCategory(category || '');
                    const formEl = document.getElementById('add-transaction-form-card');
                    if (formEl) {
                      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  onOpenCardsSection={() => setActiveDesktopTab('goals')}
                />

                {/* Comparison & Category Breakdown Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Left Area: Monthly Comparison Bar Graph (2 cols) */}
                  <div className="lg:col-span-2">
                    <MonthlyComparisonChart
                      transactions={transactions}
                      selectedMonth={selectedDashboardMonth}
                      onSelectMonth={(monthKey) => setSelectedDashboardMonth(monthKey)}
                      isUnlocked={isUnlocked}
                    />
                  </div>

                  {/* Right Area: Category Expense Breakdown Donut Chart (1 col) */}
                  <div className="lg:col-span-1">
                    <ExpensePieChart data={currentMonthExpenses} monthLabel={monthLabel} />
                  </div>
                </div>

                {/* Charts & Quick Add Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Left Area: Daily Cashflow Trend */}
                  <div className="lg:col-span-2">
                    <TrendLineChart
                      transactions={transactions}
                      selectedMonth={selectedDashboardMonth}
                    />
                  </div>

                  {/* Right Area: Always Available Quick Add Transaction Form */}
                  <div className="lg:col-span-1">
                    <AddTransactionForm
                      categories={categories}
                      initialType={preSelectedType}
                      initialCategory={preSelectedCategory}
                      onSave={handleSaveTransaction}
                    />
                  </div>
                </div>

                {/* Bottom Area: Full Categorized Recent Activity Table with Modify, Export & Filters */}
                <RecentActivity
                  transactions={transactions}
                  categories={categories}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteTransactionsBatch={handleDeleteTransactionsBatch}
                  onUpdateTransaction={handleUpdateTransaction}
                  onApplyRecurring={handleApplyRecurring}
                  selectedMonth={selectedDashboardMonth}
                  onDownloadSheet={handleDownloadSheet}
                  isDownloadingSheet={isDownloadingSheet}
                />
              </motion.div>
            ) : (
              /* DESKTOP CARDS & GOALS VIEW */
              <motion.div
                key="desktop-goals"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <GoalsView
                  transactions={transactions}
                  userName={currentUser.displayName || currentUser.email}
                  overallNetBalance={overallStats.netBalance}
                  onOpenAddGoal={handleOpenAddGoal}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteTransactionsBatch={handleDeleteTransactionsBatch}
                  isUnlocked={isUnlocked}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Professional Multi-Column Executive Footer (Responsive on all screens) */}
      <footer className="bg-[#111110] text-[#F6F5F0] border-t border-[#262521] mt-8 pb-24 md:pb-0">
        <div className="fluid-container py-10 sm:py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
          <div className="space-y-3">
            <div className="font-display text-2xl font-semibold tracking-tight text-[#F6F5F0]">
              inflotrack
            </div>
            <p className="text-[#9E9B92] leading-relaxed">
              Sovereign personal wealth architecture, cash-flow intelligence, and private Google Sheets & Drive synchronization.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-medium text-[#C5A059] tracking-wider uppercase text-[11px]">
              Navigation
            </h4>
            <ul className="space-y-2 text-[#A39F95]">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDesktopTab('dashboard');
                    setActiveMobileTab('home');
                  }}
                  className="hover:text-[#F6F5F0] transition-colors cursor-pointer"
                >
                  Executive Cash-Flow Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDesktopTab('goals');
                    setActiveMobileTab('goals');
                  }}
                  className="hover:text-[#F6F5F0] transition-colors cursor-pointer"
                >
                  Cards, Vault & Capital Reserves
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setIsDesktopSettingsOpen(true);
                    setActiveMobileTab('settings');
                  }}
                  className="hover:text-[#F6F5F0] transition-colors cursor-pointer"
                >
                  Workspace & PIN Security
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-medium text-[#C5A059] tracking-wider uppercase text-[11px]">
              Sovereign Storage
            </h4>
            <ul className="space-y-2 text-[#A39F95]">
              <li>Google Sheets Live Ledger</li>
              <li>Google Drive Workbook Backup</li>
              <li>4-Digit PIN Reserve Protection</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-medium text-[#C5A059] tracking-wider uppercase text-[11px]">
              Client Office
            </h4>
            <p className="text-[#A39F95] truncate">
              {currentUser.email || 'Authenticated Private Session'}
            </p>
            <p className="text-[#78746B] text-[11px]">
              © {new Date().getFullYear()} inflotrack. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Desktop Settings Modal */}
      {isDesktopSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            id="desktop-settings-modal"
            className="bg-white dark:bg-[#181816] rounded-[28px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-[#E2DFD9] dark:border-[#2A2A27] relative transition-colors"
          >
            <button
              type="button"
              onClick={() => setIsDesktopSettingsOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center text-[#78756E] hover:text-[#181816] dark:hover:text-white bg-[#F4F3EF] dark:bg-[#22221F] rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="font-display text-lg font-semibold text-[#181816] dark:text-[#F4F3EF] tracking-tight mb-6">
              Workspace Settings
            </h2>

            <SettingsView
              sheetInfo={sheetInfo}
              categories={categories}
              userEmail={currentUser.email}
              userName={currentUser.displayName}
              userPhoto={currentUser.photoURL}
              currentTheme={currentTheme}
              onThemeChange={handleThemeChange}
              onRefresh={handleManualRefresh}
              onAddCategory={handleAddCategory}
              onSignOut={() => handleSignOut()}
              isRefreshing={isRefreshing}
              isUnlocked={isUnlocked}
              onOpenUnlockModal={() => {
                setPinModalMode('unlock');
                setIsPinModalOpen(true);
              }}
              onOpenChangePinModal={() => {
                setPinModalMode('change');
                setIsPinModalOpen(true);
              }}
              onSheetInfoChange={(updatedInfo) => setSheetInfo(updatedInfo)}
            />
          </div>
        </div>
      )}

      {/* Sticky Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeMobileTab}
        onTabChange={(tab) => {
          setActiveMobileTab(tab);
          if (tab === 'add') {
            setPreSelectedType('Expense');
          }
        }}
      />

      {/* Global Centralized Security PIN Modal */}
      <SecurityPinModal
        isOpen={isPinModalOpen}
        initialMode={pinModalMode}
        onClose={() => setIsPinModalOpen(false)}
        onSuccessUnlock={() => {
          setIsUnlocked(true);
          setInactivityNotice(null);
          lastActivityRef.current = Date.now();
          setIsPinModalOpen(false);
        }}
      />
    </div>
  );
}
