/**
 * ============================================================================
 * File: src/utils/categoryIcons.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Provides the "Top Up / Withdraw" circular stone & obsidian icon badge
 *   system for Transaction Types, Income Categories, Expense Categories,
 *   and Other Categories (Savings, Emergency Fund, Transfer, Lent, Borrowed).
 * ============================================================================
 */

import React from 'react';
import {
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  PieChart,
  ShieldCheck,
  Briefcase,
  Laptop,
  Building2,
  Award,
  Percent,
  Utensils,
  ShoppingBasket,
  Home,
  Zap,
  Droplets,
  Wifi,
  Car,
  Fuel,
  ShoppingBag,
  Film,
  HeartPulse,
  GraduationCap,
  Receipt,
  TrendingUp,
  Landmark,
  Repeat,
  BarChart2,
  Gem,
  Umbrella,
  Wallet,
  Shield,
  Banknote,
  CreditCard,
  RefreshCw,
  HandCoins,
  Tag,
} from 'lucide-react';
import { TransactionType } from '../types';

export type CategoryGroupKey = 'income' | 'expense' | 'other';

/**
 * Returns a crisp Lucide icon for any transaction type in the Top Up / Withdraw badge style.
 */
export function getTransactionTypeIcon(type: TransactionType, className = 'w-3.5 h-3.5 stroke-[2.3]'): React.ReactNode {
  switch (type) {
    case 'Income':
      return <Plus className={className} />;
    case 'Expense':
      return <ArrowDown className={className} />;
    case 'Transfer':
      return <ArrowUp className={className} />;
    case 'Savings':
      return <PieChart className={className} />;
    case 'Emergency Fund':
      return <ShieldCheck className={className} />;
    case 'Lent':
      return <ArrowUpRight className={className} />;
    case 'Borrowed':
      return <ArrowDownLeft className={className} />;
    case 'Lent & Borrowed':
      return <ArrowLeftRight className={className} />;
    default:
      return <Tag className={className} />;
  }
}

/**
 * Returns a semantic Lucide icon for any Income, Expense, or Other category.
 */
