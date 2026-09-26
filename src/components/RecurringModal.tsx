/**
 * ============================================================================
 * File: src/components/RecurringModal.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Modal manager for creating, viewing, applying, and deleting monthly
 *   recurring transaction templates (e.g., Salary, Rent, SIP, Subscriptions).
 *
 * Key Responsibilities:
 *   1. Loads and persists recurring templates in the user's Google Sheet
 *      (`Budgets_And_Recurring` tab) scoped to the verified Firebase UID.
 *   2. Allows one-click application ("Log Now") of any recurring template
 *      into the active month's Google Sheet tab.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Repeat,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from 'lucide-react';
import { RecurringTemplate, TransactionType, CategoryData } from '../types';
import { formatINR, getCurrentMonthKey } from '../utils/formatters';
import {
  fetchRecurringTemplatesFromSheet,
  createRecurringTemplateInSheet,
  deleteRecurringTemplateFromSheet,
} from '../services/sheets';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryData;
  onApplyRecurring: (tx: {
    date: string;
    type: TransactionType;
    category: string;
    amount: number;
    paymentMode?: string;
    description: string;
  }) => Promise<void>;
  currentMonthKey: string;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  categories,
  onApplyRecurring,
  currentMonthKey,
}) => {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('Expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingTemplates(true);
      void fetchRecurringTemplatesFromSheet()
        .then((list) => {
          setTemplates(list);
        })
        .finally(() => {
          setIsLoadingTemplates(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCategoriesList =
    type === 'Income'
      ? categories.incomeCategories
      : type === 'Expense'
      ? categories.expenseCategories
      : type === 'Savings'
      ? categories.savingsCategories
      : type === 'Emergency Fund'
      ? categories.emergencyFundCategories
      : categories.lentBorrowedCategories || [];

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!name || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const selectedCat = category || currentCategoriesList[0] || 'General';

    try {
      const updatedList = await createRecurringTemplateInSheet(null, {
        name: name.trim(),
        type,
        category: selectedCat,
        amount: parsedAmount,
        dayOfMonth: Math.min(Math.max(dayOfMonth, 1), 31),
        description: description.trim(),
        isActive: true,
      });

      setTemplates(updatedList);
      setIsAdding(false);
      setName('');
      setAmount('');
      setDescription('');
      setStatusMessage(`Recurring template "${name.trim()}" saved to your Google Sheet.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to save recurring template.');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const updatedList = await deleteRecurringTemplateFromSheet(null, id);
      setTemplates(updatedList);
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to delete recurring template.');
    }
  };

  const handlePostToSheet = async (tpl: RecurringTemplate) => {
    setApplyingId(tpl.id);
    setStatusMessage(null);
    try {
      const monthStr = currentMonthKey || getCurrentMonthKey();
      const dayStr = String(tpl.dayOfMonth).padStart(2, '0');
      const dateStr = `${monthStr}-${dayStr}`;

      await onApplyRecurring({
        date: dateStr,
        type: tpl.type,
        category: tpl.category,
        amount: tpl.amount,
        paymentMode: tpl.paymentMode || 'HDFC Bank',
        description: tpl.description || `Recurring: ${tpl.name}`,
      });

      setAppliedIds((prev) => new Set(prev).add(tpl.id));
      setStatusMessage(`"${tpl.name}" posted to Google Sheets for ${monthStr}!`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setStatusMessage(`Failed to apply: ${err.message || 'Unknown error'}`);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      <div
        id="recurring-transactions-modal"
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative transition-colors"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Recurring Transactions
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Stored in your Google Sheet &amp; isolated to your verified Firebase UID.
              </p>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {isAdding ? (
          <form
            onSubmit={handleCreateTemplate}
            className="p-4 mb-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                New Recurring Template
              </h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Rent, Gym, Netflix"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Savings">Savings</option>
                  <option value="Emergency Fund">Emergency Fund</option>
                  <option value="Lent & Borrowed">Lent &amp; Borrowed</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {currentCategoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Day of Month (1 - 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="Optional recurring note"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Save Recurring Template
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-4 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isLoadingTemplates ? 'Loading schedules...' : `${templates.length} recurring schedules`}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAdding(true);
                setCategory(categories.expenseCategories[0] || '');
              }}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recurring Item</span>
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          {templates.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No recurring transactions set up. Click &quot;Add Recurring Item&quot; above.
            </div>
          ) : (
            templates.map((tpl) => {
              const isApplied = appliedIds.has(tpl.id);
              const isApplying = applyingId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        tpl.type === 'Income'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : tpl.type === 'Expense'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      }`}
                    >
                      {tpl.type === 'Income' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : tpl.type === 'Expense' ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : (
                        <PiggyBank className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {tpl.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" /> Day {tpl.dayOfMonth}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {tpl.description || `${tpl.type} recurring every month`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {formatINR(tpl.amount)}
                    </div>

                    <button
                      type="button"
                      disabled={isApplying}
                      onClick={() => void handlePostToSheet(tpl)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                        isApplied
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Applied</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isApplying ? 'Posting...' : 'Post to Sheet'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteTemplate(tpl.id)}
                      title="Delete template"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
