/**
 * ============================================================================
 * File: src/components/AddTransactionForm.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Transaction composer styled in the warm stone & matte obsidian aesthetic
 *   with Poppins typography and pill-segmented transaction types.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  IndianRupee,
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
        `Recorded ₹${numericAmount.toLocaleString('en-IN')} as ${type} (${finalCategory})`
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

  const typeOptions: Array<{
    key: 'Income' | 'Expense' | 'Transfer' | 'Savings' | 'Emergency Fund' | 'Lent' | 'Borrowed';
    label: string;
  }> = [
    { key: 'Expense', label: 'Expense' },
    { key: 'Income', label: 'Income' },
    { key: 'Savings', label: 'Savings' },
    { key: 'Emergency Fund', label: 'Emergency' },
    { key: 'Transfer', label: 'Transfer' },
    { key: 'Lent', label: 'Lent' },
    { key: 'Borrowed', label: 'Borrowed' },
  ];

  return (
    <div
      id="add-transaction-form-card"
      className="bg-white dark:bg-[#1A1B19] rounded-3xl p-5 sm:p-6 border border-[#E6E4DD] dark:border-[#2A2B28] text-[#181816] dark:text-[#F4F3EF] flex flex-col justify-between transition-colors h-full"
    >
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-semibold text-[#181816] dark:text-white tracking-tight">
            Record transaction
          </h2>
          <span className="text-xs text-[#8A8880] dark:text-[#9E9C94]">
            Synced to sheet
          </span>
        </div>

        {successMessage && (
          <div
            id="form-success-banner"
            className="mb-4 p-3 bg-[#EDF3EC] dark:bg-emerald-950/50 border border-[#C6DEC3] dark:border-emerald-800/80 rounded-2xl flex items-center gap-2 text-[#2E7D32] dark:text-emerald-300 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errors.form && (
          <div
            id="form-error-banner"
            className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Soft Stone Segmented Type Bar */}
          <div>
            <label className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5">
              Transaction type
            </label>
            <div className="flex flex-wrap gap-1 p-1 bg-[#EAE8E1] dark:bg-[#262724] rounded-2xl">
              {typeOptions.map((item) => {
                const isSelected = type === item.key;
                return (
                  <button
                    type="button"
                    key={item.key}
                    id={`type-btn-${item.key.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    onClick={() => setType(item.key)}
                    className={`flex-1 min-w-[70px] py-1.5 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs font-semibold'
                        : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {errors.type && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.type}</p>
            )}
          </div>

          {/* 2. Amount & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-amount"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Amount (₹)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A8880]">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  id="tx-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`w-full pl-8 pr-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border rounded-2xl tabular-nums text-xs font-semibold text-[#181816] dark:text-white placeholder-[#8A8880] focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all ${
                    errors.amount
                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30'
                      : 'border-[#E6E4DD] dark:border-[#343531]'
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.amount}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="tx-payment-mode"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Payment method
              </label>
              <select
                id="tx-payment-mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl text-xs font-medium text-[#181816] dark:text-white focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all cursor-pointer"
              >
                {paymentModesList.map((mode) => (
                  <option
                    key={mode}
                    value={mode}
                    className="text-[#181816] dark:text-white bg-white dark:bg-[#1A1B19]"
                  >
                    {mode}
                  </option>
                ))}
                {!paymentModesList.includes('Other Payment Mode') && (
                  <option
                    value="Other Payment Mode"
                    className="text-[#4A5240] dark:text-[#B8A38A] font-semibold bg-white dark:bg-[#1A1B19]"
                  >
                    Other Payment Mode
                  </option>
                )}
              </select>
            </div>
          </div>

          {(paymentMode === 'Other Payment Mode' || paymentMode === '__custom__') && (
            <div>
              <input
                type="text"
                id="tx-custom-payment-mode"
                value={customPaymentMode}
                onChange={(e) => setCustomPaymentMode(e.target.value)}
                placeholder="Specify payment mode (e.g. Cash, Amex)..."
                className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl text-xs text-[#181816] dark:text-white placeholder-[#8A8880] focus:outline-none focus:border-[#4A5240]"
              />
            </div>
          )}

          {/* 3. Category & Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-category"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Category
              </label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border rounded-2xl text-xs font-medium text-[#181816] dark:text-white focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all cursor-pointer ${
                  errors.category
                    ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30'
                    : 'border-[#E6E4DD] dark:border-[#343531]'
                }`}
              >
                {currentCategoryList.length === 0 && (
                  <option value="" className="text-[#8A8880]">
                    No categories found
                  </option>
                )}
                {currentCategoryList.map((cat) => (
                  <option
                    key={cat}
                    value={cat}
                    className="text-[#181816] dark:text-white bg-white dark:bg-[#1A1B19]"
                  >
                    {cat}
                  </option>
                ))}
                <option
                  value="__custom__"
                  className="text-[#4A5240] dark:text-[#B8A38A] font-semibold bg-white dark:bg-[#1A1B19]"
                >
                  + Custom Category...
                </option>
              </select>

              {category === '__custom__' && (
                <div className="mt-2">
                  <input
                    type="text"
                    id="tx-custom-category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category name..."
                    className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl text-xs text-[#181816] dark:text-white placeholder-[#8A8880] focus:outline-none focus:border-[#4A5240]"
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
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Account / Wallet
              </label>
              <select
                id="tx-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl text-xs font-medium text-[#181816] dark:text-white focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all cursor-pointer"
              >
                {accountsList.map((acc) => (
                  <option key={acc} value={acc} className="text-[#181816] dark:text-white bg-white dark:bg-[#1A1B19]">
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-date"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Date
              </label>
              <input
                type="date"
                id="tx-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border rounded-2xl tabular-nums text-xs font-medium text-[#181816] dark:text-white focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all ${
                  errors.date
                    ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30'
                    : 'border-[#E6E4DD] dark:border-[#343531]'
                }`}
              />
              {errors.date && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.date}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="tx-time"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Time
              </label>
              <input
                type="time"
                id="tx-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl tabular-nums text-xs font-medium text-[#181816] dark:text-white focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all"
              />
            </div>
          </div>

          {/* 5. Subcategory & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-subcategory"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Merchant / Subcategory <span className="text-[#8A8880] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="tx-subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Starbucks, Amazon..."
                className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl text-xs text-[#181816] dark:text-white placeholder-[#8A8880] focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="tx-description"
                className="text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] block mb-1.5"
              >
                Notes <span className="text-[#8A8880] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="tx-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a short note..."
                className="w-full px-3 py-2.5 bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl text-xs text-[#181816] dark:text-white placeholder-[#8A8880] focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] transition-all"
              />
            </div>
          </div>

          {/* 6. Submit Button */}
          <button
            type="submit"
            id="btn-save-transaction"
            disabled={isSubmitting}
            className="w-full bg-[#181816] hover:bg-[#2C2D2A] dark:bg-[#F4F3EF] dark:hover:bg-[#E6E4DD] text-white dark:text-[#181816] font-semibold py-3 px-4 rounded-full text-xs mt-1 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving entry...</span>
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