export function getCategoryIcon(
  category: string,
  fallbackType?: TransactionType,
  className = 'w-3.5 h-3.5 stroke-[2.2]'
): React.ReactNode {
  const key = (category || '').trim().toLowerCase();

  // Income Categories
  if (key.includes('salary') || key.includes('payroll')) return <Briefcase className={className} />;
  if (key.includes('freelance') || key.includes('consulting')) return <Laptop className={className} />;
  if (key.includes('business') || key.includes('company')) return <Building2 className={className} />;
  if (key.includes('bonus') || key.includes('reward') || key.includes('gift')) return <Award className={className} />;
  if (key.includes('interest') || key.includes('dividend')) return <Percent className={className} />;
  if (key.includes('other income')) return <Plus className={className} />;

  // Expense Categories
  if (key.includes('food') || key.includes('dining') || key.includes('restaurant')) return <Utensils className={className} />;
  if (key.includes('grocer') || key.includes('supermarket') || key.includes('mart')) return <ShoppingBasket className={className} />;
  if (key.includes('rent') || key.includes('house') || key.includes('home') || key.includes('maintenance')) return <Home className={className} />;
  if (key.includes('electric') || key.includes('power') || key.includes('utility')) return <Zap className={className} />;
  if (key.includes('water') || key.includes('gas')) return <Droplets className={className} />;
  if (key.includes('internet') || key.includes('wifi') || key.includes('broadband') || key.includes('phone') || key.includes('mobile')) return <Wifi className={className} />;
  if (key.includes('transport') || key.includes('cab') || key.includes('uber') || key.includes('travel') || key.includes('metro')) return <Car className={className} />;
  if (key.includes('fuel') || key.includes('petrol') || key.includes('diesel')) return <Fuel className={className} />;
  if (key.includes('shop') || key.includes('cloth') || key.includes('apparel')) return <ShoppingBag className={className} />;
  if (key.includes('entertain') || key.includes('movie') || key.includes('subscription')) return <Film className={className} />;
  if (key.includes('medic') || key.includes('health') || key.includes('hospital') || key.includes('pharma')) return <HeartPulse className={className} />;
  if (key.includes('educat') || key.includes('course') || key.includes('school') || key.includes('tuition')) return <GraduationCap className={className} />;
  if (key.includes('bill') || key.includes('emi') || key.includes('recharge')) return <Receipt className={className} />;
  if (key.includes('other expense')) return <ArrowDown className={className} />;

  // Other Categories: Savings, Emergency Fund, Transfer, Lent & Borrowed
  if (key.includes('mutual fund') || key.includes('sip') || key.includes('index')) return <TrendingUp className={className} />;
  if (key.includes('fixed deposit') || key.includes('fd') || key.includes('bank loan')) return <Landmark className={className} />;
  if (key.includes('recurring deposit') || key.includes('rd')) return <Repeat className={className} />;
  if (key.includes('stock') || key.includes('equity') || key.includes('share')) return <BarChart2 className={className} />;
  if (key.includes('gold') || key.includes('silver') || key.includes('metal')) return <Gem className={className} />;
  if (key.includes('ppf') || key.includes('epf') || key.includes('provident')) return <ShieldCheck className={className} />;
  if (key.includes('retire') || key.includes('pension') || key.includes('nps')) return <Umbrella className={className} />;
  if (key.includes('liquid') || key.includes('wallet')) return <Wallet className={className} />;
  if (key.includes('emergency') || key.includes('reserve') || key.includes('contingency')) return <Shield className={className} />;
  if (key.includes('cash')) return <Banknote className={className} />;
  if (key.includes('credit card')) return <CreditCard className={className} />;
  if (key.includes('self transfer') || key.includes('repayment')) return <RefreshCw className={className} />;
  if (key.includes('transfer')) return <ArrowUp className={className} />;
  if (key.includes('lent') || key.includes('loan given') || key.includes('advance given')) return <ArrowUpRight className={className} />;
  if (key.includes('borrow') || key.includes('loan taken') || key.includes('advance taken')) return <ArrowDownLeft className={className} />;

  if (fallbackType) {
    return getTransactionTypeIcon(fallbackType, className);
  }
  return <HandCoins className={className} />;
}

interface TopUpWithdrawIconBadgeProps {
  icon: React.ReactNode;
  shape?: 'square' | 'circle';
  isSelected?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Renders the signature "Top Up / Withdraw" circular stone outer button with
 * the dark obsidian inner icon badge.
 */
export const TopUpWithdrawIconBadge: React.FC<TopUpWithdrawIconBadgeProps> = ({
  icon,
  shape = 'circle',
  isSelected = false,
  size = 'md',
}) => {
  const outerSize =
    size === 'sm'
      ? 'w-10 h-10 sm:w-11 sm:h-11'
      : 'w-11 h-11 sm:w-12 sm:h-12';
  const innerShape = shape === 'square' ? 'rounded-md' : 'rounded-full';

  return (
    <div
      className={`${outerSize} rounded-full flex items-center justify-center transition-all active:scale-95 ${
        isSelected
          ? 'bg-[#181816] dark:bg-[#F4F3EF] ring-2 ring-[#4A5240] dark:ring-[#B8A38A] ring-offset-2 ring-offset-white dark:ring-offset-[#1A1B19] shadow-sm'
          : 'bg-[#DBD9D0] hover:bg-[#CECBC0] dark:bg-[#282926] dark:hover:bg-[#343531]'
      }`}
    >
      <div
        className={`w-5 h-5 ${innerShape} flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-[#F4F3EF]'
            : 'bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816]'
        }`}
      >
        {icon}
      </div>
    </div>
  );
};
