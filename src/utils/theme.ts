/**
 * ============================================================================
 * File: src/utils/theme.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Manages application color theme persistence and DOM class toggling for
 *   Light Mode, Dark Mode, and System Default preference.
 *
 * Key Responsibilities:
 *   1. getStoredTheme() / getInitialTheme(): Reads the user's saved theme
 *      preference from localStorage (fallback: 'system').
 *   2. applyTheme(): Applies or removes the `.dark` class and `data-theme`
 *      attribute on `document.documentElement` (`<html>`) and updates native
 *      browser `colorScheme`.
 * ============================================================================
 */

import { ThemeMode } from '../types';

const THEME_KEY = 'finvexa-theme';

export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (e) {
    // LocalStorage might be disabled
  }
  return 'system';
}

export const getInitialTheme = getStoredTheme;

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark);

  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // Ignore storage errors
  }
}
