/**
 * ============================================================================
 * File: src/components/AuthScreen.tsx
 * Application: inflowtrack — Track Save Grow
 * Purpose:
 *   Clean, frictionless, modern authentication screen.
 *   Removes unnecessary PIN keypads and complicated login options.
 *   Supports direct 1-click Google Sign-In and standard Username/Password
 *   with automatic Google Sheets API initialization upon sign-in.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  loginWithUsernameAndPassword,
  registerWithUsernameAndPassword,
  signInWithGoogle,
  connectGoogleAccount,
  getGoogleAccessToken,
} from '../services/firebase';
import { GoogleUser } from '../types';

interface AuthScreenProps {
  onAuthSuccess?: (user: GoogleUser, accessToken: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

type AuthMode = 'signin' | 'register';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  isLoading: externalLoading = false,
  errorMessage: externalError,
}) => {
  const savedUsername = (() => {
    try {
      return (
        localStorage.getItem('inflowtrack_saved_username') ||
        localStorage.getItem('inflowtrack_saved_email') ||
        ''
      );
    } catch {
      return '';
    }
  })();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>(savedUsername);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isBusy = isSubmitting || isGoogleConnecting || externalLoading;
  const activeError = localError || externalError;

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setLocalError(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  /**
   * 1-Click Google Sign-In: Authenticates user and gets Google Sheets access in 1 click
   */
  const handleGoogleSignIn = async () => {
    setIsGoogleConnecting(true);
    setLocalError(null);
    setSuccessMessage(null);

    try {
      const res = await signInWithGoogle();
      setSuccessMessage('Successfully connected with Google! Loading your workspace...');
      if (onAuthSuccess) {
        await onAuthSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  /**
   * Username / Password Sign In with Automatic Google Sheets Initialization
   */
  const handleUsernamePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    const cleanIdentifier = usernameOrEmail.trim();
    if (!cleanIdentifier) {
      setLocalError('Please enter your username or email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (cleanIdentifier.length < 3) {
        setLocalError('Username must be at least 3 characters long.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please verify your password.');
        return;
      }

      setIsSubmitting(true);
      try {
        const regResult = await registerWithUsernameAndPassword(
          cleanIdentifier,
          password,
          displayName.trim() || undefined,
          rememberMe
        );

        setSuccessMessage('Account created successfully! Initializing workspace...');

        if (onAuthSuccess) {
          await onAuthSuccess(regResult.user, regResult.token);
        }
      } catch (err: any) {
        setLocalError(err.message || 'Registration failed. This username may already be in use.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Sign In Mode
    setIsSubmitting(true);
    try {
      const authResult = await loginWithUsernameAndPassword(
        cleanIdentifier,
        password,
        rememberMe
      );

      if (onAuthSuccess) {
        await onAuthSuccess(authResult.user, authResult.token);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Incorrect username or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F3EF] dark:bg-[#121311] text-[#181816] dark:text-[#F4F3EF] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8 space-y-2">
          <div className="inline-flex items-center justify-center gap-2.5 px-3.5 py-1 rounded-full bg-[#EAE7DC] dark:bg-[#201F1B] border border-[#DDD8CA] dark:border-[#2C2A25] text-xs font-semibold text-[#8E7952] dark:text-[#C5A059] mb-2 tracking-wide uppercase">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Track · Save · Grow</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#141412] dark:text-[#F6F5F0]">
            inflowtrack
          </h1>
          <p className="text-xs sm:text-sm text-[#78746B] dark:text-[#9E9B92] max-w-xs mx-auto">
            Personal income, expense, and savings tracker synchronized with your Google Sheet
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-[#181816] border border-[#E5E0D4] dark:border-[#282622] rounded-3xl p-6 sm:p-8 shadow-xs transition-colors space-y-6">
          {/* 1. Fast 1-Click Google Sign-In */}
          <div>
            <button
              type="button"
              id="btn-auth-google-signin"
              onClick={handleGoogleSignIn}
              disabled={isBusy}
              className="w-full min-h-[48px] px-4 py-3 bg-[#FAF8F5] dark:bg-[#201F1B] hover:bg-[#F2EFE8] dark:hover:bg-[#282622] border border-[#D5D0C5] dark:border-[#383630] rounded-2xl flex items-center justify-center gap-3 text-sm font-semibold text-[#181816] dark:text-[#F4F3EF] transition-all cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-60"
            >
              {isGoogleConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
            <p className="text-[11px] text-center text-[#78746B] dark:text-[#9E9B92] mt-1.5">
              1-tap sign-in with automatic Google Sheets bidirectional sync
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E5E0D4] dark:border-[#282622] w-full" />
            <span className="bg-white dark:bg-[#181816] px-3 text-[11px] font-medium text-[#8E7952] dark:text-[#C5A059] uppercase tracking-wider shrink-0">
              or continue with account
            </span>
            <div className="border-t border-[#E5E0D4] dark:border-[#282622] w-full" />
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#F4F3EF] dark:bg-[#201F1B] rounded-2xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <button
              type="button"
              id="tab-auth-signin"
              onClick={() => handleModeChange('signin')}
              className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs font-bold'
                  : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-auth-register"
              onClick={() => handleModeChange('register')}
              className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs font-bold'
                  : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Status Notifications */}
          {activeError && (
            <div
              id="auth-error-banner"
              className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5 font-medium animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-banner"
              className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5 font-medium animate-fadeIn"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Sign In & Register Form */}
          <form onSubmit={handleUsernamePasswordSubmit} className="space-y-4">
            {/* Username or Email Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="auth-username"
                className="block text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]"
              >
                {mode === 'signin' ? 'Username or Email' : 'Choose a Username'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E7952] dark:text-[#C5A059]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    setLocalError(null);
                  }}
                  disabled={isBusy}
                  placeholder={mode === 'signin' ? 'e.g. shivam or shivam@example.com' : 'e.g. shivam_tech'}
                  className="w-full min-h-[46px] pl-10 pr-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#1E1D19] border border-[#DDD8CA] dark:border-[#33312B] rounded-xl text-[#141412] dark:text-[#F6F5F0] placeholder-[#A09C92] dark:placeholder-[#6E6A60] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059] transition-all"
                />
              </div>
            </div>

            {/* Display Name Input (Register Only) */}
            {mode === 'register' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]"
                >
                  Full Name <span className="text-[#8E7952] font-normal">(Optional)</span>
                </label>
                <input
                  id="auth-display-name"
                  name="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isBusy}
                  placeholder="e.g. Shiva Matangi"
                  className="w-full min-h-[46px] px-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#1E1D19] border border-[#DDD8CA] dark:border-[#33312B] rounded-xl text-[#141412] dark:text-[#F6F5F0] placeholder-[#A09C92] dark:placeholder-[#6E6A60] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059] transition-all"
                />
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E7952] dark:text-[#C5A059]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError(null);
                  }}
                  disabled={isBusy}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] pl-10 pr-10 py-2 text-sm bg-[#FAF8F5] dark:bg-[#1E1D19] border border-[#DDD8CA] dark:border-[#33312B] rounded-xl text-[#141412] dark:text-[#F6F5F0] placeholder-[#A09C92] dark:placeholder-[#6E6A60] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059] transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E7952] dark:text-[#C5A059] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Register Only) */}
            {mode === 'register' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E7952] dark:text-[#C5A059]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setLocalError(null);
                    }}
                    disabled={isBusy}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2 text-sm bg-[#FAF8F5] dark:bg-[#1E1D19] border border-[#DDD8CA] dark:border-[#33312B] rounded-xl text-[#141412] dark:text-[#F6F5F0] placeholder-[#A09C92] dark:placeholder-[#6E6A60] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40 focus:border-[#C5A059] transition-all"
                  />
                </div>
              </div>
            )}

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#78746B] dark:text-[#9E9B92]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#C5A059] border-[#DDD8CA] dark:border-[#33312B] focus:ring-[#C5A059]/40 cursor-pointer"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-auth-submit"
              disabled={isBusy}
              className="w-full min-h-[48px] px-4 py-3 bg-[#181816] hover:bg-[#2A2925] dark:bg-[#F6F5F0] dark:hover:bg-[#EAE7DC] text-white dark:text-[#181816] font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-sm disabled:opacity-60 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                  <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Account & Start Tracking'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Automatic Sync Guarantee Info */}
          <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#282622] flex items-center gap-2 text-[11px] text-[#78746B] dark:text-[#9E9B92]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
            <span>
              Google Sheets/API access is automatically initialized. No manual configuration needed.
            </span>
          </div>
        </div>

        {/* Bottom Switcher Link */}
        <div className="text-center mt-5 text-xs text-[#78746B] dark:text-[#9E9B92]">
          {mode === 'signin' ? (
            <span>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => handleModeChange('register')}
                className="font-semibold text-[#181816] dark:text-[#F6F5F0] underline hover:text-[#C5A059] transition-colors cursor-pointer"
              >
                Create one now
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeChange('signin')}
                className="font-semibold text-[#181816] dark:text-[#F6F5F0] underline hover:text-[#C5A059] transition-colors cursor-pointer"
              >
                Sign in here
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
