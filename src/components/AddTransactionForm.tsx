/**
 * ============================================================================
 * File: src/components/AddTransactionForm.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Interactive transaction entry form for recording new financial records
 *   into the user's private Google Sheet.
 *
 * Key Responsibilities:
 *   1. Supports all 7 transaction types: Income, Expense, Transfer, Savings,
 *      Emergency Fund, Lent (Receivable), and Borrowed (Payable).
 *   2. Captures Date, Time, Amount (INR), Category, Optional Subcategory,
 *      Payment Method, Account/Wallet, and Notes/Description.
 *   3. Validates inputs and delegates saving to the backend-verified Google
 *      Sheets append API (`onSave`).
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  IndianRupee,
  Tag,
  FileText,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { TransactionType, CategoryData } from '../types';
import { getTodayDateString } from '../utils/formatters';
import {
  DEFAULT_LENT_CATEGORIES,
  DEFAULT_BORROWED_CATEGORIES,
  DEFAULT_TRANSFER_CATEGORIES,
  DEFAULT_ACCOUNTS,
} from '../services/sheets';

interface AddTransactionFormProps {
  categories: CategoryData;
  initialType?: TransactionType;
  onSave: (transaction: {
    date: string;
    time?: string;
    type: TransactionType;
    category: string;
    subcategory?: string;
    amount: number;
    paymentMode?: string;
    account?: string;
    description: string;
  }) => Promise<void>;
  onSuccessCallback?: () => void;
  isCompact?: boolean;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export const AddTransactionForm: React.FC<AddTransactionFormProps> = ({
  categories,
  initialType = 'Expense',
  onSave,
  onSuccessCallback,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('HDFC Bank');
  const [customPaymentMode, setCustomPaymentMode] = useState<string>('');
  const [account, setAccount] = useState<string>('Primary Bank Account');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [time, setTime] = useState<string>(getCurrentTimeHHMM());
  const [description, setDescription] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (initialType) {
      setType(initialType);
    }
  }, [initialType]);

  const currentCategoryList = React.useMemo(() => {
    switch (type) {
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
        return [];
    }
  }, [type, categories]);

  const paymentModesList = React.useMemo(() => {
    return categories.paymentModes && categories.paymentModes.length > 0
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
  }, [categories.paymentModes]);

  const accountsList = React.useMemo(() => {
    return categories.accounts && categories.accounts.length > 0
      ? categories.accounts
      : DEFAULT_ACCOUNTS;
  }, [categories.accounts]);

  useEffect(() => {
    if (paymentModesList.length > 0 && !paymentModesList.includes(paymentMode)) {
      setPaymentMode(paymentModesList[0]);
    }
  }, [paymentModesList]);

  useEffect(() => {
    if (currentCategoryList.length > 0) {
      if (!currentCategoryList.includes(category)) {
        setCategory(currentCategoryList[0]);
      }
    } else {
      setCategory('');
    }
    setErrors({});
  }, [type, currentCategoryList]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!date) {
      newErrors.date = 'Date is required.';
    }

    if (!type) {
      newErrors.type = 'Transaction type is required.';
    }

    const finalCat = category === '__custom__' ? customCategory.trim() : category.trim();
    if (!finalCat) {
      newErrors.category = 'Category is required.';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount)) {
      newErrors.amount = 'Valid numeric amount is required.';
    } else if (numAmount <= 0) {
      newErrors.amount = 'Amount must be greater than zero (₹).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    const finalCategory = category === '__custom__' ? customCategory.trim() : category.trim();
    const finalPaymentMode =
      paymentMode === 'Other Payment Mode' && customPaymentMode.trim()
        ? customPaymentMode.trim()
        : paymentMode === '__custom__'
        ? customPaymentMode.trim() || 'Other Payment Mode'
        : paymentMode.trim();
    const numericAmount = parseFloat(amount);

    setIsSubmitting(true);
    try {
      await onSave({
        date,
        time: time || getCurrentTimeHHMM(),
        type,
        category: finalCategory,
        subcategory: subcategory.trim(),
        amount: numericAmount,
        paymentMode: finalPaymentMode || 'HDFC Bank',
        account: account.trim() || 'Primary Bank Account',
        description: description.trim(),
      });

      setSuccessMessage(
        `Recorded ₹${numericAmount.toLocaleString('en-IN')} as ${type} via ${finalPaymentMode || 'HDFC Bank'}`
      );

      setAmount('');
      setDescription('');
      setSubcategory('');
      setCustomCategory('');
      setCustomPaymentMode('');
      setDate(getTodayDateString());
      setTime(getCurrentTimeHHMM());
      setErrors({});

      if (onSuccessCallback) {
        onSuccessCallback();
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to save transaction. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeConfig: {
    [key in 'Income' | 'Expense' | 'Transfer' | 'Savings' | 'Emergency Fund' | 'Lent' | 'Borrowed']: {
      label: string;
      icon: React.ReactNode;
      activeColor: string;
    };
  } = {
    Income: {
      label: 'Income',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      activeColor: 'bg-emerald-600 text-white shadow-xs',
    },
    Expense: {
      label: 'Expense',
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      activeColor: 'bg-rose-600 text-white shadow-xs',
    },
    Transfer: {
      label: 'Transfer',
      icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
      activeColor: 'bg-indigo-600 text-white shadow-xs',
    },
    Savings: {
      label: 'Savings',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      activeColor: 'bg-blue-600 text-white shadow-xs',
    },
    'Emergency Fund': {
      label: 'Emergency',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      activeColor: 'bg-amber-500 text-white shadow-xs',
    },
    Lent: {
      label: 'Lent',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      activeColor: 'bg-purple-600 text-white shadow-xs',
    },
    Borrowed: {
      label: 'Borrowed',
      icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
      activeColor: 'bg-rose-600 text-white shadow-xs',
    },
  };

  return (
    <div
      id="add-transaction-form-card"
      className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-5 md:p-6 shadow-xs border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Add Transaction
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
            Google Sheets Synchronized
          </span>
        </div>

        {successMessage && (
          <div
            id="form-success-banner"
            className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errors.form && (
          <div
            id="form-error-banner"
            className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Transaction Type Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
              Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 bg-slate-50/80 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((t) => {
                const isSelected = type === t;
                return (
                  <button
                    type="button"
                    key={t}
                    id={`type-btn-${t.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? typeConfig[t].activeColor
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="mb-0.5">{typeConfig[t].icon}</div>
                    <span className="truncate w-full text-center text-[10px]">
                      {typeConfig[t].label}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.type && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.type}</p>
            )}
          </div>

          {/* 2. Amount & Payment Mode in 2-Column Responsive Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="tx-amount"
                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider"
              >
                Amount (INR ₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  id="tx-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="₹ 0.00"
                  className={`w-full pl-8 pr-3 py-2 bg-slate-50/70 dark:bg-slate-800 border rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.amount
                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.amount}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="tx-payment-mode"
                  className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider"
                >
                  Payment Mode
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Categories!C
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <select
                  id="tx-payment-mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {paymentModesList.map((mode) => (
                    <option
                      key={mode}
                      value={mode}
                      className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                    >
                      {mode}
                    </option>
                  ))}
                  {!paymentModesList.includes('Other Payment Mode') && (
                    <option
                      value="Other Payment Mode"
                      className="text-indigo-600 dark:text-indigo-400 font-semibold bg-white dark:bg-slate-800"
                    >
                      Other Payment Mode
                    </option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {(paymentMode === 'Other Payment Mode' || paymentMode === '__custom__') && (
            <div className="mt-1">
              <input
                type="text"
                id="tx-custom-payment-mode"
                value={customPaymentMode}
                onChange={(e) => setCustomPaymentMode(e.target.value)}
                placeholder="Optional: Specify payment mode name (e.g. Cash, Amex, Sodexo)..."
                className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* 3. Category & Subcategory / Wallet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="tx-category"
                  className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider"
                >
                  Category <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {type === 'Income' ? 'Categories!A' : type === 'Expense' ? 'Categories!B' : 'Categories'}
                </span>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <select
                  id="tx-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full pl-8 pr-8 py-2 bg-slate-50/70 dark:bg-slate-800 border rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer ${
                    errors.category
                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {currentCategoryList.length === 0 && (
                    <option value="" className="text-slate-400">
                      No categories found
                    </option>
                  )}
                  {currentCategoryList.map((cat) => (
                    <option
                      key={cat}
                      value={cat}
                      className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                    >
                      {cat}
                    </option>
                  ))}
                  <option
                    value="__custom__"
                    className="text-indigo-600 dark:text-indigo-400 font-semibold bg-white dark:bg-slate-800"
                  >
                    + Other / Custom Category...
                  </option>
                </select>
              </div>

              {category === '__custom__' && (
                <div className="mt-2">
                  <input
                    type="text"
                    id="tx-custom-category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category name..."
                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {errors.category && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.category}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="tx-account"
                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider"
              >
                Account / Wallet
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <select
                  id="tx-account"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {accountsList.map((acc) => (
                    <option key={acc} value={acc} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Date & Time Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="tx-date"
                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider"
              >
                Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <input
                  type="date"
                  id="tx-date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 bg-slate-50/70 dark:bg-slate-800 border rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.date
                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
              {errors.date && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.date}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="tx-time"
                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider"
              >
                Time
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <input
                  type="time"
                  id="tx-time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 5. Subcategory & Description / Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="tx-subcategory"
                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider"
              >
                Subcategory <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                id="tx-subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Dining Out, Vegetables..."
                className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="tx-description"
                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider"
              >
                Notes / Description <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  id="tx-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Weekly Supermarket Trip"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 6. Submit Button */}
          <button
            type="submit"
            id="btn-save-transaction"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold py-3 rounded-lg text-xs mt-2 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Saving to Google Sheets...</span>
              </>
            ) : (
              <span>Save Transaction</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
