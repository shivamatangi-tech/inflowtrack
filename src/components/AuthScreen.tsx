/**
 * ============================================================================
 * File: src/components/AuthScreen.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Split-canvas authentication experience styled in the warm stone (#F4F3EF),
 *   matte obsidian (#181816), and deep olive (#4A5240) aesthetic with Poppins
 *   typography.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
} from 'lucide-react';
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
  requestPasswordReset,
} from '../services/firebase';
import { GoogleUser } from '../types';

interface AuthScreenProps {
  onAuthSuccess?: (user: GoogleUser, accessToken: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

type AuthViewMode = 'login' | 'register' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  isLoading: externalLoading = false,
  errorMessage: externalError,
}) => {
  const [viewMode, setViewMode] = useState<AuthViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isBusy = isSubmitting || externalLoading;
  const activeError = localError || externalError;

  const switchMode = (nextMode: AuthViewMode) => {
    setViewMode(nextMode);
    setLocalError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (viewMode === 'reset') {
      setIsSubmitting(true);
      try {
        const msg = await requestPasswordReset(cleanEmail);
        setSuccessMessage(msg);
      } catch (err: any) {
        setLocalError(err.message || 'Password reset failed. Please verify your email and try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (viewMode === 'register') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please confirm your password.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const authResult =
        viewMode === 'register'
          ? await registerWithEmailPassword(cleanEmail, password, displayName.trim(), rememberMe)
          : await loginWithEmailPassword(cleanEmail, password, rememberMe);

      if (onAuthSuccess) {
        await onAuthSuccess(authResult.user, authResult.token);
      }
    } catch (err: any) {
      setLocalError(
        err.message ||
          (viewMode === 'register'
            ? 'Account registration failed. Please try again.'
            : 'Sign in failed. Please check your email and password.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F3EF] dark:bg-[#121311] text-[#181816] dark:text-[#F4F3EF] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Neobank Showcase Panel (Desktop) */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#EAE8E1] dark:bg-[#181917] p-12 xl:p-16 flex-col justify-between relative overflow-hidden border-r border-[#DFDDD4] dark:border-[#262724]">
        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#262724] shadow-2xs flex items-center justify-center">
              <div className="flex items-center -space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#181816] dark:bg-[#F4F3EF]" />
                <span className="w-3.5 h-3.5 rounded-full bg-[#4A5240] dark:bg-[#8C7355]" />
              </div>
            </div>
            <span className="text-xl font-semibold tracking-tight text-[#181816] dark:text-white">
              inflotrack
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6E6D68] dark:text-[#9E9C94]">
            <span>Track</span>
            <span aria-hidden="true">·</span>
            <span>Save</span>
            <span aria-hidden="true">·</span>
            <span>Grow</span>
          </div>
        </div>

        {/* Center Card Showcase & Balance Preview */}
        <div className="relative z-10 my-auto max-w-xl space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#4A5240] dark:text-[#B8A38A]">
              Personal Finance & Wealth Workspace
            </p>
            <h1
              className="text-3xl xl:text-4xl font-semibold tracking-tight text-[#181816] dark:text-white leading-[1.2]"
              style={{ textWrap: 'balance' }}
            >
              Effortless control over your daily spending, cards, and savings goals.
            </h1>
          </div>

          {/* Aurora-Style Preview Card */}
          <div className="bg-white dark:bg-[#1E1F1D] rounded-3xl p-7 shadow-sm border border-[#E2DFD7] dark:border-[#2C2D2A] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              {/* Mini Matte Black Card */}
              <div className="w-full sm:w-[235px] h-[142px] rounded-2xl bg-gradient-to-br from-[#323330] via-[#1E1F1D] to-[#111210] text-white p-4 flex flex-col justify-between shadow-lg shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/90">
                    ▲ inflotrack
                  </span>
                  <Wifi className="w-3.5 h-3.5 text-white/75 rotate-90" />
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-5 rounded bg-gradient-to-br from-[#D4CFC4] to-[#8C867A]" />
                  <div className="text-[11px] tracking-[0.16em] tabular-nums text-white/90">
                    4532 8901 2345 6789
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-[9px] text-white/60 tracking-wider">
                    PLATINUM LEDGER
                  </span>
                  <span className="text-sm font-bold italic">VISA</span>
                </div>
              </div>

              {/* Total Balance & Monthly Delta */}
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-xs text-[#8A8880] dark:text-[#9E9C94]">Total balance</p>
                  <p className="tabular-nums text-2xl xl:text-3xl font-semibold text-[#181816] dark:text-white mt-0.5">
                    ₹8,04,660.00
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EAE8E1] dark:bg-[#2C2D2A] text-[#4A5240] dark:text-[#B8A38A] font-medium tabular-nums">
                    ↓ 12%
                  </span>
                  <span className="text-[#8A8880] dark:text-[#9E9C94]">
                    spending vs last month
                  </span>
                </div>
                <div className="pt-2 border-t border-[#F0EFEA] dark:border-[#2A2B28] grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#8A8880] block">Inflow</span>
                    <span className="tabular-nums font-semibold text-[#2E7D32] dark:text-emerald-400">
                      +₹1,45,000
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8A8880] block">Outflow</span>
                    <span className="tabular-nums font-semibold text-[#181816] dark:text-white">
                      −₹42,350
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#6E6D68] dark:text-[#9E9C94]">
          <span>inflotrack Workspace</span>
          <span>INR (₹) · Real-time Sheet Sync</span>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-6 py-12 sm:px-12 xl:px-16">
        <div className="w-full max-w-[410px] mx-auto bg-white dark:bg-[#1A1B19] p-7 sm:p-9 rounded-3xl border border-[#E6E4DD] dark:border-[#2A2B28] shadow-xs">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center justify-between mb-6 pb-4 border-b border-[#F0EFEA] dark:border-[#262724]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#F4F3EF] dark:bg-[#262724] flex items-center justify-center">
                <div className="flex items-center -space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#181816] dark:bg-[#F4F3EF]" />
                  <span className="w-3 h-3 rounded-full bg-[#4A5240] dark:bg-[#8C7355]" />
                </div>
              </div>
              <span className="text-lg font-semibold tracking-tight text-[#181816] dark:text-white">
                inflotrack
              </span>
            </div>
            <span className="text-xs text-[#8A8880]">Track · Save · Grow</span>
          </div>

          {/* Form Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[#181816] dark:text-white">
              {viewMode === 'login'
                ? 'Welcome back'
                : viewMode === 'register'
                ? 'Create account'
                : 'Reset password'}
            </h2>
            <p className="text-xs text-[#8A8880] dark:text-[#9E9C94] mt-1.5 leading-relaxed">
              {viewMode === 'login'
                ? 'Sign in to view your balance, analytics, and transactions.'
                : viewMode === 'register'
                ? 'Set up your personal inflotrack account in seconds.'
                : 'Enter your email address to receive a password reset link.'}
            </p>
          </div>

          {/* Soft Stone Segmented Mode Control */}
          {viewMode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#EAE8E1] dark:bg-[#262724] rounded-full mb-6">
              <button
                type="button"
                id="tab-auth-login"
                onClick={() => switchMode('login')}
                className={`py-2 px-3 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'login'
                    ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs font-semibold'
                    : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-auth-register"
                onClick={() => switchMode('register')}
                className={`py-2 px-3 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'register'
                    ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs font-semibold'
                    : 'text-[#6E6D68] dark:text-[#9E9C94] hover:text-[#181816] dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error Banner */}
          {activeError && (
            <div
              id="auth-error-banner"
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 rounded-2xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div
              id="auth-success-banner"
              className="mb-5 p-3.5 bg-[#EDF3EC] dark:bg-emerald-950/40 border border-[#C6DEC3] dark:border-emerald-900/70 rounded-2xl text-xs font-medium text-[#2E7D32] dark:text-emerald-300 flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {viewMode === 'register' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] mb-1.5"
                >
                  Full name <span className="text-[#8A8880] font-normal">(optional)</span>
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alexander Kosov"
                  className="w-full px-4 py-2.5 text-sm bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] text-[#181816] dark:text-white placeholder:text-[#9E9C94] transition-all"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] mb-1.5"
              >
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLocalError(null);
                }}
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 text-sm bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] text-[#181816] dark:text-white placeholder:text-[#9E9C94] transition-all"
              />
            </div>

            {viewMode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94]"
                  >
                    Password
                  </label>
                  {viewMode === 'login' && (
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-medium text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={viewMode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder={viewMode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
                    className="w-full pl-4 pr-10 py-2.5 text-sm bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] text-[#181816] dark:text-white placeholder:text-[#9E9C94] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-2.5 p-0.5 text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'register' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-[#6E6D68] dark:text-[#9E9C94] mb-1.5"
                >
                  Confirm password
                </label>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setLocalError(null);
                  }}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-2.5 text-sm bg-[#F4F3EF]/80 dark:bg-[#262724] border border-[#E6E4DD] dark:border-[#343531] rounded-2xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:border-[#4A5240] text-[#181816] dark:text-white placeholder:text-[#9E9C94] transition-all"
                />
              </div>
            )}

            {viewMode !== 'reset' && (
              <div className="flex items-center pt-1">
                <label className="flex items-center gap-2.5 text-xs text-[#6E6D68] dark:text-[#9E9C94] font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="auth-remember-session"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#C7C3B8] text-[#181816] focus:ring-[#4A5240] cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit-btn"
              disabled={isBusy}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-[#181816] hover:bg-[#2C2D2A] dark:bg-[#F4F3EF] dark:hover:bg-[#E6E4DD] text-white dark:text-[#181816] active:scale-[0.99] rounded-full text-sm font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {viewMode === 'register'
                      ? 'Creating account...'
                      : viewMode === 'reset'
                      ? 'Sending reset link...'
                      : 'Signing in...'}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {viewMode === 'register'
                      ? 'Create Account'
                      : viewMode === 'reset'
                      ? 'Send Reset Link'
                      : 'Sign In'}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>

            {viewMode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full py-2 text-xs font-medium text-[#6E6D68] hover:text-[#181816] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
