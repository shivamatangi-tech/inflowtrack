/**
 * ============================================================================
 * File: src/components/EditTransactionModal.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Modal dialog for modifying or deleting an existing transaction row in
 *   Google Sheets.
 *
 * Key Responsibilities:
 *   1. Pre-populates all fields (Date, Time, Type, Category, Subcategory,
 *      Amount, Payment Mode, Account/Wallet, Description) from the selected
 *      transaction record.
 *   2. Saves updated values back to the exact row index in the corresponding
 *      monthly Google Sheet tab (`onSave`), verified against the user's UID.
 *   3. Provides a two-step inline confirmation for permanently deleting the
 *      transaction row (`onDelete`).
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Tag,
  FileText,
  Save,
  Trash2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { Transaction, TransactionType, CategoryData } from '../types';
import { getTodayDateString, normalizeDateString } from '../utils/formatters';
import {
  DEFAULT_LENT_CATEGORIES,
  DEFAULT_BORROWED_CATEGORIES,
  DEFAULT_TRANSFER_CATEGORIES,
  DEFAULT_ACCOUNTS,
} from '../services/sheets';
import {
  getCategoryIcon,
  TopUpWithdrawIconBadge,
} from '../utils/categoryIcons';

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  categories: CategoryData;
  onClose: () => void;
  onSave: (
    rowIndex: number,
    updatedData: {
      date: string;
      time?: string;
      type: TransactionType;
      category: string;
      subcategory?: string;
      amount: number;
      paymentMode?: string;
      account?: string;
      description: string;
    }
  ) => Promise<void>;
  onDelete?: (rowIndex: number) => Promise<void>;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  transaction,
  categories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [type, setType] = useState<TransactionType>('Expense');
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [subcategory, setSubcategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('HDFC Bank');
  const [account, setAccount] = useState<string>('Primary Bank Account');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [time, setTime] = useState<string>('09:00');
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const paymentModesList = React.useMemo(() => {
    const list =
      categories.paymentModes && categories.paymentModes.length > 0
        ? categories.paymentModes
        : [
            'HDFC Bank',
            'Kotak 811',
            'SBI Bank',
            'HDFC Credit Card',
            'SBI Credit Card',
            'Tata Neu Credit Card',
            'Amazon ICICI',
            'UPI / GPay',
            'Cash',
            'Other Payment Mode',
          ];

    if (transaction?.paymentMode && !list.includes(transaction.paymentMode)) {
      return [...list, transaction.paymentMode];
    }
    return list;
  }, [categories.paymentModes, transaction?.paymentMode]);

  const accountsList = React.useMemo(() => {
    const list =
      categories.accounts && categories.accounts.length > 0
        ? categories.accounts
        : DEFAULT_ACCOUNTS;
    if (transaction?.account && !list.includes(transaction.account)) {
      return [...list, transaction.account];
    }
    return list;
  }, [categories.accounts, transaction?.account]);

  const getCategoryListForType = (t: TransactionType) => {
    switch (t) {
      case 'Income':
        return categories.incomeCategories;
      case 'Expense':
        return categories.expenseCategories;
      case 'Transfer':
        return categories.transferCategories && categories.transferCategories.length > 0
          ? categories.transferCategories
          : DEFAULT_TRANSFER_CATEGORIES;
      case 'Savings':
        return categories.savingsCategories;
      case 'Emergency Fund':
        return categories.emergencyFundCategories;
      case 'Lent':
        return categories.lentCategories && categories.lentCategories.length > 0
          ? categories.lentCategories
          : DEFAULT_LENT_CATEGORIES;
      case 'Borrowed':
        return categories.borrowedCategories && categories.borrowedCategories.length > 0
          ? categories.borrowedCategories
          : DEFAULT_BORROWED_CATEGORIES;
      case 'Lent & Borrowed':
        return categories.lentBorrowedCategories || [];
      default:
        return categories.expenseCategories;
    }
  };

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount ? String(transaction.amount) : '');
      setPaymentMode(transaction.paymentMode || 'HDFC Bank');
      setAccount(transaction.account || 'Primary Bank Account');
      setSubcategory(transaction.subcategory || '');
      setDate(transaction.date ? normalizeDateString(transaction.date) : getTodayDateString());
      setTime(transaction.time || '09:00');
      setDescription(transaction.description || '');
      setConfirmingDelete(false);

      const availableList = getCategoryListForType(transaction.type);

      if (availableList.includes(transaction.category)) {
        setCategory(transaction.category);
        setIsCustomCategory(false);
        setCustomCategory('');
      } else {
        setCategory('__custom__');
        setIsCustomCategory(true);
        setCustomCategory(transaction.category);
      }
      setErrorMessage(null);
    }
  }, [transaction, categories]);

  if (!isOpen || !transaction) return null;

  const currentCategoriesList = getCategoryListForType(type);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const nextCategories = getCategoryListForType(newType);

    if (nextCategories.length > 0) {
      setCategory(nextCategories[0]);
      setIsCustomCategory(false);
    } else {
      setCategory('__custom__');
      setIsCustomCategory(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      setErrorMessage('Please select or specify a category.');
      return;
    }

    if (!transaction.rowIndex) {
      setErrorMessage('Unable to modify: row index in Google Sheet is missing.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(transaction.rowIndex, {
        date,
        time,
        type,
        category: finalCategory,
        subcategory: subcategory.trim(),
        amount: parsedAmount,
        paymentMode: paymentMode || 'HDFC Bank',
        account: account || 'Primary Bank Account',
        description: description.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update transaction in Google Sheet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      <div
        id="edit-transaction-modal"
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative transition-colors"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Modify Transaction Record
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Editing Row #{transaction.rowIndex} in Google Sheet ({transaction.transactionId || 'verified UID'}).
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector Tabs */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange('Expense')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Expense
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Income')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Income
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Transfer')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Transfer'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Transfer
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Savings')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Savings'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" />
                Savings
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Emergency Fund')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Emergency Fund'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Emergency
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Lent')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Lent'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Lent
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Borrowed')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'Borrowed'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Borrowed
              </button>
            </div>
          </div>

          {/* Amount and Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Amount (₹ INR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Payment Mode
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {paymentModesList.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Category Circular Icon Picker (Top Up / Withdraw Icon Style) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {type === 'Income'
                  ? 'Income Categories'
                  : type === 'Expense'
                  ? 'Expense Categories'
                  : `Other Categories (${type})`}
              </label>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isCustomCategory ? customCategory || 'Custom' : category}
              </span>
            </div>

            <div className="flex items-center gap-3.5 overflow-x-auto py-2.5 px-3 bg-[#F4F3EF]/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 mb-2.5 snap-x">
              {currentCategoriesList.map((cat) => {
                const isSelected = !isCustomCategory && category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setCategory(cat);
                    }}
                    className="flex flex-col items-center gap-1 cursor-pointer shrink-0 snap-start min-w-[60px]"
                  >
                    <TopUpWithdrawIconBadge
                      icon={getCategoryIcon(cat, type)}
                      shape={type === 'Income' ? 'square' : 'circle'}
                      isSelected={isSelected}
                      size="sm"
                    />
                    <span
                      className={`text-[10px] truncate max-w-[72px] text-center whitespace-nowrap ${
                        isSelected
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {cat}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomCategory(true)}
                className="flex flex-col items-center gap-1 cursor-pointer shrink-0 snap-start min-w-[60px]"
              >
                <TopUpWithdrawIconBadge
                  icon={<Tag className="w-3.5 h-3.5" />}
                  shape="square"
                  isSelected={isCustomCategory}
                  size="sm"
                />
                <span
                  className={`text-[10px] truncate max-w-[72px] text-center whitespace-nowrap ${
                    isCustomCategory
                      ? 'font-bold text-slate-900 dark:text-white'
                      : 'font-medium text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Custom
                </span>
              </button>
            </div>

            {isCustomCategory && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category name..."
                required
                className="mt-1 w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            )}
          </div>

          {/* Account/Wallet */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Account / Wallet
            </label>
            <div className="relative">
              <Wallet className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {accountsList.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Transaction Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Subcategory and Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Subcategory (Optional)
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Subcategory..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Description / Notes
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add optional note..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {onDelete && transaction.rowIndex ? (
              confirmingDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        await onDelete(transaction.rowIndex!);
                        onClose();
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2 py-1.5 text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={isSaving}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Updating Sheet...' : 'Update Sheet Record'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
