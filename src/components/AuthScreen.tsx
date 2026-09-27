/**
 * ============================================================================
 * File: src/components/AuthScreen.tsx
 * Application: inflowtrack — Track Save Grow
 * Purpose:
 *   Authentication screen for inflowtrack (Money In Out Tracker).
 *   Allows users to securely sign in with Email & Password, sign in quickly
 *   with an Easy 4-digit PIN stored in Firebase, register a new account,
 *   or recover their password.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wallet,
  ShieldCheck,
  FileSpreadsheet,
  PieChart,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import {
  loginWithEmailPassword,
  loginWithPin,
  registerWithEmailPassword,
  requestPasswordReset,
} from '../services/firebase';
import { GoogleUser } from '../types';

interface AuthScreenProps {
  onAuthSuccess?: (user: GoogleUser, accessToken: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

type AuthViewMode = 'login' | 'pin' | 'register' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  isLoading: externalLoading = false,
  errorMessage: externalError,
}) => {
  // Check if there is a remembered email or active PIN preference
  const savedEmail = (() => {
    try {
      return localStorage.getItem('inflowtrack_saved_email') || '';
    } catch {
      return '';
    }
  })();

  const hasPinPreferred = (() => {
    try {
      return localStorage.getItem('inflowtrack_easy_pin_enabled') === 'true' && Boolean(savedEmail);
    } catch {
      return false;
    }
  })();

  const [viewMode, setViewMode] = useState<AuthViewMode>(hasPinPreferred ? 'pin' : 'login');
  const [email, setEmail] = useState<string>(savedEmail);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

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

  const handlePinDigitClick = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setLocalError(null);
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setLocalError(null);
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
        setLocalError(err.message || 'Password reset failed. Please verify your email.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (viewMode === 'pin') {
      const cleanPin = pin.trim();
      if (!cleanPin || cleanPin.length < 4) {
        setLocalError('Please enter your 4-digit Easy Login PIN.');
        return;
      }

      setIsSubmitting(true);
      try {
        const authResult = await loginWithPin(cleanEmail, cleanPin, rememberMe);
        if (rememberMe) {
          try {
            localStorage.setItem('inflowtrack_saved_email', cleanEmail);
            localStorage.setItem('inflowtrack_easy_pin_enabled', 'true');
          } catch {
            // Ignore storage write issues
          }
        }
        if (onAuthSuccess) {
          await onAuthSuccess(authResult.user, authResult.token);
        }
      } catch (err: any) {
        setLocalError(
          err.message ||
            'Easy PIN sign-in failed. Please verify your PIN or sign in with your password.'
        );
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
        setLocalError('Passwords do not match. Please verify your password.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const authResult =
        viewMode === 'register'
          ? await registerWithEmailPassword(cleanEmail, password, displayName.trim(), rememberMe)
          : await loginWithEmailPassword(cleanEmail, password, rememberMe);

      if (rememberMe) {
        try {
          localStorage.setItem('inflowtrack_saved_email', cleanEmail);
        } catch {
          // Ignore
        }
      }

      if (onAuthSuccess) {
        await onAuthSuccess(authResult.user, authResult.token);
      }
    } catch (err: any) {
      setLocalError(
        err.message ||
          (viewMode === 'register'
            ? 'Account registration failed. Please try again.'
            : 'Sign in failed. Please check your credentials.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F3EF] dark:bg-[#121311] text-[#181816] dark:text-[#F4F3EF] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Header bar with clean logo */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#181816] dark:bg-white text-white dark:text-[#181816] flex items-center justify-center shadow-xs">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#181816] dark:text-white">
              inflowtrack
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium text-[#78756E] dark:text-[#9C9990] border-l border-[#DCD9D0] dark:border-[#2C2A25] pl-2">
              Track · Save · Grow
            </span>
          </div>
        </div>
      </header>

      {/* Main Auth Container */}
      <main className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white dark:bg-[#1A1A18] rounded-2xl border border-[#E5E2DA] dark:border-[#2C2A26] shadow-sm p-6 sm:p-8">
          {/* Card Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#181816] dark:text-white flex items-center justify-center gap-2">
              {viewMode === 'login' && 'Welcome to inflowtrack'}
              {viewMode === 'pin' && (
                <>
                  <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Easy PIN Login</span>
                </>
              )}
              {viewMode === 'register' && 'Create your account'}
              {viewMode === 'reset' && 'Reset your password'}
            </h1>
            <p className="text-xs text-[#78756E] dark:text-[#9C9990] mt-1.5 leading-relaxed">
              {viewMode === 'login' && 'Sign in to manage your income, expenses, and savings.'}
              {viewMode === 'pin' && 'Enter your 4-digit PIN to sign in directly without typing your password.'}
              {viewMode === 'register' && 'Get started with your personal Google Sheets money tracker.'}
              {viewMode === 'reset' && 'Enter your email to receive a password reset link.'}
            </p>
          </div>

          {/* Mode Switcher */}
          {viewMode !== 'reset' && (
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F0EDE5] dark:bg-[#252522] rounded-xl mb-6">
              <button
                type="button"
                id="tab-auth-login"
                onClick={() => switchMode('login')}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
                  viewMode === 'login'
                    ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs'
                    : 'text-[#78756E] dark:text-[#9C9990] hover:text-[#181816] dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-auth-pin"
                onClick={() => switchMode('pin')}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-center truncate ${
                  viewMode === 'pin'
                    ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs'
                    : 'text-[#78756E] dark:text-[#9C9990] hover:text-[#181816] dark:hover:text-white'
                }`}
              >
                <KeyRound className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Easy PIN</span>
              </button>
              <button
                type="button"
                id="tab-auth-register"
                onClick={() => switchMode('register')}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
                  viewMode === 'register'
                    ? 'bg-white dark:bg-[#181816] text-[#181816] dark:text-white shadow-2xs'
                    : 'text-[#78756E] dark:text-[#9C9990] hover:text-[#181816] dark:hover:text-white'
                }`}
              >
                Register
              </button>
            </div>
          )}

          {/* Error Message */}
          {activeError && (
            <div
              id="auth-error-banner"
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{activeError}</span>
                {viewMode === 'pin' && activeError.includes('not configured') && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs font-bold text-rose-800 dark:text-rose-200 underline cursor-pointer"
                    >
                      Sign in with password to set up PIN in Settings →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div
              id="auth-success-banner"
              className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {viewMode === 'register' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5"
                >
                  Full Name <span className="text-[#8A8880] font-normal">(optional)</span>
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#181816] dark:focus:ring-white/20 text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95]"
                >
                  Email Address
                </label>
                {viewMode === 'pin' && savedEmail && email === savedEmail && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                    Remembered Account
                  </span>
                )}
              </div>
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
                className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#181816] dark:focus:ring-white/20 text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
              />
            </div>

            {/* Easy PIN Input Mode */}
            {viewMode === 'pin' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-pin"
                    className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95]"
                  >
                    Easy Login PIN (4-8 digits)
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs font-medium text-[#181816] dark:text-[#F4F3EF] hover:underline cursor-pointer"
                  >
                    Use password instead
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="auth-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    autoFocus
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ''));
                      setLocalError(null);
                    }}
                    placeholder="••••"
                    className="w-full pl-3.5 pr-10 py-3 text-lg tracking-[0.3em] font-mono text-center bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-400 text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-3 top-3 p-1 text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Quick Keypad Helper */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 max-w-[240px] mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handlePinDigitClick(digit)}
                      className="py-2 bg-[#F2EFE8] dark:bg-[#242320] hover:bg-[#E6E2D8] dark:hover:bg-[#2E2C28] text-sm font-semibold rounded-lg text-[#181816] dark:text-white transition-colors cursor-pointer select-none active:scale-95"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="py-2 text-[11px] font-semibold text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinDigitClick('0')}
                    className="py-2 bg-[#F2EFE8] dark:bg-[#242320] hover:bg-[#E6E2D8] dark:hover:bg-[#2E2C28] text-sm font-semibold rounded-lg text-[#181816] dark:text-white transition-colors cursor-pointer select-none active:scale-95"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinBackspace}
                    className="py-2 text-[11px] font-semibold text-[#8A8880] hover:text-rose-600 transition-colors cursor-pointer flex items-center justify-center"
                    title="Backspace"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}

            {/* Password Input Mode */}
            {viewMode !== 'reset' && viewMode !== 'pin' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95]"
                  >
                    Password
                  </label>
                  {viewMode === 'login' && (
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-medium text-[#181816] dark:text-[#F4F3EF] hover:underline cursor-pointer"
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
                    placeholder={viewMode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#181816] dark:focus:ring-white/20 text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 p-0.5 text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
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
                  className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5"
                >
                  Confirm Password
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
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#181816] dark:focus:ring-white/20 text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                />
              </div>
            )}

            {viewMode !== 'reset' && (
              <div className="flex items-center pt-0.5">
                <label className="flex items-center gap-2 text-xs text-[#5E5B52] dark:text-[#A39F95] font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="auth-remember-session"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#C7C3B8] text-[#181816] focus:ring-[#181816] cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit-btn"
              disabled={isBusy}
              className={`w-full min-h-[46px] flex items-center justify-center gap-2 py-3 px-5 text-white font-semibold text-xs rounded-xl shadow-xs active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2 ${
                viewMode === 'pin'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-[#181816] hover:bg-[#2C2A25] dark:bg-white dark:hover:bg-[#EAE8E2] dark:text-[#181816]'
              }`}
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {viewMode === 'register'
                      ? 'Creating account...'
                      : viewMode === 'reset'
                      ? 'Sending reset link...'
                      : viewMode === 'pin'
                      ? 'Verifying PIN...'
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
                      : viewMode === 'pin'
                      ? 'Sign In with PIN'
                      : 'Sign In to Tracker'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {viewMode === 'pin' && (
              <p className="text-[11px] text-center text-[#78756E] dark:text-[#9C9990] pt-1">
                Haven't configured a PIN yet?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-[#181816] dark:text-white underline cursor-pointer"
                >
                  Sign in with password
                </button>
                , then enable Easy PIN in Settings.
              </p>
            )}

            {viewMode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full min-h-[42px] py-2 text-xs font-medium text-[#78756E] dark:text-[#9C9990] hover:text-[#181816] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>
            )}
          </form>
        </div>

        {/* Feature Badges below Card */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#1A1A18]/60 border border-[#E5E2DA]/80 dark:border-[#2C2A26]/80 flex flex-col items-center">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1.5" />
            <span className="text-[11px] font-semibold text-[#181816] dark:text-white">
              Google Sheets
            </span>
            <span className="text-[10px] text-[#78756E] dark:text-[#9C9990] mt-0.5">
              Direct cloud sync
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#1A1A18]/60 border border-[#E5E2DA]/80 dark:border-[#2C2A26]/80 flex flex-col items-center">
            <PieChart className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-1.5" />
            <span className="text-[11px] font-semibold text-[#181816] dark:text-white">
              Income & Expense
            </span>
            <span className="text-[10px] text-[#78756E] dark:text-[#9C9990] mt-0.5">
              Category analytics
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#1A1A18]/60 border border-[#E5E2DA]/80 dark:border-[#2C2A26]/80 flex flex-col items-center">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 mb-1.5" />
            <span className="text-[11px] font-semibold text-[#181816] dark:text-white">
              Easy PIN Login
            </span>
            <span className="text-[10px] text-[#78756E] dark:text-[#9C9990] mt-0.5">
              Firebase credentials
            </span>
          </div>
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center py-4 border-t border-[#E5E2DA] dark:border-[#2C2A26]/60">
        <p className="text-[11px] text-[#78756E] dark:text-[#9C9990]">
          inflowtrack — Money In Out Tracker · Track, Save, and Grow
        </p>
      </footer>
    </div>
  );
};
