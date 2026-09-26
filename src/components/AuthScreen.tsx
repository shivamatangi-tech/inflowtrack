/**
 * ============================================================================
 * File: src/components/AuthScreen.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Personal Login, Account Registration, and Password Reset screen.
 *
 * Key Responsibilities:
 *   1. Provides Email + Password Sign-In and Registration via Firebase
 *      Authentication (`inflowtrack-06`).
 *   2. Supports "Remember my logged-in session securely" toggle and "Forgot
 *      password?" email recovery workflow.
 *   3. Displays clear, user-friendly validation and authentication error
 *      messages without exposing tokens or credentials.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Wallet,
  Check,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
  requestPasswordReset,
} from '../services/firebase';
import { TARGET_SPREADSHEET_NAME } from '../services/sheets';
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
        await onAuthSuccess(authResult.user, authResult.accessToken);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="max-w-md w-full">
        {/* Brand Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
              <Wallet className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="text-center mb-5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              inflotrack
            </h1>
            <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-1">
              Track Save Grow
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">
              Personal finance tracker secured by Firebase Authentication &amp; synced with your{' '}
              <strong className="text-slate-700 dark:text-slate-200">{TARGET_SPREADSHEET_NAME}</strong> Sheet &amp; Drive folder.
            </p>
          </div>

          {/* Mode Tabs (Sign In / Create Account) */}
          {viewMode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5">
              <button
                type="button"
                id="tab-auth-login"
                onClick={() => switchMode('login')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-auth-register"
                onClick={() => switchMode('register')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {activeError && (
            <div
              id="auth-error-banner"
              className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-medium text-rose-800 dark:text-rose-300 flex items-start gap-2 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-banner"
              className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-start gap-2 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Email + Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {viewMode === 'register' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1"
                >
                  Your Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    id="auth-display-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Shiva"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
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
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {viewMode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                  >
                    Password
                  </label>
                  {viewMode === 'login' && (
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => switchMode('reset')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
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
                    placeholder={viewMode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                    className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
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
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {viewMode !== 'reset' && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    id="auth-remember-session"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Remember my logged-in session securely</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit-btn"
              disabled={isBusy}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] rounded-xl shadow-xs text-xs sm:text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {viewMode === 'register'
                      ? 'Creating Account...'
                      : viewMode === 'reset'
                      ? 'Sending Reset Link...'
                      : 'Signing In...'}
                  </span>
                </>
              ) : (
                <span>
                  {viewMode === 'register'
                    ? 'Create inflotrack Account'
                    : viewMode === 'reset'
                    ? 'Send Password Reset Email'
                    : 'Sign In to inflotrack'}
                </span>
              )}
            </button>

            {viewMode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}
          </form>

          {/* Security Architecture Highlights */}
          <div className="space-y-2 mt-6 bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="leading-snug text-[11px]">
                <strong className="text-slate-900 dark:text-white">Firebase Auth + UID Isolation:</strong> Every record is bound to your verified Firebase UID on the backend.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="leading-snug text-[11px]">
                <strong className="text-slate-900 dark:text-white">Private Google Sheets Database:</strong> Financial records live in your private spreadsheet — never public.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="leading-snug text-[11px]">
                <strong className="text-slate-900 dark:text-white">Zero Plaintext Secrets:</strong> Passwords, optional PINs, and recovery answers are never stored in plaintext.
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>End-to-End Backend Token Verification</span>
          </div>
        </div>
      </div>
    </div>
  );
};
