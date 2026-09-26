/**
 * ============================================================================
 * File: src/utils/targets.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Manages user-configurable financial targets (Savings Target, Emergency
 *   Fund Target, and Monthly Expense Budget) and computes goal fulfillment
 *   percentages for the Goals & Reserves view.
 *
 * Key Responsibilities:
 *   1. syncTargetsFromSheet(): Syncs target amounts retrieved from the user's
 *      Google Sheet (`Budgets_And_Recurring` tab) into local state.
 *   2. getSavingsTarget() / setSavingsTarget() & getEmergencyFundTarget() /
 *      setEmergencyFundTarget(): Reads and updates target thresholds.
 *   3. calculateTargetProgress() & calculateCombinedCapitalPreservedProgress():
 *      Computes percentage completion, capped progress bar widths (0–100%),
 *      and remaining amounts needed to reach financial goals.
 * ============================================================================
 */

import { BudgetConfig } from '../types';

const SAVINGS_TARGET_KEY = 'finvexa_savings_target';
const EMERGENCY_TARGET_KEY = 'finvexa_emergency_target';
const MONTHLY_BUDGET_KEY = 'finvexa_monthly_budget';

export const DEFAULT_SAVINGS_TARGET = 100000; // ₹1,00,000
export const DEFAULT_EMERGENCY_TARGET = 50000; // ₹50,000
export const DEFAULT_MONTHLY_BUDGET = 50000; // ₹50,000

/**
 * Synchronizes budget & target configuration read from the user's Google Sheet.
 */
export function syncTargetsFromSheet(config?: Partial<BudgetConfig>): void {
  if (!config) return;
  try {
    if (typeof config.savingsTarget === 'number' && config.savingsTarget > 0) {
      localStorage.setItem(SAVINGS_TARGET_KEY, String(config.savingsTarget));
    }
    if (typeof config.emergencyFundTarget === 'number' && config.emergencyFundTarget > 0) {
      localStorage.setItem(EMERGENCY_TARGET_KEY, String(config.emergencyFundTarget));
    }
    if (typeof config.monthlyExpenseBudget === 'number' && config.monthlyExpenseBudget >= 0) {
      localStorage.setItem(MONTHLY_BUDGET_KEY, String(config.monthlyExpenseBudget));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get configured Savings Target (defaults to ₹1,00,000)
 */
export function getSavingsTarget(): number {
  try {
    const val = localStorage.getItem(SAVINGS_TARGET_KEY);
    if (!val) return DEFAULT_SAVINGS_TARGET;
    const num = parseFloat(val);
    return isNaN(num) || num <= 0 ? DEFAULT_SAVINGS_TARGET : num;
  } catch {
    return DEFAULT_SAVINGS_TARGET;
  }
}

/**
 * Set and persist Savings Target locally
 */
export function setSavingsTarget(amount: number): void {
  try {
    if (amount > 0) {
      localStorage.setItem(SAVINGS_TARGET_KEY, amount.toString());
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Get configured Emergency Fund Target (defaults to ₹50,000)
 */
export function getEmergencyFundTarget(): number {
  try {
    const val = localStorage.getItem(EMERGENCY_TARGET_KEY);
    if (!val) return DEFAULT_EMERGENCY_TARGET;
    const num = parseFloat(val);
    return isNaN(num) || num <= 0 ? DEFAULT_EMERGENCY_TARGET : num;
  } catch {
    return DEFAULT_EMERGENCY_TARGET;
  }
}

/**
 * Set and persist Emergency Fund Target locally
 */
export function setEmergencyFundTarget(amount: number): void {
  try {
    if (amount > 0) {
      localStorage.setItem(EMERGENCY_TARGET_KEY, amount.toString());
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Calculates progress percentage toward a target
 */
export function calculateTargetProgress(achieved: number, target: number): {
  percentage: number;
  cappedPercentage: number;
  remaining: number;
} {
  if (!target || target <= 0) {
    return { percentage: 0, cappedPercentage: 0, remaining: 0 };
  }
  const ratio = (achieved / target) * 100;
  const percentage = Math.round(ratio);
  const cappedPercentage = Math.min(100, Math.max(0, percentage));
  const remaining = Math.max(0, target - achieved);
  return { percentage, cappedPercentage, remaining };
}

/**
 * Calculates combined progress toward combined Savings + Emergency Fund targets
 */
export function calculateCombinedCapitalPreservedProgress(
  savingsAchieved: number,
  emergencyAchieved: number,
  savingsTarget: number,
  emergencyTarget: number
): {
  combinedAchieved: number;
  combinedTarget: number;
  percentage: number;
  cappedPercentage: number;
  remaining: number;
} {
  const combinedAchieved = Math.max(0, savingsAchieved) + Math.max(0, emergencyAchieved);
  const combinedTarget = Math.max(1, savingsTarget + emergencyTarget);
  const ratio = (combinedAchieved / combinedTarget) * 100;
  const percentage = Math.round(ratio);
  const cappedPercentage = Math.min(100, Math.max(0, percentage));
  const remaining = Math.max(0, combinedTarget - combinedAchieved);

  return {
    combinedAchieved,
    combinedTarget,
    percentage,
    cappedPercentage,
    remaining,
  };
}
