/**
 * ============================================================================
 * File: src/components/MobileBottomNav.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Sticky bottom tab bar for mobile viewports (`md:hidden`) matching the
 *   Aurora reference image: Home, Analytics, a prominent circular matte-black
 *   `+` button in the center, Cards/Goals, and Profile/Settings.
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1A1B19]/95 backdrop-blur-md border-t border-[#E6E4DD] dark:border-[#2A2B28] px-4 py-2 transition-colors"
    >
      <div className="flex items-center justify-between max-w-md mx-auto">
        {/* 1. Home */}
        <button
          type="button"
          id="nav-tab-home"
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center py-1 px-3 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'home'
              ? 'text-[#181816] dark:text-white font-semibold'
              : 'text-[#9E9C94] dark:text-[#6E6D68] font-normal'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-1">Home</span>
        </button>

        {/* 2. Analytics */}
        <button
          type="button"
          id="nav-tab-analysis"
          onClick={() => onTabChange('analysis')}
          className={`flex flex-col items-center justify-center py-1 px-3 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'analysis'
              ? 'text-[#181816] dark:text-white font-semibold'
              : 'text-[#9E9C94] dark:text-[#6E6D68] font-normal'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] mt-1">Analytics</span>
        </button>

        {/* 3. Center Circular Matte-Black + Action Button */}
        <button
          type="button"
          id="nav-tab-add"
          onClick={() => onTabChange('add')}
          aria-label="Add transaction"
          className="w-12 h-12 rounded-full bg-[#181816] dark:bg-[#F4F3EF] text-white dark:text-[#181816] flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* 4. Cards / Goals */}
        <button
          type="button"
          id="nav-tab-goals"
          onClick={() => onTabChange('goals')}
          className={`flex flex-col items-center justify-center py-1 px-3 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'goals'
              ? 'text-[#181816] dark:text-white font-semibold'
              : 'text-[#9E9C94] dark:text-[#6E6D68] font-normal'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] mt-1">Cards</span>
        </button>

        {/* 5. Profile / Settings */}
        <button
          type="button"
          id="nav-tab-settings"
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center justify-center py-1 px-3 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'text-[#181816] dark:text-white font-semibold'
              : 'text-[#9E9C94] dark:text-[#6E6D68] font-normal'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-1">Profile</span>
        </button>
      </div>
    </nav>
  );
};
