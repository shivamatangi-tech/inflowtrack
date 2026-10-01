/**
 * ============================================================================
 * File: src/components/TaxonomyCard.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Google Sheets Taxonomy management card displaying the income, expense,
 *   transfer, and savings category hierarchy, payment modes, and a direct form
 *   to append custom categories to the Google Sheet.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Layers,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
} from 'lucide-react';
import { CategoryData } from '../types';

interface TaxonomyCardProps {
  categories: CategoryData;
  onAddCategory?: (type: 'Income' | 'Expense', categoryName: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const TaxonomyCard: React.FC<TaxonomyCardProps> = ({
  categories,
  onAddCategory,
  onRefresh,
}) => {
  const [newCatType, setNewCatType] = useState<'Income' | 'Expense'>('Expense');
  const [newCatName, setNewCatName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'savings' | 'modes'>('expense');

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    if (!onAddCategory) {
      setErrorMessage('Category addition service is unavailable.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await onAddCategory(newCatType, cleanName);
      setSuccessMessage(`"${cleanName}" successfully added to Google Sheets under ${newCatType}s.`);
      setNewCatName('');
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to add category to Google Sheets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Google Sheets Taxonomy
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Synchronized category hierarchy and payment modes from your spreadsheet
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Add Category Form */}
      <form
        onSubmit={handleAddCategorySubmit}
        className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] space-y-3"
      >
        <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-[#C5A059]" />
          <span>Add New Category to Google Sheet</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label
              htmlFor="taxonomy-cat-type"
              className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
            >
              Type
            </label>
            <select
              id="taxonomy-cat-type"
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value as 'Income' | 'Expense')}
              className="w-full min-h-[42px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="Expense">Expense Category</option>
              <option value="Income">Income Category</option>
            </select>
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="taxonomy-cat-name"
              className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
            >
              Category Name
            </label>
            <input
              type="text"
              id="taxonomy-cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Subscriptions, Gadgets..."
              required
              className="w-full min-h-[42px] px-3.5 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="w-full min-h-[42px] px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>Add to Sheet</span>
            </button>
          </div>
        </div>
      </form>

      {/* Category Pills Navigation Sub-Tabs */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-1.5 border-b border-[#E5E0D4] dark:border-[#282622] pb-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'expense'
                ? 'bg-[#141412] text-[#F6F5F0] dark:bg-[#C5A059] dark:text-[#111110] font-semibold'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:bg-[#F6F5F0] dark:hover:bg-[#22211D]'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Expenses ({categories.expenseCategories?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'income'
                ? 'bg-[#141412] text-[#F6F5F0] dark:bg-[#C5A059] dark:text-[#111110] font-semibold'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:bg-[#F6F5F0] dark:hover:bg-[#22211D]'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Income ({categories.incomeCategories?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('savings')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'savings'
                ? 'bg-[#141412] text-[#F6F5F0] dark:bg-[#C5A059] dark:text-[#111110] font-semibold'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:bg-[#F6F5F0] dark:hover:bg-[#22211D]'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Savings &amp; Reserves</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('modes')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'modes'
                ? 'bg-[#141412] text-[#F6F5F0] dark:bg-[#C5A059] dark:text-[#111110] font-semibold'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:bg-[#F6F5F0] dark:hover:bg-[#22211D]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Payment Modes</span>
          </button>
        </div>

        {/* Categories Display Grid */}
        <div className="flex flex-wrap gap-2 pt-1 max-h-60 overflow-y-auto">
          {activeTab === 'expense' &&
            (categories.expenseCategories || []).map((cat) => (
              <span
                key={cat}
                className="px-3 py-1.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0]"
              >
                {cat}
              </span>
            ))}

          {activeTab === 'income' &&
            (categories.incomeCategories || []).map((cat) => (
              <span
                key={cat}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300"
              >
                {cat}
              </span>
            ))}

          {activeTab === 'savings' &&
            (categories.savingsCategories || []).map((cat) => (
              <span
                key={cat}
                className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                {cat}
              </span>
            ))}

          {activeTab === 'modes' &&
            (categories.paymentModes || []).map((mode) => (
              <span
                key={mode}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-800 dark:text-blue-300"
              >
                {mode}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};
