/**
 * ============================================================================
 * File: src/components/MobileBottomNav.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Sticky bottom tab bar for mobile viewports (`md:hidden`) with 44x44px+
 *   touch targets and safe-area inset support for iPhone 15 / 15 Pro / SE and
 *   Android devices.
 * ============================================================================
 */

import React from 'react';
import { Home, BarChart2, Plus, CreditCard, User } from 'lucide-react';
import { MobileTab } from '../types';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full max-w-[100vw] bg-[#F6F5F0]/95 dark:bg-[#111110]/95 backdrop-blur-md border-t border-[#E5E0D4] dark:border-[#262521] px-2 sm:px-4 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] transition-colors"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {/* 1. Home */}
        <button
          type="button"
          id="nav-tab-home"
          onClick={() => onTabChange('home')}
          className={`min-h-[46px] flex flex-col items-center justify-center py-1 px-1 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'home'
              ? 'text-[#141412] dark:text-[#C5A059] font-semibold'
              : 'text-[#8A857A] dark:text-[#78746B] font-normal'
          }`}
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 leading-tight">Home</span>
        </button>

        {/* 2. Analytics */}
        <button
          type="button"
          id="nav-tab-analysis"
          onClick={() => onTabChange('analysis')}
          className={`min-h-[46px] flex flex-col items-center justify-center py-1 px-1 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'analysis'
              ? 'text-[#141412] dark:text-[#C5A059] font-semibold'
              : 'text-[#8A857A] dark:text-[#78746B] font-normal'
          }`}
        >
          <BarChart2 className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 leading-tight">Analytics</span>
        </button>

        {/* 3. Center Circular Charcoal & Champagne Gold + Action Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            id="nav-tab-add"
            onClick={() => onTabChange('add')}
            aria-label="Record transaction"
            className="w-12 h-12 rounded-full bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <Plus className="w-6 h-6 stroke-[2.2]" />
          </button>
        </div>

        {/* 4. Cards / Goals */}
        <button
          type="button"
          id="nav-tab-goals"
          onClick={() => onTabChange('goals')}
          className={`min-h-[46px] flex flex-col items-center justify-center py-1 px-1 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'goals'
              ? 'text-[#141412] dark:text-[#C5A059] font-semibold'
              : 'text-[#8A857A] dark:text-[#78746B] font-normal'
          }`}
        >
          <CreditCard className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 leading-tight">Cards</span>
        </button>

        {/* 5. Profile / Settings */}
        <button
          type="button"
          id="nav-tab-settings"
          onClick={() => onTabChange('settings')}
          className={`min-h-[46px] flex flex-col items-center justify-center py-1 px-1 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'text-[#141412] dark:text-[#C5A059] font-semibold'
              : 'text-[#8A857A] dark:text-[#78746B] font-normal'
          }`}
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 leading-tight">Profile</span>
        </button>
      </div>
    </nav>
  );
};
