/**
 * ============================================================================
 * File: src/components/CalculatorView.tsx
 * Application: inflowtrack — Track Save Grow
 * Purpose:
 *   Interactive financial calculator tab designed for quick calculation and
 *   direct 1-click insertion into the Add Transaction workflow.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Calculator as CalcIcon,
  Delete,
  RotateCcw,
  ArrowRight,
  Plus,
  Percent,
  Divide,
  X,
  Minus,
  Equal,
  Sparkles,
  History,
  Check,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface CalculatorViewProps {
  onInsertIntoTransaction: (amount: number) => void;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  onInsertIntoTransaction,
}) => {
  const [display, setDisplay] = useState<string>('0');
  const [expression, setExpression] = useState<string>('');
  const [history, setHistory] = useState<Array<{ expr: string; result: string }>>([
    { expr: '2500 + 450', result: '2950' },
    { expr: '15000 / 3', result: '5000' },
  ]);
  const [insertedNotice, setInsertedNotice] = useState<string | null>(null);

  const currentNumericValue = (() => {
    try {
      const num = parseFloat(display.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    } catch {
      return 0;
    }
  })();

  const handleDigit = (digit: string) => {
    if (display === '0' || display === 'Error') {
      setDisplay(digit);
    } else {
      setDisplay((prev) => prev + digit);
    }
  };

  const handleOperator = (op: string) => {
    if (display === 'Error') return;
    setExpression((prev) => (prev ? `${prev} ${display} ${op}` : `${display} ${op}`));
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
  };

  const handleBackspace = () => {
    if (display === 'Error' || display.length <= 1) {
      setDisplay('0');
    } else {
      setDisplay((prev) => prev.slice(0, -1));
    }
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay((prev) => prev + '.');
    }
  };

  const evaluateMath = () => {
    try {
      const fullExpr = expression ? `${expression} ${display}` : display;
      // Sanitize expression for safe eval
      const cleanExpr = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/[^0-9+\-*/.() ]/g, '');

      // Evaluate simple arithmetic expression safely
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${cleanExpr})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        const rounded = Math.round(result * 100) / 100;
        const resStr = rounded.toString();
        setHistory((prev) => [{ expr: fullExpr, result: resStr }, ...prev.slice(0, 7)]);
        setDisplay(resStr);
        setExpression('');
      } else {
        setDisplay('Error');
      }
    } catch {
      setDisplay('Error');
    }
  };

  const applyPreset = (action: 'split2' | 'split3' | 'gst18' | 'gst5' | 'add500' | 'add1000' | 'add5000') => {
    const val = currentNumericValue;
    let nextVal = val;
    switch (action) {
      case 'split2':
        nextVal = Math.round((val / 2) * 100) / 100;
        break;
      case 'split3':
        nextVal = Math.round((val / 3) * 100) / 100;
        break;
      case 'gst18':
        nextVal = Math.round(val * 1.18 * 100) / 100;
        break;
      case 'gst5':
        nextVal = Math.round(val * 1.05 * 100) / 100;
        break;
      case 'add500':
        nextVal = val + 500;
        break;
      case 'add1000':
        nextVal = val + 1000;
        break;
      case 'add5000':
        nextVal = val + 5000;
        break;
    }
    setDisplay(nextVal.toString());
  };

  const handleInsert = () => {
    if (currentNumericValue <= 0) return;
    onInsertIntoTransaction(currentNumericValue);
    setInsertedNotice(`Inserted ${formatINR(currentNumericValue)} into transaction!`);
    setTimeout(() => setInsertedNotice(null), 3000);
  };

  return (
    <div className="space-y-5 pb-8 max-w-4xl mx-auto min-w-0">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#161614] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0 border border-[#E5E0D4] dark:border-[#2C2A25]">
            <CalcIcon className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Finance Calculator
            </h1>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Calculate amounts, split bills, evaluate taxes, and insert directly into new transactions
            </p>
          </div>
        </div>

        {/* Primary Action Button: Insert to Transaction */}
        <button
          type="button"
          id="btn-calc-insert-primary"
          onClick={handleInsert}
          disabled={currentNumericValue <= 0}
          className="min-h-[46px] px-5 py-2.5 bg-[#141412] hover:bg-[#282622] dark:bg-[#F6F5F0] dark:hover:bg-[#EAE7DC] text-white dark:text-[#141412] text-xs sm:text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4 text-[#C5A059]" />
          <span>Insert into Transaction ({formatINR(currentNumericValue)})</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {insertedNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{insertedNotice}</span>
        </div>
      )}

      {/* Main Grid: Calculator & Presets + History Tape */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calculator Main Body (2 Columns on Desktop) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#161614] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs space-y-4 min-w-0">
          {/* LCD Display */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F3EF] dark:bg-[#1A1A17] border border-[#E5E0D4] dark:border-[#2C2A25] text-right space-y-1">
            <div className="text-xs text-[#78746B] dark:text-[#9E9B92] min-h-[18px] font-mono tracking-wide truncate">
              {expression || ' '}
            </div>
            <div className="font-mono text-2xl sm:text-3xl md:text-4xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight truncate">
              {display}
            </div>
            <div className="text-[11px] text-[#8E7952] dark:text-[#C5A059] font-medium pt-1">
              Formatted: {formatINR(currentNumericValue)}
            </div>
          </div>

          {/* Quick Presets Row */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] font-semibold text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
              Quick:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('split2')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/50 transition-colors cursor-pointer text-[#141412] dark:text-[#F6F5F0]"
            >
              Split / 2
            </button>
            <button
              type="button"
              onClick={() => applyPreset('split3')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/50 transition-colors cursor-pointer text-[#141412] dark:text-[#F6F5F0]"
            >
              Split / 3
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gst18')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/50 transition-colors cursor-pointer text-[#141412] dark:text-[#F6F5F0]"
            >
              +18% GST
            </button>
            <button
              type="button"
              onClick={() => applyPreset('add500')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/50 transition-colors cursor-pointer text-[#141412] dark:text-[#F6F5F0]"
            >
              + ₹500
            </button>
            <button
              type="button"
              onClick={() => applyPreset('add1000')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059]/50 transition-colors cursor-pointer text-[#141412] dark:text-[#F6F5F0]"
            >
              + ₹1,000
            </button>
          </div>

          {/* Keypad Grid (4 Columns) */}
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5 pt-2">
            {/* Row 1 */}
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#EFECE4] dark:bg-[#22211D] hover:bg-[#E5E0D4] dark:hover:bg-[#2C2A25] text-rose-700 dark:text-rose-400 font-bold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              C
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#EFECE4] dark:bg-[#22211D] hover:bg-[#E5E0D4] dark:hover:bg-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-semibold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const num = currentNumericValue / 100;
                setDisplay(num.toString());
              }}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#EFECE4] dark:bg-[#22211D] hover:bg-[#E5E0D4] dark:hover:bg-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] font-semibold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => handleOperator('÷')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#C5A059]/15 dark:bg-[#C5A059]/20 hover:bg-[#C5A059]/25 text-[#8E7952] dark:text-[#C5A059] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#C5A059]/30"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onClick={() => handleDigit('7')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleDigit('8')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleDigit('9')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              9
            </button>
            <button
              type="button"
              onClick={() => handleOperator('×')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#C5A059]/15 dark:bg-[#C5A059]/20 hover:bg-[#C5A059]/25 text-[#8E7952] dark:text-[#C5A059] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#C5A059]/30"
            >
              ×
            </button>

            {/* Row 3 */}
            <button
              type="button"
              onClick={() => handleDigit('4')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleDigit('5')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleDigit('6')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              6
            </button>
            <button
              type="button"
              onClick={() => handleOperator('−')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#C5A059]/15 dark:bg-[#C5A059]/20 hover:bg-[#C5A059]/25 text-[#8E7952] dark:text-[#C5A059] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#C5A059]/30"
            >
              −
            </button>

            {/* Row 4 */}
            <button
              type="button"
              onClick={() => handleDigit('1')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleDigit('2')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleDigit('3')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              3
            </button>
            <button
              type="button"
              onClick={() => handleOperator('+')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#C5A059]/15 dark:bg-[#C5A059]/20 hover:bg-[#C5A059]/25 text-[#8E7952] dark:text-[#C5A059] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#C5A059]/30"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleDigit('00')}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              00
            </button>
            <button
              type="button"
              onClick={handleDecimal}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#1E1D19] hover:bg-[#F2EFE8] dark:hover:bg-[#25241F] text-[#141412] dark:text-[#F6F5F0] font-bold text-lg flex items-center justify-center transition-all cursor-pointer border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xs"
            >
              .
            </button>
            <button
              type="button"
              onClick={evaluateMath}
              className="min-h-[48px] sm:min-h-[52px] rounded-xl sm:rounded-2xl bg-[#141412] hover:bg-[#282622] dark:bg-[#C5A059] dark:hover:bg-[#D4B36D] text-white dark:text-[#111110] font-bold text-lg flex items-center justify-center transition-all cursor-pointer shadow-xs"
            >
              =
            </button>
          </div>
        </div>

        {/* Right Column: Calculation History Tape & Insertion Shortcuts */}
        <div className="bg-white dark:bg-[#161614] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col justify-between space-y-4 min-w-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E0D4] dark:border-[#282622] pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#C5A059]" />
                <h3 className="text-xs font-bold text-[#141412] dark:text-[#F6F5F0] uppercase tracking-wider">
                  Calculation Tape
                </h3>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[10px] text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#78746B] dark:text-[#9E9B92]">
                No recent calculations. Perform math to see results here.
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#1E1D19] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] text-[#78746B] dark:text-[#9E9B92] font-mono truncate">
                        {item.expr}
                      </div>
                      <div className="font-bold text-[#141412] dark:text-[#F6F5F0] font-mono">
                        {formatINR(parseFloat(item.result) || 0)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDisplay(item.result)}
                        title="Load into display"
                        className="px-2 py-1 bg-white dark:bg-[#282622] rounded-lg text-[10px] font-semibold text-[#141412] dark:text-[#F6F5F0] border border-[#E5E0D4] dark:border-[#383630] hover:border-[#C5A059] transition-colors cursor-pointer"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const val = parseFloat(item.result) || 0;
                          if (val > 0) onInsertIntoTransaction(val);
                        }}
                        title="Insert into new transaction"
                        className="p-1 bg-[#141412] dark:bg-[#F6F5F0] text-white dark:text-[#141412] rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Insert Footer Callout */}
          <div className="p-3.5 rounded-2xl bg-[#FBF9F5] dark:bg-[#1E1D19] border border-[#E5E0D4] dark:border-[#2C2A25] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
              <Sparkles className="w-4 h-4 text-[#C5A059]" />
              <span>Direct Entry Sync</span>
            </div>
            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
              Any calculated figure can be inserted directly into your transaction sheet with 1 tap.
            </p>
            <button
              type="button"
              onClick={handleInsert}
              disabled={currentNumericValue <= 0}
              className="w-full min-h-[44px] py-2 px-3 bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <span>Insert {formatINR(currentNumericValue)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
