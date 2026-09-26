/**
 * ============================================================================
 * File: src/components/GoalsView.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Dedicated Goals & Reserves tracking view for monitoring Savings,
 *   Emergency Fund, Lent (Receivables), Borrowed (Payables), and Combined
 *   Capital Preserved progress against user-configured targets.
 *
 * Key Responsibilities:
 *   1. Supports timeframe switching (Month, Year, All-Time) with period
 *      sub-navigators.
 *   2. Masks sensitive reserve amounts and targets with '••••••' until the
 *      user unlocks the session with their 4-digit PIN (if enabled).
 *   3. Displays visual target fulfillment progress bars and a searchable,
 *      filterable Goals Activity Log table with bulk deletion support.
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Search,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckSquare,
  Square,
  MinusSquare,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Wifi,
  CreditCard,
  ArrowDown,
  ArrowUp,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Transaction,
  TransactionType,
  GoalsTimeframe,
  GoalsStats,
} from '../types';
import {
  calculateGoalsStats,
  filterGoalsTransactions,
  isBorrowedTransaction,
  isLentTransaction,
} from '../utils/calculations';
import {
  formatINR,
  formatDate,
  formatMonthYear,
  getPreviousMonthKey,
  getNextMonthKey,
  getCurrentMonthKey,
  getCurrentYearKey,
} from '../utils/formatters';
import {
  getSavingsTarget,
  getEmergencyFundTarget,
  calculateTargetProgress,
  calculateCombinedCapitalPreservedProgress,
} from '../utils/targets';
import { ConfirmationDialog } from './ConfirmationDialog';
import { TopUpWithdrawIconBadge } from '../utils/categoryIcons';
import {
  getAllVaultCards,
  addCustomVaultCard,
  removeCustomVaultCard,
  getCardThemeClasses,
  VaultCardItem,
  CardThemeFinish,
  CardNetwork,
} from '../utils/customCards';

interface GoalsViewProps {
  transactions: Transaction[];
  userName?: string | null;
  overallNetBalance?: number;
  onOpenAddGoal?: (type: TransactionType, category?: string) => void;
  onDeleteTransaction?: (rowIndex: number) => Promise<void>;
  onDeleteTransactionsBatch?: (rowIndices: number[]) => Promise<void>;
  sheetUrl?: string;
  isUnlocked?: boolean;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  transactions,
  userName,
  overallNetBalance = 0,
  onOpenAddGoal,
  onDeleteTransaction,
  onDeleteTransactionsBatch,
  isUnlocked = false,
}) => {
  // Timeframe state: 'month' | 'year' | 'alltime'
  const [timeframe, setTimeframe] = useState<GoalsTimeframe>('alltime');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [selectedYear, setSelectedYear] = useState<string>(getCurrentYearKey());

  // Search & Type filter in Goals table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Configurable Target values (read directly from targets utility configured in Settings)
  const savingsTargetVal = getSavingsTarget();
  const emergencyTargetVal = getEmergencyFundTarget();

  // Selected row indices for bulk deletion
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Dialog state for single and bulk deletion
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<number[] | null>(null);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate stats for current timeframe
  const goalsStats: GoalsStats = useMemo(() => {
    return calculateGoalsStats(transactions, timeframe, selectedMonth, selectedYear);
  }, [transactions, timeframe, selectedMonth, selectedYear]);

  // Target Progress calculations
  const savingsProgress = useMemo(() => {
    return calculateTargetProgress(goalsStats.savings, savingsTargetVal);
  }, [goalsStats.savings, savingsTargetVal]);

  const emergencyProgress = useMemo(() => {
    return calculateTargetProgress(goalsStats.emergencyFund, emergencyTargetVal);
  }, [goalsStats.emergencyFund, emergencyTargetVal]);

  const capitalPreservedProgress = useMemo(() => {
    return calculateCombinedCapitalPreservedProgress(
      goalsStats.savings,
      goalsStats.emergencyFund,
      savingsTargetVal,
      emergencyTargetVal
    );
  }, [goalsStats.savings, goalsStats.emergencyFund, savingsTargetVal, emergencyTargetVal]);

  // Helper for masking amounts when locked
  const displayAmount = (amount: number): string => {
    if (isUnlocked) {
      return formatINR(amount);
    }
    return '••••••';
  };

  // Filter transactions for current timeframe and search
  const filteredGoalsTransactions = useMemo(() => {
    const periodTxs = filterGoalsTransactions(transactions, timeframe, selectedMonth, selectedYear);
    return periodTxs.filter((tx) => {
      const matchesType = (() => {
        if (filterType === 'ALL') return true;
        if (filterType === 'Savings') return tx.type === 'Savings';
        if (filterType === 'Emergency Fund') return tx.type === 'Emergency Fund';
        if (filterType === 'Lent') return tx.type === 'Lent' || (tx.type === 'Lent & Borrowed' && isLentTransaction(tx));
        if (filterType === 'Borrowed') return tx.type === 'Borrowed' || (tx.type === 'Lent & Borrowed' && isBorrowedTransaction(tx));
        if (filterType === 'Lent & Borrowed') return tx.type === 'Lent' || tx.type === 'Borrowed' || tx.type === 'Lent & Borrowed';
        return tx.type === filterType;
      })();

      const matchesSearch =
        searchTerm === '' ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.amount.toString().includes(searchTerm) ||
        tx.date.includes(searchTerm);
      return matchesType && matchesSearch;
    });
  }, [transactions, timeframe, selectedMonth, selectedYear, filterType, searchTerm]);

  // Valid row indices in current filtered view
  const currentFilteredIndices = useMemo(() => {
    return filteredGoalsTransactions
      .map((tx) => tx.rowIndex)
      .filter((idx): idx is number => typeof idx === 'number');
  }, [filteredGoalsTransactions]);

  // Check if all visible transactions are selected
  const isAllSelected = useMemo(() => {
    if (currentFilteredIndices.length === 0) return false;
    return currentFilteredIndices.every((idx) => selectedRowIndices.has(idx));
  }, [currentFilteredIndices, selectedRowIndices]);

  const isSomeSelected = useMemo(() => {
    if (isAllSelected) return false;
    return currentFilteredIndices.some((idx) => selectedRowIndices.has(idx));
  }, [currentFilteredIndices, selectedRowIndices, isAllSelected]);

  // Toggle selection for a single transaction
  const handleToggleSelectRow = (rowIndex: number) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  // Toggle Select All
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIndices((prev) => {
        const next = new Set(prev);
        currentFilteredIndices.forEach((idx) => next.delete(idx));
        return next;
      });
    } else {
      setSelectedRowIndices((prev) => {
        const next = new Set(prev);
        currentFilteredIndices.forEach((idx) => next.add(idx));
        return next;
      });
    }
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedRowIndices(new Set());
  };

  // Trigger bulk delete confirmation
  const handleTriggerBulkDelete = () => {
    const indicesToDelete = Array.from(selectedRowIndices);
    if (indicesToDelete.length === 0) return;
    setPendingDeleteIndices(indicesToDelete);
    setPendingDeleteTx(null);
  };

  // Trigger single delete confirmation
  const handleTriggerSingleDelete = (tx: Transaction) => {
    if (!tx.rowIndex) return;
    setPendingDeleteTx(tx);
    setPendingDeleteIndices([tx.rowIndex]);
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => getPreviousMonthKey(prev));
  };
  const handleNextMonth = () => {
    setSelectedMonth((prev) => getNextMonthKey(prev));
  };

  // Year navigation handlers
  const handlePrevYear = () => {
    setSelectedYear((prev) => String(parseInt(prev, 10) - 1));
  };
  const handleNextYear = () => {
    setSelectedYear((prev) => String(parseInt(prev, 10) + 1));
  };

  // Get type visual badge styling
  const getTypeStyle = (tx: Transaction) => {
    switch (tx.type) {
      case 'Savings':
        return {
          label: 'Savings',
          textColor: 'text-blue-600 dark:text-blue-400',
          badgeBg:
            'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          icon: <PiggyBank className="w-3.5 h-3.5" />,
        };
      case 'Emergency Fund':
        return {
          label: 'Emergency Fund',
          textColor: 'text-amber-600 dark:text-amber-400',
          badgeBg:
            'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        };
      case 'Lent':
        return {
          label: 'Lent',
          textColor: 'text-purple-600 dark:text-purple-400',
          badgeBg:
            'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          icon: <ArrowUpRight className="w-3.5 h-3.5" />,
        };
      case 'Borrowed':
        return {
          label: 'Borrowed',
          textColor: 'text-rose-600 dark:text-rose-400',
          badgeBg:
            'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
        };
      case 'Lent & Borrowed':
        if (isBorrowedTransaction(tx)) {
          return {
            label: 'Borrowed',
            textColor: 'text-rose-600 dark:text-rose-400',
            badgeBg:
              'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
            icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
          };
        }
        return {
          label: 'Lent',
          textColor: 'text-purple-600 dark:text-purple-400',
          badgeBg:
            'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          icon: <ArrowUpRight className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: tx.type,
          textColor: 'text-slate-700 dark:text-slate-300',
          badgeBg:
            'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          icon: null,
        };
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteIndices || pendingDeleteIndices.length === 0) return;

    setIsDeleting(true);
    try {
      if (onDeleteTransactionsBatch) {
        await onDeleteTransactionsBatch(pendingDeleteIndices);
      } else if (onDeleteTransaction && pendingDeleteIndices.length === 1) {
        await onDeleteTransaction(pendingDeleteIndices[0]);
      } else if (onDeleteTransaction) {
        for (const idx of [...pendingDeleteIndices].sort((a, b) => b - a)) {
          await onDeleteTransaction(idx);
        }
      }

      setSelectedRowIndices((prev) => {
        const next = new Set(prev);
        pendingDeleteIndices.forEach((idx) => next.delete(idx));
        return next;
      });

      setPendingDeleteIndices(null);
      setPendingDeleteTx(null);
    } catch {
      // Error is handled by parent error banner without logging sensitive info to console
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCount = selectedRowIndices.size;
  const cardHolder = (userName || 'INFLOTRACK MEMBER').toUpperCase();

  // Interactive Swipeable Cards state
  const [vaultCards, setVaultCards] = useState<VaultCardItem[]>(() => getAllVaultCards());
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<number>(1);
  const [isAddCardOpen, setIsAddCardOpen] = useState<boolean>(false);

  // Add New Card Form state
  const [newCardName, setNewCardName] = useState('');
  const [newCardLast4, setNewCardLast4] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('12/29');
  const [newCardNetwork, setNewCardNetwork] = useState<CardNetwork>('VISA');
  const [newCardTier, setNewCardTier] = useState('Signature');
  const [newCardTheme, setNewCardTheme] = useState<CardThemeFinish>('obsidian');
  const [addCardError, setAddCardError] = useState<string | null>(null);

  const totalCards = vaultCards.length;
  const safeActiveIndex = totalCards > 0 ? ((activeCardIndex % totalCards) + totalCards) % totalCards : 0;
  const activeCard = vaultCards[safeActiveIndex] || vaultCards[0];
  const prevCardIndex = totalCards > 1 ? (safeActiveIndex - 1 + totalCards) % totalCards : 0;
  const nextCardIndex = totalCards > 1 ? (safeActiveIndex + 1) % totalCards : 0;
  const prevCard = vaultCards[prevCardIndex];
  const nextCard = vaultCards[nextCardIndex];

  const handleNextCard = () => {
    if (totalCards <= 1) return;
    setSwipeDirection(1);
    setActiveCardIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrevCard = () => {
    if (totalCards <= 1) return;
    setSwipeDirection(-1);
    setActiveCardIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const handleSelectCardIndex = (idx: number) => {
    if (idx === safeActiveIndex) return;
    setSwipeDirection(idx > safeActiveIndex ? 1 : -1);
    setActiveCardIndex(idx);
  };

  const handleAddCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddCardError(null);

    const cleanName = newCardName.trim();
    if (!cleanName) {
      setAddCardError('Please enter a card or bank name.');
      return;
    }

    const cleanLast4 = newCardLast4.replace(/\D/g, '').slice(-4).padStart(4, '8');
    const cleanExpiry = newCardExpiry.trim() || '12/29';
    const prefixMap: Record<CardNetwork, string> = {
      VISA: '4532',
      Mastercard: '5412',
      RuPay: '6521',
      AMEX: '3782',
    };

    const updated = addCustomVaultCard({
      name: cleanName,
      last4: cleanLast4,
      prefix4: prefixMap[newCardNetwork] || '4532',
      expiry: cleanExpiry,
      network: newCardNetwork,
      tier: newCardTier.trim() || 'Platinum',
      theme: newCardTheme,
    });

    setVaultCards(updated);
    setSwipeDirection(1);
    setActiveCardIndex(updated.length - 1);
    setNewCardName('');
    setNewCardLast4('');
    setNewCardExpiry('12/29');
    setIsAddCardOpen(false);
  };

  const handleRemoveActiveCustomCard = () => {
    if (!activeCard || activeCard.isDefault) return;
    const updated = removeCustomVaultCard(activeCard.id);
    setVaultCards(updated);
    setActiveCardIndex(0);
  };

  // Compute activity breakdown by Payment Card / Mode (including user's custom cards)
  const cardPaymentSummary = useMemo(() => {
    const map = new Map<string, { spent: number; inflow: number; count: number }>();
    vaultCards.forEach((c) => {
      if (c.id !== 'card-vault-primary') {
        map.set(c.name, { spent: 0, inflow: 0, count: 0 });
      }
    });
    ['HDFC Bank', 'UPI / GPay'].forEach((c) => {
      if (!map.has(c)) map.set(c, { spent: 0, inflow: 0, count: 0 });
    });

    transactions.forEach((tx) => {
      const mode = (tx.paymentMode || tx.account || 'HDFC Bank').trim();
      const entry = map.get(mode) || { spent: 0, inflow: 0, count: 0 };
      if (tx.type === 'Income') {
        entry.inflow += tx.amount;
      } else if (tx.type === 'Expense') {
        entry.spent += tx.amount;
      }
      entry.count += 1;
      map.set(mode, entry);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spent + b.inflow - (a.spent + a.inflow))
      .slice(0, 8);
  }, [transactions, vaultCards]);

  // Stats for currently focused card in the swipeable deck
  const activeCardStats = useMemo(() => {
    if (!activeCard || activeCard.id === 'card-vault-primary') {
      return {
        label: 'Available vault balance',
        amount: overallNetBalance,
        count: transactions.length,
        isVault: true,
      };
    }
    const targetName = activeCard.name.toLowerCase();
    let spent = 0;
    let inflow = 0;
    let count = 0;
    transactions.forEach((tx) => {
      const mode = (tx.paymentMode || '').toLowerCase();
      const acc = (tx.account || '').toLowerCase();
      if (mode === targetName || acc === targetName) {
        if (tx.type === 'Expense') spent += tx.amount;
        if (tx.type === 'Income') inflow += tx.amount;
        count += 1;
      }
    });
    return {
      label: `${activeCard.name} · Card Spend`,
      amount: spent,
      inflow,
      count,
      isVault: false,
    };
  }, [activeCard, overallNetBalance, transactions]);

  const activeTheme = getCardThemeClasses(activeCard?.theme || 'obsidian');
  const prevTheme = getCardThemeClasses(prevCard?.theme || 'platinum');
  const nextTheme = getCardThemeClasses(nextCard?.theme || 'navy');

  return (
    <div id="goals-view-container" className="space-y-4 sm:space-y-5">
      {/* 0. Interactive Swipeable Cards Section Hero + Linked Payment Cards Overview */}
      <div
        id="cards-section-showcase"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5"
      >
        {/* Left: Interactive Swipeable 3-Card Deck + Add Card Action */}
        <div className="lg:col-span-5 bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] flex flex-col items-center justify-between transition-colors shadow-2xs min-w-0 overflow-hidden">
          {/* Card Deck Top Header Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059] truncate">
                Swipe or tap to switch · {safeActiveIndex + 1} of {totalCards}
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
                My Cards & Vault
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!activeCard?.isDefault && (
                <button
                  type="button"
                  onClick={handleRemoveActiveCustomCard}
                  title="Remove this custom card"
                  className="min-h-[42px] min-w-[42px] p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                id="btn-open-add-card-modal"
                onClick={() => {
                  setAddCardError(null);
                  setIsAddCardOpen(true);
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          {/* Interactive Swipeable 3-Card Stack (Fluid sizing for 320px -> 1920px) */}
          <div className="relative w-full max-w-[356px] h-[196px] sm:h-[202px] flex items-center justify-center my-1 select-none overflow-hidden">
            {/* Left Peeking Card (Click to switch to Previous Card) */}
            {totalCards > 1 && prevCard && (
              <div
                onClick={handlePrevCard}
                role="button"
                tabIndex={-1}
                aria-label={`Switch to ${prevCard.name}`}
                className={`absolute left-1 sm:left-2 w-[min(62%,206px)] h-[140px] sm:h-[144px] rounded-2xl ${prevTheme.bg} ${prevTheme.text} p-3.5 sm:p-4 flex flex-col justify-between opacity-75 hover:opacity-95 -rotate-4 shadow-sm border ${prevTheme.border} transition-all cursor-pointer`}
              >
                <div className="text-[10px] font-medium truncate opacity-85">
                  {prevCard.name}
                </div>
                <div className="text-[11px] tracking-widest tabular-nums opacity-85">
                  {prevCard.prefix4} ••••
                </div>
              </div>
            )}

            {/* Right Peeking Card (Click to switch to Next Card) */}
            {totalCards > 1 && nextCard && (
              <div
                onClick={handleNextCard}
                role="button"
                tabIndex={-1}
                aria-label={`Switch to ${nextCard.name}`}
                className={`absolute right-1 sm:right-2 w-[min(62%,206px)] h-[140px] sm:h-[144px] rounded-2xl ${nextTheme.bg} ${nextTheme.text} p-3.5 sm:p-4 flex flex-col justify-between opacity-80 hover:opacity-95 rotate-4 shadow-sm border ${nextTheme.border} transition-all cursor-pointer`}
              >
                <div className="flex justify-end">
                  <Wifi className="w-3.5 h-3.5 opacity-70 rotate-90" />
                </div>
                <div className="text-right text-xs font-bold italic tracking-wider opacity-85">
                  {nextCard.network}
                </div>
              </div>
            )}

            {/* Center Active Swipeable Card */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeCard.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.45}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -40 || info.velocity.x < -280) {
                    handleNextCard();
                  } else if (info.offset.x > 40 || info.velocity.x > 280) {
                    handlePrevCard();
                  }
                }}
                initial={{ opacity: 0, x: swipeDirection * 42, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: swipeDirection * -42, scale: 0.96 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`relative z-10 w-[min(86%,282px)] h-[166px] sm:h-[172px] rounded-2xl ${activeTheme.bg} ${activeTheme.text} p-4 sm:p-5 flex flex-col justify-between shadow-xl border ${activeTheme.border} overflow-hidden cursor-grab active:cursor-grabbing touch-pan-y`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/[0.06] blur-xl"
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold tracking-tight truncate">
                      ▲ {activeCard.name}
                    </span>
                  </div>
                  <Wifi className="w-4 h-4 opacity-80 rotate-90 shrink-0" />
                </div>

                {/* Metallic Chip & Card Number */}
                <div className="space-y-2 my-auto pt-1">
                  <div
                    className={`w-8 sm:w-9 h-5.5 sm:h-6 rounded-md bg-gradient-to-br ${activeTheme.chip} border border-white/25 opacity-90`}
                  />
                  <div className="text-[11px] sm:text-[13px] tracking-[0.15em] sm:tracking-[0.18em] font-medium tabular-nums truncate">
                    {activeCard.prefix4} •••• •••• {activeCard.last4}
                  </div>
                </div>

                {/* Expiry, Holder & Network Badge */}
                <div className="flex items-end justify-between gap-2 pt-1">
                  <div className="min-w-0">
                    <div className={`text-[9px] ${activeTheme.subtext} tracking-wider`}>
                      VALID {activeCard.expiry}
                    </div>
                    <div className="text-[10px] font-medium tracking-wider truncate max-w-[135px] sm:max-w-[145px] mt-0.5">
                      {cardHolder}
                    </div>
                  </div>
                  <div className="text-right leading-none shrink-0">
                    <div className="text-sm sm:text-base font-bold italic tracking-wider">
                      {activeCard.network}
                    </div>
                    <div className={`text-[8px] ${activeTheme.subtext} tracking-wide mt-0.5`}>
                      {activeCard.tier}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Interactive Pagination Dots */}
          <div className="flex items-center justify-center gap-1.5 my-2">
            {vaultCards.map((c, idx) => {
              const isCurrent = idx === safeActiveIndex;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCardIndex(idx)}
                  aria-label={`View ${c.name}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    isCurrent
                      ? 'w-6 bg-[#C5A059]'
                      : 'w-2 bg-[#D5D0C5] dark:bg-[#3A3832] hover:bg-[#8E7952]'
                  }`}
                />
              );
            })}
          </div>

          {/* Active Card Balance/Spend Readout & Quick Card Actions */}
          <div className="w-full pt-3 border-t border-[#EFECE4] dark:border-[#24231F] flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] truncate">
                {activeCardStats.label}
              </p>
              <div className="font-display tabular-nums text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
                {displayAmount(activeCardStats.amount)}
              </div>
              <p className="text-[10px] text-[#8E7952] dark:text-[#C5A059] tabular-nums">
                {activeCardStats.count} {activeCardStats.count === 1 ? 'recorded entry' : 'recorded entries'}
              </p>
            </div>

            {onOpenAddGoal && (
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenAddGoal('Income', 'Salary')}
                  className="flex flex-col items-center gap-1 cursor-pointer min-w-[44px]"
                >
                  <TopUpWithdrawIconBadge
                    icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                    shape="square"
                    size="sm"
                  />
                  <span className="text-[10px] font-medium text-[#141412] dark:text-[#E6E4DD]">
                    Top Up
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddGoal('Expense', 'Shopping')}
                  className="flex flex-col items-center gap-1 cursor-pointer min-w-[44px]"
                >
                  <TopUpWithdrawIconBadge
                    icon={<ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />}
                    shape="circle"
                    size="sm"
                  />
                  <span className="text-[10px] font-medium text-[#141412] dark:text-[#E6E4DD]">
                    Spend
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddGoal('Transfer', 'Credit Card Bill Payment')}
                  className="flex flex-col items-center gap-1 cursor-pointer min-w-[44px]"
                >
                  <TopUpWithdrawIconBadge
                    icon={<ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />}
                    shape="circle"
                    size="sm"
                  />
                  <span className="text-[10px] font-medium text-[#141412] dark:text-[#E6E4DD]">
                    Pay Bill
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Linked Payment Cards & Modes Breakdown */}
        <div className="lg:col-span-7 bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] flex flex-col justify-between transition-colors shadow-2xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
                Interactive Card Selector
              </p>
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
                Linked Payment Cards & Modes
              </h3>
              <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
                Select any card below to focus it in the swipeable deck
              </p>
            </div>
            <div className="flex flex-col min-[380px]:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setAddCardError(null);
                  setIsAddCardOpen(true);
                }}
                className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                <span>New Card</span>
              </button>
              {onOpenAddGoal && (
                <button
                  type="button"
                  onClick={() => onOpenAddGoal('Transfer', 'Credit Card Bill Payment')}
                  className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-xs font-semibold text-[#F6F5F0] dark:text-[#111110] flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
                >
                  Card Bill Payment
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cardPaymentSummary.map((card) => {
              const matchingDeckIdx = vaultCards.findIndex(
                (vc) => vc.name.toLowerCase() === card.name.toLowerCase()
              );
              const isFocusedInDeck = matchingDeckIdx >= 0 && matchingDeckIdx === safeActiveIndex;

              return (
                <button
                  key={card.name}
                  type="button"
                  onClick={() => {
                    if (matchingDeckIdx >= 0) {
                      handleSelectCardIndex(matchingDeckIdx);
                    } else {
                      const updated = addCustomVaultCard({
                        name: card.name,
                        last4: String(1000 + ((card.name.length * 731) % 8999)),
                        prefix4: '4532',
                        expiry: '10/29',
                        network: 'VISA',
                        tier: 'Platinum',
                        theme: 'navy',
                      });
                      setVaultCards(updated);
                      setSwipeDirection(1);
                      setActiveCardIndex(updated.length - 1);
                    }
                  }}
                  className={`p-3.5 rounded-2xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                    isFocusedInDeck
                      ? 'bg-[#F6F5F0] dark:bg-[#22211D] border-[#C5A059] ring-1 ring-[#C5A059]/40 shadow-2xs'
                      : 'bg-[#F6F5F0]/60 dark:bg-[#1C1C19] border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isFocusedInDeck
                          ? 'bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110]'
                          : 'bg-[#E5E0D4] dark:bg-[#282622] text-[#141412] dark:text-[#F6F5F0]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] truncate">
                        {card.name}
                      </div>
                      <div className="text-[11px] text-[#78746B] dark:text-[#9E9B92] tabular-nums">
                        {card.count} {card.count === 1 ? 'transaction' : 'transactions'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] tabular-nums">
                      {displayAmount(card.spent)}
                    </div>
                    <div className="text-[10px] text-[#8E7952] dark:text-[#C5A059]">
                      {isFocusedInDeck ? 'Active on Deck' : 'Spent'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add New Card Modal */}
      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div
            id="add-vault-card-modal"
            className="bg-white dark:bg-[#161614] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setIsAddCardOpen(false)}
              className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-[#F6F5F0] dark:bg-[#22211D] text-[#78746B] hover:text-[#141412] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-[#8E7952] dark:text-[#C5A059] pr-8">
              Private Vault Configuration
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] mt-0.5 mb-4 pr-8">
              Add Card to Swipe Deck
            </h3>

            {addCardError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {addCardError}
              </div>
            )}

            <form onSubmit={handleAddCardSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                  Card or Bank Name
                </label>
                <input
                  type="text"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder="e.g., Axis Magnus, Amex Platinum, ICICI Sapphiro"
                  className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newCardLast4}
                    onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, ''))}
                    placeholder="8842"
                    className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium tabular-nums text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Valid Thru (MM/YY)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={newCardExpiry}
                    onChange={(e) => setNewCardExpiry(e.target.value)}
                    placeholder="12/29"
                    className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium tabular-nums text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Card Network
                  </label>
                  <select
                    value={newCardNetwork}
                    onChange={(e) => setNewCardNetwork(e.target.value as CardNetwork)}
                    className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
                  >
                    <option value="VISA">VISA</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="RuPay">RuPay</option>
                    <option value="AMEX">AMEX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Card Tier
                  </label>
                  <input
                    type="text"
                    value={newCardTier}
                    onChange={(e) => setNewCardTier(e.target.value)}
                    placeholder="Signature / Infinite"
                    className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5">
                  Card Finish
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: 'obsidian', label: 'Obsidian', swatch: 'bg-[#191917]' },
                      { id: 'champagne', label: 'Gold', swatch: 'bg-[#C5A059]' },
                      { id: 'navy', label: 'Navy', swatch: 'bg-[#1E293B]' },
                      { id: 'espresso', label: 'Espresso', swatch: 'bg-[#3B2A22]' },
                      { id: 'platinum', label: 'Platinum', swatch: 'bg-[#CFCBC2]' },
                    ] as const
                  ).map((finish) => (
                    <button
                      key={finish.id}
                      type="button"
                      onClick={() => setNewCardTheme(finish.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-medium transition-all cursor-pointer ${
                        newCardTheme === finish.id
                          ? 'border-[#C5A059] bg-[#F6F5F0] dark:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0]'
                          : 'border-[#E5E0D4] dark:border-[#282622] text-[#78746B] dark:text-[#9E9B92]'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full ${finish.swatch} border border-white/20`} />
                      <span>{finish.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCardOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] hover:text-[#141412] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold transition-all cursor-pointer"
                >
                  Save Card to Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Header with Timeframe Switcher & PIN Security Lock */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Goals & Reserves
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Target progress tracking for savings, emergency fund, lent & borrowed
            </p>
          </div>
        </div>

        {/* Timeframe Selector & Mode Sub-navigators */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 pt-0.5 lg:pt-0 w-full lg:w-auto">
          {/* Mode Segmented Control: Month | Year | All-Time */}
          <div className="grid grid-cols-3 sm:flex bg-[#F0EDE5] dark:bg-[#22211D] p-1 rounded-xl text-xs font-medium w-full sm:w-auto">
            <button
              type="button"
              id="btn-goals-timeframe-month"
              onClick={() => setTimeframe('month')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                timeframe === 'month'
                  ? 'bg-white dark:bg-[#141412] shadow-2xs text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              id="btn-goals-timeframe-year"
              onClick={() => setTimeframe('year')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                timeframe === 'year'
                  ? 'bg-white dark:bg-[#141412] shadow-2xs text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              Year
            </button>
            <button
              type="button"
              id="btn-goals-timeframe-alltime"
              onClick={() => setTimeframe('alltime')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                timeframe === 'alltime'
                  ? 'bg-white dark:bg-[#141412] shadow-2xs text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              All-Time
            </button>
          </div>

          {/* Sub-Navigator when in Month mode */}
          {timeframe === 'month' && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 px-2 min-w-[90px] text-center">
                {formatMonthYear(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Sub-Navigator when in Year mode */}
          {timeframe === 'year' && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevYear}
                title="Previous Year"
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 px-2 min-w-[50px] text-center">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={handleNextYear}
                title="Next Year"
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Summary Metric Cards: Savings Target, Emergency Fund Target, Lent, Borrowed, Capital Preserved */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Savings & Investments Target */}
        <div
          id="card-goals-savings"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Savings
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight font-mono">
                {displayAmount(goalsStats.savings)}
              </div>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shrink-0">
                {savingsProgress.percentage}%
              </span>
            </div>

            {/* Target Progress Bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                style={{ width: `${savingsProgress.cappedPercentage}%` }}
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <span className="truncate">Target: {isUnlocked ? formatINR(savingsTargetVal) : '••••••'}</span>
            </div>
          </div>
        </div>

        {/* 2. Emergency Fund Target */}
        <div
          id="card-goals-emergency"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-amber-300 dark:hover:border-amber-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Emergency Fund
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight font-mono">
                {displayAmount(goalsStats.emergencyFund)}
              </div>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shrink-0">
                {emergencyProgress.percentage}%
              </span>
            </div>

            {/* Target Progress Bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                style={{ width: `${emergencyProgress.cappedPercentage}%` }}
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <span className="truncate">Target: {isUnlocked ? formatINR(emergencyTargetVal) : '••••••'}</span>
            </div>
          </div>
        </div>

        {/* 3. LENT (Receivables) - Clean, prominent, standalone */}
        <div
          id="card-goals-lent"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lent (Receivable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight font-mono">
              {displayAmount(goalsStats.lent)}
            </div>

            {/* Visual Accent */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                style={{ width: goalsStats.lent > 0 ? '100%' : '0%' }}
                className="bg-purple-500 h-full rounded-full transition-all duration-500"
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-2 truncate">
              Money given to others / to collect
            </p>
          </div>
        </div>

        {/* 4. BORROWED (Payables) - Clean, prominent, standalone */}
        <div
          id="card-goals-borrowed"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-rose-300 dark:hover:border-rose-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Borrowed (Payable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight font-mono">
              {displayAmount(goalsStats.borrowed)}
            </div>

            {/* Visual Accent */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                style={{ width: goalsStats.borrowed > 0 ? '100%' : '0%' }}
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-2 truncate">
              Money taken / to repay
            </p>
          </div>
        </div>

        {/* 5. Total Capital Preserved - Shows percentage calculated from progress toward combined Savings + Emergency Fund targets */}
        <div
          id="card-goals-total-allocated"
          className="col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-1 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Capital Preserved
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight font-mono">
                {displayAmount(capitalPreservedProgress.combinedAchieved)}
              </div>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shrink-0">
                {capitalPreservedProgress.percentage}%
              </span>
            </div>

            {/* Combined Target Progress Bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
              <div
                style={{ width: `${capitalPreservedProgress.cappedPercentage}%` }}
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <span className="truncate">Combined: {isUnlocked ? formatINR(capitalPreservedProgress.combinedTarget) : '••••••'}</span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 ml-1">
                Savings + Emergency
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Visual Allocation Ratio & Progress Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Reserves Growth vs Financial Targets
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Savings: {savingsProgress.percentage}% {isUnlocked ? `of ${formatINR(savingsTargetVal)}` : 'of ••••••'}
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Emergency: {emergencyProgress.percentage}% {isUnlocked ? `of ${formatINR(emergencyTargetVal)}` : 'of ••••••'}
            </span>
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Savings bar */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">Savings Target Fulfillment</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400">{savingsProgress.percentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                style={{ width: `${savingsProgress.cappedPercentage}%` }}
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
              <span>{isUnlocked ? `${formatINR(goalsStats.savings)} achieved` : '•••••• achieved'}</span>
              <span>{isUnlocked ? `${formatINR(savingsProgress.remaining)} remaining` : 'Target: ••••••'}</span>
            </div>
          </div>

          {/* Emergency Fund bar */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">Emergency Fund Fulfillment</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">{emergencyProgress.percentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                style={{ width: `${emergencyProgress.cappedPercentage}%` }}
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
              <span>{isUnlocked ? `${formatINR(goalsStats.emergencyFund)} achieved` : '•••••• achieved'}</span>
              <span>{isUnlocked ? `${formatINR(emergencyProgress.remaining)} remaining` : 'Target: ••••••'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Goals Activity Table & List */}
      <div
        id="goals-activity-card"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col transition-colors"
      >
        {/* Header & Controls */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Goals Activity Log
            </h3>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              ({filteredGoalsTransactions.length} entries in{' '}
              {timeframe === 'month'
                ? formatMonthYear(selectedMonth)
                : timeframe === 'year'
                ? selectedYear
                : 'All-Time'}
              )
            </span>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Bulk Delete Selected Button */}
            {selectedCount > 0 && (
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <button
                  type="button"
                  id="btn-goals-delete-selected"
                  onClick={handleTriggerBulkDelete}
                  className="min-h-[40px] py-1.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                  <span>Delete Selected ({selectedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="min-h-[40px] py-1.5 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative flex-1 sm:w-48 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                id="goals-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search category, note..."
                className="w-full min-h-[40px] pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            {/* Type Filter (Supports ALL, Savings, Emergency Fund, Lent, Borrowed) */}
            <select
              id="goals-filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full sm:w-auto min-h-[40px] py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="ALL">All Reserves & Goals</option>
              <option value="Savings">Savings Only</option>
              <option value="Emergency Fund">Emergency Fund Only</option>
              <option value="Lent">Lent (Receivables)</option>
              <option value="Borrowed">Borrowed (Payables)</option>
              <option value="Lent & Borrowed">All Lent & Borrowed</option>
            </select>

            {/* Quick Add Goal Trigger */}
            {onOpenAddGoal && (
              <button
                type="button"
                id="btn-goals-add-entry"
                onClick={() => onOpenAddGoal('Savings')}
                className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Add Goal Entry</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Select All Bar */}
        {filteredGoalsTransactions.length > 0 && (
          <div className="md:hidden px-4 py-2 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Select All ({filteredGoalsTransactions.length})</span>
            </label>

            {selectedCount > 0 && (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {selectedCount} selected
              </span>
            )}
          </div>
        )}

        {/* Table Content */}
        {filteredGoalsTransactions.length === 0 ? (
          <div
            id="empty-goals-transactions"
            className="py-12 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 p-6"
          >
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-500 mb-3">
              <PiggyBank className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">No goals activity found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {timeframe === 'month'
                ? `No savings, emergency fund, or lent/borrowed transactions for ${formatMonthYear(
                    selectedMonth
                  )}.`
                : timeframe === 'year'
                ? `No savings or goals entries recorded for year ${selectedYear}.`
                : 'Start recording your savings, investments, and emergency reserves to track your progress.'}
            </p>
            {onOpenAddGoal && (
              <button
                type="button"
                onClick={() => onOpenAddGoal('Savings')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Savings</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-xs">
                  <tr className="text-slate-400 dark:text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="w-10 px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={isAllSelected ? 'Deselect all' : 'Select all'}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Description / Note</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                      <th className="px-4 py-3 text-center font-semibold">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {filteredGoalsTransactions.map((tx) => {
                    const style = getTypeStyle(tx);
                    const isSelected = tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

                    return (
                      <tr
                        key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="w-10 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (tx.rowIndex !== undefined) {
                                handleToggleSelectRow(tx.rowIndex);
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{tx.category}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${style.badgeBg}`}
                          >
                            {style.icon}
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 italic text-slate-400 dark:text-slate-500 text-[11px] max-w-xs truncate">
                          {tx.description || <span className="not-italic text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className={`px-5 py-3 text-right font-bold text-xs ${style.textColor} whitespace-nowrap font-mono`}>
                          {displayAmount(tx.amount)}
                        </td>
                        {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              title="Delete entry from Google Sheet"
                              onClick={() => handleTriggerSingleDelete(tx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredGoalsTransactions.map((tx) => {
                const style = getTypeStyle(tx);
                const isSelected = tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

                return (
                  <div
                    key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                    className={`p-3.5 flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (tx.rowIndex !== undefined) {
                            handleToggleSelectRow(tx.rowIndex);
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${style.badgeBg}`}
                        >
                          {style.icon}
                          {style.label}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {tx.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-2">
                        <span>{formatDate(tx.date)}</span>
                        {tx.description && (
                          <>
                            <span>•</span>
                            <span className="truncate italic">{tx.description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-sm font-extrabold ${style.textColor} font-mono`}>
                        {displayAmount(tx.amount)}
                      </div>

                      {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                        <button
                          type="button"
                          onClick={() => handleTriggerSingleDelete(tx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Single / Bulk Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={pendingDeleteIndices !== null && pendingDeleteIndices.length > 0}
        title={
          pendingDeleteIndices && pendingDeleteIndices.length > 1
            ? `Delete ${pendingDeleteIndices.length} Goal Entries?`
            : 'Delete Goal Entry?'
        }
        message={
          pendingDeleteTx
            ? `Are you sure you want to permanently delete the entry "${pendingDeleteTx.category}" of ${formatINR(
                pendingDeleteTx.amount
              )}? This will delete row ${pendingDeleteTx.rowIndex} from your Google Sheet.`
            : `Are you sure you want to permanently delete ${
                pendingDeleteIndices?.length || 0
              } selected entries from your Google Sheet?`
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setPendingDeleteIndices(null);
          setPendingDeleteTx(null);
        }}
      />
    </div>
  );
};
