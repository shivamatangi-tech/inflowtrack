/**
 * ============================================================================
 * File: src/components/RecentActivity.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Interactive Transactions ledger styled after the Aurora neobank reference
 *   image: rounded-[28px] white surface card, soft stone icon badges (#F4F3EF),
 *   Poppins typography, category & search filters, bulk actions, CSV export,
 *   inline record editing, and recurring transaction management.
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShieldCheck,
  ArrowLeftRight,
  Search,
  Plus,
  Trash2,
  Receipt,
  CheckSquare,
  Square,
  MinusSquare,
  Edit2,
  Download,
  Filter,
  Repeat,
  X,
  AlertCircle,
} from 'lucide-react';
import { Transaction, TransactionType, CategoryData } from '../types';
import {
  formatINR,
  formatDateToDDMMYYYY,
} from '../utils/formatters';
import { ConfirmationDialog } from './ConfirmationDialog';
import { EditTransactionModal } from './EditTransactionModal';
import { RecurringModal } from './RecurringModal';

interface RecentActivityProps {
  transactions: Transaction[];
  categories?: CategoryData;
  selectedMonth?: string;
  onAddNewClick?: () => void;
  onDeleteTransaction?: (rowIndex: number) => Promise<void>;
  onDeleteTransactionsBatch?: (rowIndices: number[]) => Promise<void>;
  onUpdateTransaction?: (
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
  ) => Promise<void>;
  onApplyRecurring?: (tx: {
    date: string;
    time?: string;
    type: TransactionType;
    category: string;
    subcategory?: string;
    amount: number;
    paymentMode?: string;
    accountWallet?: string;
    description: string;
  }) => Promise<void>;
  onDownloadSheet?: () => Promise<void>;
  isDownloadingSheet?: boolean;
  sheetUrl?: string;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  transactions,
  categories = {
    incomeCategories: [],
    expenseCategories: [],
    savingsCategories: [],
    emergencyFundCategories: [],
    lentBorrowedCategories: [],
  },
  selectedMonth,
  onAddNewClick,
  onDeleteTransaction,
  onDeleteTransactionsBatch,
  onUpdateTransaction,
  onApplyRecurring,
  onDownloadSheet,
  isDownloadingSheet = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modal states
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isRecurringOpen, setIsRecurringOpen] = useState<boolean>(false);

  // Selected row indices for bulk deletion
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Dialog state for single and bulk deletion
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<number[] | null>(null);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Month-filtered transactions
  const scopedTransactions = useMemo(() => {
    if (selectedMonth) {
      return transactions.filter((tx) => tx.date && tx.date.startsWith(selectedMonth));
    }
    return transactions;
  }, [transactions, selectedMonth]);

  // Available categories for the category filter dropdown
  const availableFilterCategories = useMemo(() => {
    const set = new Set<string>();
    scopedTransactions.forEach((tx) => {
      if (tx.category) set.add(tx.category);
    });
    return Array.from(set).sort();
  }, [scopedTransactions]);

  // Final filtered transactions (Search + Category Filter)
  const filteredTransactions = useMemo(() => {
    return scopedTransactions.filter((tx) => {
      const matchesCategory =
        selectedCategoryFilter === 'ALL' || tx.category === selectedCategoryFilter;

      const q = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        tx.category.toLowerCase().includes(q) ||
        (tx.subcategory || '').toLowerCase().includes(q) ||
        (tx.paymentMode || '').toLowerCase().includes(q) ||
        (tx.accountWallet || '').toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        tx.amount.toString().includes(searchTerm) ||
        tx.date.includes(searchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [scopedTransactions, selectedCategoryFilter, searchTerm]);

  // Valid row indices in current filtered view
  const currentFilteredIndices = useMemo(() => {
    return filteredTransactions
      .map((tx) => tx.rowIndex)
      .filter((idx): idx is number => typeof idx === 'number');
  }, [filteredTransactions]);

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

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (!pendingDeleteIndices || pendingDeleteIndices.length === 0) return;

    setIsDeleting(true);
    setActionError(null);
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
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete transaction from Google Sheets.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export filtered transactions to CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = [
      'Transaction ID',
      'Date (DD-MM-YYYY)',
      'Time',
      'Type',
      'Category',
      'Subcategory',
      'Amount (INR)',
      'Payment Method',
      'Account / Wallet',
      'Description / Notes',
      'Row Index',
    ];
    const rows = filteredTransactions.map((tx) => [
      `"${(tx.transactionId || tx.id || '').replace(/"/g, '""')}"`,
      `"${formatDateToDDMMYYYY(tx.date)}"`,
      `"${(tx.time || '').replace(/"/g, '""')}"`,
      `"${tx.type}"`,
      `"${tx.category.replace(/"/g, '""')}"`,
      `"${(tx.subcategory || '').replace(/"/g, '""')}"`,
      tx.amount,
      `"${(tx.paymentMode || '').replace(/"/g, '""')}"`,
      `"${(tx.accountWallet || '').replace(/"/g, '""')}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.rowIndex || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `inflotrack_Transactions_${
      selectedMonth ? selectedMonth : 'all'
    }.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTypeStyle = (type: TransactionType) => {
    switch (type) {
      case 'Income':
        return {
          textColor: 'text-[#4A5240] dark:text-[#A3B18A]',
          amountColor: 'text-[#4A5240] dark:text-[#A3B18A]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#4A5240] dark:text-[#A3B18A]',
          sign: '+',
          icon: <TrendingUp className="w-4 h-4" />,
        };
      case 'Expense':
        return {
          textColor: 'text-[#8C7355] dark:text-[#D4A373]',
          amountColor: 'text-[#181816] dark:text-[#F4F3EF]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#181816] dark:text-[#F4F3EF]',
          sign: '−',
          icon: <TrendingDown className="w-4 h-4" />,
        };
      case 'Transfer':
        return {
          textColor: 'text-[#7A8270] dark:text-[#9CA38F]',
          amountColor: 'text-[#181816] dark:text-[#F4F3EF]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#7A8270] dark:text-[#9CA38F]',
          sign: '⇄',
          icon: <ArrowLeftRight className="w-4 h-4" />,
        };
      case 'Savings':
        return {
          textColor: 'text-[#4A5240] dark:text-[#A3B18A]',
          amountColor: 'text-[#4A5240] dark:text-[#A3B18A]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#4A5240] dark:text-[#A3B18A]',
          sign: '•',
          icon: <PiggyBank className="w-4 h-4" />,
        };
      case 'Emergency Fund':
        return {
          textColor: 'text-[#8C7355] dark:text-[#D4A373]',
          amountColor: 'text-[#8C7355] dark:text-[#D4A373]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#8C7355] dark:text-[#D4A373]',
          sign: '•',
          icon: <ShieldCheck className="w-4 h-4" />,
        };
      case 'Lent':
      case 'Borrowed':
      case 'Lent & Borrowed':
        return {
          textColor: 'text-[#6E5648] dark:text-[#C9ADA7]',
          amountColor: 'text-[#6E5648] dark:text-[#C9ADA7]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#6E5648] dark:text-[#C9ADA7]',
          sign: '⇄',
          icon: <ArrowLeftRight className="w-4 h-4" />,
        };
      default:
        return {
          textColor: 'text-[#78756E] dark:text-[#9C9990]',
          amountColor: 'text-[#181816] dark:text-[#F4F3EF]',
          iconBg: 'bg-[#F4F3EF] dark:bg-[#22221F] text-[#78756E]',
          sign: '',
          icon: <Receipt className="w-4 h-4" />,
        };
    }
  };

  const selectedCount = selectedRowIndices.size;

  return (
    <div
      id="recent-activity-card"
      className="bg-white dark:bg-[#181816] rounded-[28px] border border-[#E2DFD9] dark:border-[#2A2A27] overflow-hidden flex flex-col transition-colors shadow-xs"
    >
      {/* 1. Header with "Transactions" Title and Responsive Action Buttons */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#EFECE6] dark:border-[#22221F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#181816] dark:text-[#F4F3EF] tracking-tight">
            Transactions
          </h3>
          <span className="text-xs font-medium text-[#8C8980] dark:text-[#78756E] tabular-nums">
            {scopedTransactions.length} {scopedTransactions.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Quick Action Tools: Responsive stack/grid on small mobile, row on tablet/desktop */}
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          {onApplyRecurring && (
            <button
              type="button"
              id="btn-recurring-manager"
              onClick={() => setIsRecurringOpen(true)}
              className="min-h-[42px] py-2 px-3.5 bg-[#F4F3EF] dark:bg-[#22221F] hover:bg-[#E5E2DC] dark:hover:bg-[#2C2C28] rounded-xl text-xs font-medium text-[#181816] dark:text-[#F4F3EF] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Repeat className="w-3.5 h-3.5 text-[#78756E] shrink-0" />
              <span>Recurring</span>
            </button>
          )}

          <button
            type="button"
            id="btn-download-sheet"
            onClick={() => {
              if (onDownloadSheet) {
                void onDownloadSheet();
              } else {
                handleExportCSV();
              }
            }}
            disabled={isDownloadingSheet}
            title="Store in Google Drive folder (1WTHHDzwzO79ypcP06ZmDkBuDADosnH30) and download inflowtrack sheet"
            className="min-h-[42px] py-2 px-4 bg-[#181816] hover:bg-[#2A2A26] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-white dark:text-[#111110] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{isDownloadingSheet ? 'Exporting...' : 'Download Sheet'}</span>
          </button>

          <button
            type="button"
            id="btn-export-csv"
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            title="Download filtered view as CSV"
            className="min-h-[42px] min-[380px]:col-span-2 sm:col-span-1 py-2 px-3.5 bg-[#F4F3EF] dark:bg-[#22221F] hover:bg-[#E5E2DC] dark:hover:bg-[#2C2C28] rounded-xl text-xs font-medium text-[#181816] dark:text-[#F4F3EF] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#78756E] shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="px-4 sm:px-5 py-2.5 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 text-xs font-medium text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className=" break-words">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Search, Category Filter, and Selection Bar */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-[#EFECE6] dark:border-[#22221F] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0 w-full">
          {/* Search box */}
          <div className="relative flex-1 sm:max-w-sm min-w-0">
            <Search className="w-4 h-4 text-[#8C8980] absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              id="recent-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search category, description, or wallet..."
              className="w-full min-h-[42px] pl-9 pr-8 py-2 bg-[#F4F3EF] dark:bg-[#22221F] border border-[#E2DFD9] dark:border-[#2E2E2A] rounded-xl text-xs text-[#181816] dark:text-[#F4F3EF] placeholder-[#8C8980] focus:outline-none focus:border-[#C5A059] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                id="btn-clear-search"
                onClick={() => setSearchTerm('')}
                title="Clear search"
                className="absolute right-2.5 top-2.5 p-1 text-[#8C8980] hover:text-[#181816] dark:hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-[#8C8980] shrink-0 hidden sm:inline" />
            <select
              id="recent-category-filter"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full sm:w-auto min-h-[42px] py-2 px-3.5 bg-[#F4F3EF] dark:bg-[#22221F] border border-[#E2DFD9] dark:border-[#2E2E2A] rounded-xl text-xs font-medium text-[#181816] dark:text-[#F4F3EF] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {availableFilterCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Match Indicator */}
          {(searchTerm || selectedCategoryFilter !== 'ALL') && (
            <span className="text-[11px] font-medium text-[#4A5240] dark:text-[#A3B18A] px-1">
              {filteredTransactions.length} of {scopedTransactions.length}{' '}
              {filteredTransactions.length === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>

        {/* Bulk Action Controls */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0">
            <button
              type="button"
              id="btn-delete-selected-transactions"
              onClick={handleTriggerBulkDelete}
              className="min-h-[40px] py-1.5 px-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-medium rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Delete Selected ({selectedCount})</span>
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="min-h-[40px] py-1.5 px-2.5 text-xs font-medium text-[#78756E] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Mobile Select All Bar */}
      {filteredTransactions.length > 0 && (
        <div className="md:hidden px-5 py-2.5 bg-[#FAF9F6] dark:bg-[#1E1E1B] border-b border-[#EFECE6] dark:border-[#22221F] flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-[#181816] dark:text-[#F4F3EF] cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 accent-[#181816] rounded border-[#D5D2CA] cursor-pointer"
            />
            <span>Select All ({filteredTransactions.length})</span>
          </label>

          {selectedCount > 0 && (
            <span className="text-[11px] font-semibold text-[#4A5240] dark:text-[#A3B18A]">
              {selectedCount} selected
            </span>
          )}
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 ? (
        <div
          id="empty-transactions-container"
          className="py-14 flex flex-col items-center justify-center text-center p-6"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F4F3EF] dark:bg-[#22221F] flex items-center justify-center text-[#78756E] mb-3">
            <Receipt className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-[#181816] dark:text-[#F4F3EF]">
            No transactions yet
          </h4>
          <p className="text-xs text-[#78756E] dark:text-[#9C9990] mt-1 max-w-sm">
            Your inflowtrack sheet is connected. Add your first transaction or configure recurring items.
          </p>
          {onAddNewClick && (
            <button
              type="button"
              id="btn-empty-add-transaction"
              onClick={onAddNewClick}
              className="mt-4 px-5 py-2.5 bg-[#181816] hover:bg-[#2A2A26] dark:bg-[#F4F3EF] text-white dark:text-[#181816] text-xs font-medium rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          )}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center p-6">
          <div className="w-11 h-11 rounded-2xl bg-[#F4F3EF] dark:bg-[#22221F] flex items-center justify-center text-[#78756E] mb-2.5">
            <Search className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#181816] dark:text-[#F4F3EF]">
            No transactions match "{searchTerm || selectedCategoryFilter}"
          </p>
          <p className="text-[11px] text-[#8C8980] mt-0.5">
            Try adjusting your search terms or category filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategoryFilter('ALL');
            }}
            className="mt-3 px-4 py-1.5 bg-[#F4F3EF] dark:bg-[#22221F] hover:bg-[#E5E2DC] text-[#181816] dark:text-[#F4F3EF] text-xs font-medium rounded-full transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAF9F6] dark:bg-[#1E1E1B] border-b border-[#EFECE6] dark:border-[#22221F]">
                <tr className="text-[#8C8980] dark:text-[#78756E] uppercase font-medium text-[10px] tracking-wider">
                  <th className="w-10 px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      title={isAllSelected ? 'Deselect all' : 'Select all'}
                      className="p-1 text-[#8C8980] hover:text-[#181816] dark:hover:text-white rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#181816] dark:text-[#F4F3EF]" />
                      ) : isSomeSelected ? (
                        <MinusSquare className="w-4 h-4 text-[#181816] dark:text-[#F4F3EF]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 font-medium">Transaction</th>
                  <th className="px-4 py-3.5 font-medium">Date & Time</th>
                  <th className="px-4 py-3.5 font-medium">Type</th>
                  <th className="px-4 py-3.5 font-medium">Payment / Account</th>
                  <th className="px-4 py-3.5 font-medium">Notes</th>
                  <th className="px-5 py-3.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-3.5 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EFE9] dark:divide-[#22221F]">
                {filteredTransactions.map((tx) => {
                  const style = getTypeStyle(tx.type);
                  const isSelected =
                    tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

                  return (
                    <tr
                      key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                      className={`transition-colors group ${
                        isSelected
                          ? 'bg-[#F4F3EF] dark:bg-[#262622]'
                          : 'hover:bg-[#FAF9F6] dark:hover:bg-[#1E1E1B]'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (tx.rowIndex !== undefined) {
                              handleToggleSelectRow(tx.rowIndex);
                            }
                          }}
                          className="w-4 h-4 accent-[#181816] rounded border-[#D5D2CA] cursor-pointer"
                        />
                      </td>

                      {/* Category with rounded stone icon badge */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${style.iconBg}`}
                          >
                            {style.icon}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-[#181816] dark:text-[#F4F3EF]">
                              {tx.category}
                            </div>
                            {tx.subcategory && (
                              <div className="text-[11px] text-[#8C8980]">
                                {tx.subcategory}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-[#78756E] whitespace-nowrap">
                        <div className="font-medium tabular-nums text-xs text-[#181816] dark:text-[#E5E2DC]">
                          {formatDateToDDMMYYYY(tx.date)}
                        </div>
                        {tx.time && (
                          <div className="text-[10px] tabular-nums text-[#8C8980]">
                            {tx.time}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-xs font-medium ${style.textColor}`}>
                          {tx.type}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-[#78756E] text-xs whitespace-nowrap">
                        {tx.paymentMode || tx.accountWallet ? (
                          <div className="flex items-center gap-1.5">
                            {tx.paymentMode && (
                              <span className="font-medium text-[#181816] dark:text-[#E5E2DC]">
                                {tx.paymentMode}
                              </span>
                            )}
                            {tx.paymentMode && tx.accountWallet && (
                              <span className="text-[#C5C2B8]" aria-hidden="true">
                                ·
                              </span>
                            )}
                            {tx.accountWallet && (
                              <span className="text-[#8C8980]">{tx.accountWallet}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#C5C2B8]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-[#78756E] text-xs max-w-xs truncate">
                        {tx.description || <span className="text-[#C5C2B8]">—</span>}
                      </td>

                      <td
                        className={`px-5 py-3.5 text-right tabular-nums font-semibold text-sm ${style.amountColor} whitespace-nowrap`}
                      >
                        {style.sign}
                        {formatINR(tx.amount)}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title="Modify Google Sheet record"
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1.5 text-[#8C8980] hover:text-[#181816] dark:hover:text-white hover:bg-[#F4F3EF] dark:hover:bg-[#2A2A26] rounded-full transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                            <button
                              type="button"
                              title="Delete transaction from Google Sheet"
                              onClick={() => handleTriggerSingleDelete(tx)}
                              className="p-1.5 text-[#8C8980] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-full transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List View optimized for 320px -> 414px screens */}
          <div className="md:hidden divide-y divide-[#F2EFE9] dark:divide-[#22221F]">
            {filteredTransactions.map((tx) => {
              const style = getTypeStyle(tx.type);
              const isSelected =
                tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

              return (
                <div
                  key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                  className={`px-3.5 sm:px-4 py-3.5 flex items-center justify-between gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-[#F4F3EF] dark:bg-[#262622]'
                      : 'hover:bg-[#FAF9F6] dark:hover:bg-[#1E1E1B]'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (tx.rowIndex !== undefined) {
                          handleToggleSelectRow(tx.rowIndex);
                        }
                      }}
                      className="w-4 h-4 accent-[#181816] rounded border-[#D5D2CA] cursor-pointer"
                    />
                  </div>

                  {/* Stone Icon Badge */}
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}
                  >
                    {style.icon}
                  </div>

                  {/* Transaction Details */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs sm:text-sm text-[#181816] dark:text-[#F4F3EF] truncate">
                      {tx.category}
                      {tx.subcategory ? ` · ${tx.subcategory}` : ''}
                    </div>
                    <div className="text-[11px] text-[#8C8980] truncate mt-0.5">
                      {tx.description ||
                        [tx.paymentMode, tx.accountWallet].filter(Boolean).join(' · ') ||
                        tx.type}
                    </div>
                    <div className="text-[10px] text-[#A3A096] tabular-nums mt-0.5">
                      {formatDateToDDMMYYYY(tx.date)}
                      {tx.time ? `, ${tx.time}` : ''}
                    </div>
                  </div>

                  {/* Right Amount + Actions */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div
                      className={`tabular-nums font-semibold text-xs sm:text-sm text-right whitespace-nowrap ${style.amountColor}`}
                    >
                      {style.sign}
                      {formatINR(tx.amount)}
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingTransaction(tx)}
                        title="Modify Record"
                        className="p-1.5 text-[#8C8980] hover:text-[#181816] dark:hover:text-white rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                        <button
                          type="button"
                          onClick={() => handleTriggerSingleDelete(tx)}
                          title="Delete Record"
                          className="p-1.5 text-[#8C8980] hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && onUpdateTransaction && (
        <EditTransactionModal
          isOpen={true}
          transaction={editingTransaction}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onSave={async (rowIndex, updatedData) => {
            await onUpdateTransaction(rowIndex, updatedData);
          }}
          onDelete={onDeleteTransaction}
        />
      )}

      {/* Recurring Transactions Modal */}
      {isRecurringOpen && onApplyRecurring && (
        <RecurringModal
          isOpen={true}
          onClose={() => setIsRecurringOpen(false)}
          categories={categories}
          onApplyRecurring={onApplyRecurring}
          currentMonthKey={selectedMonth || ''}
        />
      )}

      {/* Confirmation Dialog for Deleting Transactions from Google Sheet */}
      <ConfirmationDialog
        isOpen={pendingDeleteIndices !== null && pendingDeleteIndices.length > 0}
        title={
          pendingDeleteIndices && pendingDeleteIndices.length > 1
            ? `Delete ${pendingDeleteIndices.length} Transactions?`
            : 'Delete Transaction?'
        }
        message={
          pendingDeleteIndices && pendingDeleteIndices.length > 1
            ? `Are you sure you want to permanently delete the ${pendingDeleteIndices.length} selected transactions from your Google Sheet? This updates your spreadsheet immediately.`
            : pendingDeleteTx
            ? `Are you sure you want to remove row #${pendingDeleteTx.rowIndex} (${pendingDeleteTx.category} - ${formatINR(
                pendingDeleteTx.amount || 0
              )}) from your Google Sheet?`
            : `Are you sure you want to delete the selected transaction from your Google Sheet?`
        }
        confirmLabel={
          pendingDeleteIndices && pendingDeleteIndices.length > 1
            ? `Delete ${pendingDeleteIndices.length} from Sheet`
            : 'Delete from Sheet'
        }
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setPendingDeleteIndices(null);
          setPendingDeleteTx(null);
        }}
      />
    </div>
  );
};
