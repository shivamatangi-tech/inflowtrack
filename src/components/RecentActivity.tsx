/**
 * ============================================================================
 * File: src/components/RecentActivity.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Interactive Transactions table (Desktop) and card list (Mobile) with
 *   search, category filtering, bulk selection/deletion, CSV export,
 *   inline record editing, and recurring transaction management.
 *
 * Key Responsibilities:
 *   1. Scopes transactions to the selected dashboard month and filters by
 *      search query or category.
 *   2. Provides single and bulk deletion of rows from Google Sheets with a
 *      confirmation dialog.
 *   3. Opens `<EditTransactionModal />` to modify any Google Sheet row and
 *      `<RecurringModal />` to manage monthly recurring templates.
 *   4. Exports filtered records to a downloadable `.csv` file.
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
          textColor: 'text-emerald-600 dark:text-emerald-400',
          badgeBg:
            'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          sign: '+',
          icon: <TrendingUp className="w-3 h-3" />,
        };
      case 'Expense':
        return {
          textColor: 'text-rose-600 dark:text-rose-400',
          badgeBg:
            'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          sign: '−',
          icon: <TrendingDown className="w-3 h-3" />,
        };
      case 'Transfer':
        return {
          textColor: 'text-indigo-600 dark:text-indigo-400',
          badgeBg:
            'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          sign: '⇄',
          icon: <ArrowLeftRight className="w-3 h-3" />,
        };
      case 'Savings':
        return {
          textColor: 'text-blue-600 dark:text-blue-400',
          badgeBg:
            'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          sign: '•',
          icon: <PiggyBank className="w-3 h-3" />,
        };
      case 'Emergency Fund':
        return {
          textColor: 'text-amber-600 dark:text-amber-400',
          badgeBg:
            'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          sign: '•',
          icon: <ShieldCheck className="w-3 h-3" />,
        };
      case 'Lent':
      case 'Borrowed':
      case 'Lent & Borrowed':
        return {
          textColor: 'text-purple-600 dark:text-purple-400',
          badgeBg:
            'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          sign: '⇄',
          icon: <ArrowLeftRight className="w-3 h-3" />,
        };
      default:
        return {
          textColor: 'text-slate-700 dark:text-slate-300',
          badgeBg:
            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          sign: '',
          icon: null,
        };
    }
  };

  const selectedCount = selectedRowIndices.size;

  return (
    <div
      id="recent-activity-card"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col transition-colors"
    >
      {/* 1. Header with Title and Quick Action Tools */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Transactions
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                {scopedTransactions.length} {scopedTransactions.length === 1 ? 'entry' : 'entries'}
              </span>
            </h3>
          </div>
        </div>

        {/* Quick Action Tools: Recurring Manager, Export CSV */}
        <div className="flex flex-wrap items-center gap-2">
          {onApplyRecurring && (
            <button
              type="button"
              id="btn-recurring-manager"
              onClick={() => setIsRecurringOpen(true)}
              className="py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Recurring
            </button>
          )}

          <button
            type="button"
            id="btn-export-csv"
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            title="Download records as Excel / CSV"
            className="py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Export CSV
          </button>
        </div>
      </div>

      {actionError && (
        <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs font-medium text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="p-0.5 text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Search, Category Filter, and Selection Bar */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              id="recent-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, category, or wallet..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                id="btn-clear-search"
                onClick={() => setSearchTerm('')}
                title="Clear search"
                className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="recent-category-filter"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="py-2 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-2 py-1 rounded-lg">
              {filteredTransactions.length} of {scopedTransactions.length}{' '}
              {filteredTransactions.length === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>

        {/* Bulk Action Controls */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-delete-selected-transactions"
              onClick={handleTriggerBulkDelete}
              className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer animate-fadeIn"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Delete Selected ({selectedCount})</span>
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="py-1.5 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Mobile Select All Bar */}
      {filteredTransactions.length > 0 && (
        <div className="md:hidden px-4 py-2 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Select All ({filteredTransactions.length})</span>
          </label>

          {selectedCount > 0 && (
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {selectedCount} selected
            </span>
          )}
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 ? (
        <div
          id="empty-transactions-container"
          className="py-12 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 p-6"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">No transactions yet.</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Your transactions sheet is ready. Record your first entry or set up recurring items.
          </p>
          {onAddNewClick && (
            <button
              type="button"
              id="btn-empty-add-transaction"
              onClick={onAddNewClick}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          )}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 p-6">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2.5">
            <Search className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            No transactions match "{searchTerm || selectedCategoryFilter}"
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Try adjusting your search terms or category filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategoryFilter('ALL');
            }}
            className="mt-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-2xs z-10">
                <tr className="text-slate-400 dark:text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  {/* Select All Checkbox Column */}
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
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Payment / Account</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">Modify / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {filteredTransactions.map((tx) => {
                  const style = getTypeStyle(tx.type);
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
                      {/* Checkbox Column */}
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
                        <div className="font-semibold font-mono text-xs text-slate-800 dark:text-slate-200">
                          {formatDateToDDMMYYYY(tx.date)}
                        </div>
                        {tx.time && (
                          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {tx.time}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {tx.category}
                        </div>
                        {tx.subcategory && (
                          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            {tx.subcategory}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${style.badgeBg}`}
                        >
                          {style.icon}
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                        {tx.paymentMode || tx.accountWallet ? (
                          <div>
                            {tx.paymentMode && (
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {tx.paymentMode}
                              </span>
                            )}
                            {tx.accountWallet && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {tx.accountWallet}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 italic text-slate-400 dark:text-slate-500 text-[11px] max-w-xs truncate">
                        {tx.description || (
                          <span className="not-italic text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-bold text-xs ${style.textColor} whitespace-nowrap`}
                      >
                        {style.sign} {formatINR(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {/* Modify Excel / Google Sheet Button */}
                          <button
                            type="button"
                            title="Modify Google Sheet record"
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete from Sheet Button */}
                          {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                            <button
                              type="button"
                              title="Delete transaction from Google Sheet"
                              onClick={() => handleTriggerSingleDelete(tx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors cursor-pointer"
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

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((tx) => {
              const style = getTypeStyle(tx.type);
              const isSelected = tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

              return (
                <div
                  key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                  className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Mobile Checkbox */}
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${style.badgeBg}`}
                      >
                        {style.icon}
                        {tx.type}
                      </span>
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                        {formatDateToDDMMYYYY(tx.date)}
                        {tx.time ? ` • ${tx.time}` : ''}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                      {tx.category}
                      {tx.subcategory ? ` / ${tx.subcategory}` : ''}
                    </div>
                    {(tx.paymentMode || tx.accountWallet) && (
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {[tx.paymentMode, tx.accountWallet].filter(Boolean).join(' • ')}
                      </div>
                    )}
                    {tx.description && (
                      <div className="text-[11px] italic text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {tx.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`font-bold text-xs sm:text-sm text-right ${style.textColor}`}>
                      {style.sign} {formatINR(tx.amount)}
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingTransaction(tx)}
                        title="Modify Record"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                        <button
                          type="button"
                          onClick={() => handleTriggerSingleDelete(tx)}
                          title="Delete Record"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md"
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
