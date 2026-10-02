/**
 * ============================================================================
 * File: src/components/FinanceCalculatorTab.tsx
 * Application: inflowtrack — Track Save Grow
 * Purpose:
 *   Interactive Financial Calculator and Transaction Insertion Tab.
 *   Provides Quick Math, Split Bill, Loan EMI, and GST/Discount calculation
 *   tools with 1-click "Insert as Expense" and "Insert as Income" triggers
 *   that populate the Add Transaction form and Google Sheet seamlessly.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Check,
  RotateCcw,
  Users,
  Percent,
  Coins,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { TransactionType } from '../types';
import { formatINR } from '../utils/formatters';

export type CalculatorMode = 'math' | 'split' | 'emi' | 'tax';

interface FinanceCalculatorTabProps {
  onInsertTransaction: (amount: number, type: TransactionType, notes?: string) => void;
  onCloseModal?: () => void;
  isModal?: boolean;
}

export const FinanceCalculatorTab: React.FC<FinanceCalculatorTabProps> = ({
  onInsertTransaction,
  onCloseModal,
  isModal = false,
}) => {
  const [mode, setMode] = useState<CalculatorMode>('math');

  // Math Calculator State
  const [expression, setExpression] = useState<string>('');
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  // Split Bill State
  const [billAmount, setBillAmount] = useState<string>('1200');
  const [peopleCount, setPeopleCount] = useState<number>(3);
  const [tipPercent, setTipPercent] = useState<number>(5);

  // EMI State
  const [loanPrincipal, setLoanPrincipal] = useState<string>('100000');
  const [interestRate, setInterestRate] = useState<string>('10.5');
  const [tenureMonths, setTenureMonths] = useState<string>('12');

  // Tax & Discount State
  const [baseAmount, setBaseAmount] = useState<string>('5000');
  const [taxPercent, setTaxPercent] = useState<string>('18');
  const [discountPercent, setDiscountPercent] = useState<string>('10');
  const [taxMode, setTaxMode] = useState<'tax' | 'discount'>('tax');

  // Safely evaluates math expression
  const safeEval = useCallback((expr: string): number => {
    try {
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/[^0-9+\-*/.()]/g, '');
      if (!sanitized) return 0;
      // Using Function constructor with strictly sanitized numeric math characters only
      const res = new Function(`return (${sanitized})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return Math.round(res * 100) / 100;
      }
      return 0;
    } catch {
      return 0;
    }
  }, []);

  const handleDigit = (digit: string) => {
    setDisplayValue((prev) => {
      if (prev === '0' || prev === 'Error') {
        return digit;
      }
      return prev + digit;
    });
  };

  const handleOperator = (op: string) => {
    if (displayValue === 'Error') return;
    setExpression((prev) => `${prev} ${displayValue} ${op}`);
    setDisplayValue('0');
  };

  const handleClear = () => {
    setDisplayValue('0');
    setExpression('');
  };

  const handleBackspace = () => {
    setDisplayValue((prev) => {
      if (prev.length <= 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  };

  const handleCalculate = () => {
    if (!expression && displayValue === '0') return;
    const fullExpr = expression ? `${expression} ${displayValue}` : displayValue;
    const result = safeEval(fullExpr);
    setHistory((prev) => [`${fullExpr} = ${result}`, ...prev.slice(0, 4)]);
    setDisplayValue(String(result));
    setExpression('');
  };

  // Get active numeric amount based on current tool mode
  const getActiveCalculatedAmount = (): number => {
    switch (mode) {
      case 'math': {
        const val = parseFloat(displayValue);
        return isNaN(val) ? 0 : Math.max(0, val);
      }
      case 'split': {
        const bill = parseFloat(billAmount) || 0;
        const people = Math.max(1, peopleCount);
        const tip = (bill * (tipPercent || 0)) / 100;
        const total = bill + tip;
        return Math.round((total / people) * 100) / 100;
      }
      case 'emi': {
        const p = parseFloat(loanPrincipal) || 0;
        const r = (parseFloat(interestRate) || 0) / 12 / 100;
        const n = parseFloat(tenureMonths) || 1;
        if (p <= 0 || n <= 0) return 0;
        if (r <= 0) return Math.round((p / n) * 100) / 100;
        const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        return Math.round(emi * 100) / 100;
      }
      case 'tax': {
        const base = parseFloat(baseAmount) || 0;
        if (taxMode === 'tax') {
          const rate = parseFloat(taxPercent) || 0;
          return Math.round((base + (base * rate) / 100) * 100) / 100;
        } else {
          const disc = parseFloat(discountPercent) || 0;
          return Math.max(0, Math.round((base - (base * disc) / 100) * 100) / 100);
        }
      }
      default:
        return 0;
    }
  };

  const currentAmount = getActiveCalculatedAmount();

  const handleCopyAmount = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(String(currentAmount));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsert = (type: TransactionType) => {
    if (currentAmount <= 0) return;
    let notes = '';
    if (mode === 'split') {
      notes = `Split bill (${peopleCount} people, ${tipPercent}% tip)`;
    } else if (mode === 'emi') {
      notes = `Loan EMI (${tenureMonths} mos @ ${interestRate}%)`;
    } else if (mode === 'tax') {
      notes = taxMode === 'tax' ? `GST/Tax invoice (${taxPercent}%)` : `Discounted purchase (${discountPercent}%)`;
    }
    onInsertTransaction(currentAmount, type, notes);
    if (onCloseModal) {
      onCloseModal();
    }
  };

  // Keyboard navigation support for desktop math calculations
  useEffect(() => {
    if (mode !== 'math') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === '.') {
        handleDigit('.');
      } else if (e.key === '+' || e.key === '-') {
        handleOperator(e.key === '-' ? '−' : '+');
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleCalculate();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, expression, displayValue]);

  return (
    <div
      id="finance-calculator-container"
      className={`w-full bg-white dark:bg-[#161614] rounded-2xl sm:rounded-3xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-all overflow-hidden ${
        isModal ? 'p-4 sm:p-6' : 'p-4 sm:p-6 lg:p-7'
      }`}
    >
      {/* 1. Header with Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EFECE4] dark:border-[#24231F]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0 border border-[#E5E0D4] dark:border-[#2C2A25]">
            <Calculator className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Finance & Expense Calculator
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Calculate bills, EMI, or quick math, then 1-click insert directly into your Google Sheet
            </p>
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 p-1 bg-[#F6F5F0] dark:bg-[#201F1B] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
          <button
            type="button"
            onClick={() => setMode('math')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'math'
                ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Quick Math</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('split')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'split'
                ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Split Bill</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('emi')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'emi'
                ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Loan EMI</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('tax')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'tax'
                ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs'
                : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>GST / Discount</span>
          </button>
        </div>
      </div>

      {/* 2. Main Calculator Interface & Tool Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
        {/* Left / Center Area: Interactive Tool (8 Cols on Desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* A. QUICK MATH CALCULATOR */}
          {mode === 'math' && (
            <div className="space-y-3">
              {/* Display Window */}
              <div className="p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#1E1D19] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25] text-right space-y-1">
                <div className="text-xs text-[#78746B] dark:text-[#9E9B92] font-mono min-h-[18px] truncate">
                  {expression || (history[0] ? `Last: ${history[0]}` : 'Ready')}
                </div>
                <div className="font-display tabular-nums text-3xl sm:text-4xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight truncate">
                  {displayValue}
                </div>
              </div>

              {/* Calculator Keypad */}
              <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={handleClear}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-sm hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#EFECE4] dark:bg-[#282622] text-[#141412] dark:text-[#F6F5F0] font-semibold text-sm hover:bg-[#E5E0D4] transition-colors cursor-pointer"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(displayValue);
                    if (!isNaN(val)) setDisplayValue(String(val / 100));
                  }}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#EFECE4] dark:bg-[#282622] text-[#141412] dark:text-[#F6F5F0] font-semibold text-sm hover:bg-[#E5E0D4] transition-colors cursor-pointer"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('÷')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] font-bold text-base hover:opacity-90 transition-opacity cursor-pointer"
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button
                  type="button"
                  onClick={() => handleDigit('7')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('8')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('9')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('×')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] font-bold text-base hover:opacity-90 transition-opacity cursor-pointer"
                >
                  ×
                </button>

                {/* Row 3 */}
                <button
                  type="button"
                  onClick={() => handleDigit('4')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('5')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('6')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('−')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] font-bold text-base hover:opacity-90 transition-opacity cursor-pointer"
                >
                  −
                </button>

                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleDigit('1')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('2')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('3')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('+')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] font-bold text-base hover:opacity-90 transition-opacity cursor-pointer"
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('00')}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!displayValue.includes('.')) handleDigit('.');
                  }}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-bold text-base hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={handleCalculate}
                  className="min-h-[50px] sm:min-h-[54px] rounded-xl bg-[#C5A059] hover:bg-[#D1AF6A] text-[#111110] font-bold text-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  =
                </button>
              </div>
            </div>
          )}

          {/* B. SPLIT BILL CALCULATOR */}
          {mode === 'split' && (
            <div className="space-y-4 p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#1E1D19] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25]">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center justify-between">
                  <span>Total Bill Amount (INR)</span>
                  <span className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">Including food & beverages</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#78746B] dark:text-[#9E9B92]">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="w-full min-h-[44px] pl-8 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Number of People ({peopleCount})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(parseInt(e.target.value, 10))}
                    className="w-full accent-[#C5A059] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#78746B]">
                    <span>1 person</span>
                    <span>10</span>
                    <span>20 people</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Tip / Service Charge ({tipPercent}%)
                  </label>
                  <div className="flex gap-1.5">
                    {[0, 5, 10, 15].map((rate) => (
                      <button
                        type="button"
                        key={rate}
                        onClick={() => setTipPercent(rate)}
                        className={`flex-1 min-h-[38px] text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          tipPercent === rate
                            ? 'bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] border-transparent'
                            : 'bg-white dark:bg-[#141412] border-[#E5E0D4] dark:border-[#2C2A25] text-[#78746B] dark:text-[#9E9B92]'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Breakdown Summary */}
              <div className="p-3 bg-white dark:bg-[#141412] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92] block">Bill Subtotal</span>
                  <span className="text-xs font-bold tabular-nums text-[#141412] dark:text-[#F6F5F0]">
                    {formatINR(parseFloat(billAmount) || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92] block">Tip Amount</span>
                  <span className="text-xs font-bold tabular-nums text-[#8E7952] dark:text-[#C5A059]">
                    {formatINR(((parseFloat(billAmount) || 0) * (tipPercent || 0)) / 100)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92] block">Total Shared</span>
                  <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatINR((parseFloat(billAmount) || 0) * (1 + (tipPercent || 0) / 100))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* C. LOAN EMI CALCULATOR */}
          {mode === 'emi' && (
            <div className="space-y-4 p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#1E1D19] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Principal (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={loanPrincipal}
                    onChange={(e) => setLoanPrincipal(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    step="1"
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* EMI Totals */}
              <div className="p-3 bg-white dark:bg-[#141412] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] grid grid-cols-2 gap-3 text-center">
                <div>
                  <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92] block">Total Interest Payable</span>
                  <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatINR(
                      Math.max(
                        0,
                        currentAmount * (parseFloat(tenureMonths) || 1) - (parseFloat(loanPrincipal) || 0)
                      )
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92] block">Total Repayment Amount</span>
                  <span className="text-xs font-bold tabular-nums text-[#141412] dark:text-[#F6F5F0]">
                    {formatINR(currentAmount * (parseFloat(tenureMonths) || 1))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* D. TAX / GST & DISCOUNT CALCULATOR */}
          {mode === 'tax' && (
            <div className="space-y-4 p-4 sm:p-5 bg-[#F6F5F0] dark:bg-[#1E1D19] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTaxMode('tax')}
                  className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    taxMode === 'tax'
                      ? 'bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110]'
                      : 'bg-white dark:bg-[#141412] text-[#78746B] border border-[#E5E0D4] dark:border-[#2C2A25]'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Add GST / Tax (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaxMode('discount')}
                  className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    taxMode === 'discount'
                      ? 'bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110]'
                      : 'bg-white dark:bg-[#141412] text-[#78746B] border border-[#E5E0D4] dark:border-[#2C2A25]'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Apply Discount (−)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    Base Price (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    {taxMode === 'tax' ? 'GST / Tax Rate (%)' : 'Discount Rate (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={taxMode === 'tax' ? taxPercent : discountPercent}
                    onChange={(e) =>
                      taxMode === 'tax' ? setTaxPercent(e.target.value) : setDiscountPercent(e.target.value)
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Area: Dynamic Insert-Ready Result Card (4-5 Cols on Desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between gap-4 p-5 sm:p-6 bg-[#FAF9F6] dark:bg-[#1E1D19] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E7952] dark:text-[#C5A059]">
                {mode === 'math' && 'Evaluated Total'}
                {mode === 'split' && 'Per Person Share'}
                {mode === 'emi' && 'Monthly EMI'}
                {mode === 'tax' && (taxMode === 'tax' ? 'Final with Tax' : 'Final Discounted')}
              </span>
              <button
                type="button"
                onClick={handleCopyAmount}
                title="Copy to clipboard"
                className="p-1.5 text-[#78746B] hover:text-[#141412] dark:hover:text-[#F6F5F0] rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="font-display tabular-nums text-3xl sm:text-4xl font-extrabold text-[#141412] dark:text-[#F6F5F0] tracking-tight truncate">
              {formatINR(currentAmount)}
            </div>

            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] leading-relaxed">
              Ready to insert into your monthly ledger and synchronize directly with the Google Sheet.
            </p>
          </div>

          {/* 1-Click Insert Actions into Transaction Form */}
          <div className="space-y-2.5 pt-3 border-t border-[#EFECE4] dark:border-[#282622]">
            {/* 1. Insert as Expense */}
            <button
              type="button"
              id="btn-calc-insert-expense"
              onClick={() => handleInsert('Expense')}
              disabled={currentAmount <= 0}
              className="w-full min-h-[46px] px-4 py-2.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-bold rounded-xl flex items-center justify-between shadow-xs transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-400 dark:text-[#111110]" />
                <span>Insert as Expense</span>
              </span>
              <span className="tabular-nums font-mono text-[11px] opacity-90">
                −{formatINR(currentAmount)}
              </span>
            </button>

            {/* 2. Insert as Income */}
            <button
              type="button"
              id="btn-calc-insert-income"
              onClick={() => handleInsert('Income')}
              disabled={currentAmount <= 0}
              className="w-full min-h-[46px] px-4 py-2.5 bg-white dark:bg-[#161614] hover:bg-[#F3F0E8] dark:hover:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-bold rounded-xl flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <span className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-[#2E6F40] dark:text-emerald-400" />
                <span>Insert as Income</span>
              </span>
              <span className="tabular-nums font-mono text-[11px] text-[#2E6F40] dark:text-emerald-400">
                +{formatINR(currentAmount)}
              </span>
            </button>

            {/* 3. Copy Value */}
            <button
              type="button"
              id="btn-calc-copy-value"
              onClick={handleCopyAmount}
              className="w-full min-h-[40px] px-3 py-2 text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied to clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy amount to clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
