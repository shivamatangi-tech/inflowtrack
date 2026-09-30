/**
 * ============================================================================
 * File: src/components/AuthScreen.tsx
 * Application: inflowtrack — Track Save Grow
 * Purpose:
 *   Authentication screen supporting unique Username + PIN sign-in, account
 *   registration with unique username, and side-by-side Sign In & Register
 *   buttons at the bottom of the screen.
 *
 * Security Architecture & Guarantees:
 *   1. Plaintext passwords or PINs are NEVER stored in Firebase or database.
 *   2. Cryptographically hashed using PBKDF2-HMAC-SHA256 (100,000 iterations).
 *   3. All sensitive operations (editing, deleting, changing UPI ID, modifying
 *      QR code) are protected behind authentication.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wallet,
  ShieldCheck,
  FileSpreadsheet,
  PieChart,
  KeyRound,
  User,
  Lock,
  UserPlus,
  LogIn,
  Info,
  X,
  CreditCard,
  QrCode,
  Shield,
} from 'lucide-react';
import {
  loginWithUsernameAndPin,
  registerWithUsernameAndPin,
  loginWithEmailPassword,
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
  // Check remembered username or email
  const savedUsername = (() => {
    try {
      return (
        localStorage.getItem('inflowtrack_saved_username') ||
        localStorage.getItem('inflowtrack_saved_email')?.split('@')[0] ||
        ''
      );
    } catch {
      return '';
    }
  })();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState<string>(savedUsername);
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [usePasswordInstead, setUsePasswordInstead] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPin, setShowPin] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false);

  const isBusy = isSubmitting || externalLoading;
  const activeError = localError || externalError;

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setLocalError(null);
    setSuccessMessage(null);
    setPin('');
    setConfirmPin('');
    setPassword('');
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

  const executeSignIn = async () => {
    setLocalError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanUsername) {
      setLocalError('Please enter your unique username.');
      return;
    }

    if (usePasswordInstead) {
      if (!password) {
        setLocalError('Please enter your account password.');
        return;
      }
      setIsSubmitting(true);
      try {
        const emailFallback = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@inflowtrack.app`;
        const authResult = await loginWithEmailPassword(emailFallback, password, rememberMe);
        if (rememberMe) {
          try {
            localStorage.setItem('inflowtrack_saved_username', cleanUsername);
          } catch {
            // Ignore
          }
        }
        if (onAuthSuccess) {
          await onAuthSuccess(authResult.user, authResult.token);
        }
      } catch (err: any) {
        setLocalError(err.message || 'Sign in failed. Please verify your credentials.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setLocalError('Please enter your 4-digit PIN.');
      return;
    }

    setIsSubmitting(true);
    try {
      const authResult = await loginWithUsernameAndPin(cleanUsername, cleanPin, rememberMe);
      if (onAuthSuccess) {
        await onAuthSuccess(authResult.user, authResult.token);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Incorrect username or PIN. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeRegister = async () => {
    setLocalError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setLocalError('Username must be at least 3 characters long (letters, numbers, underscore, hyphen).');
      return;
    }

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setLocalError('Please create a 4-digit PIN for your account.');
      return;
    }

    if (cleanPin !== confirmPin.trim()) {
      setLocalError('PINs do not match. Please verify your 4-digit PIN.');
      return;
    }

    if (password && password.length < 6) {
      setLocalError('Password must be at least 6 characters if provided.');
      return;
    }

    setIsSubmitting(true);
    try {
      const authResult = await registerWithUsernameAndPin(
        cleanUsername,
        cleanPin,
        displayName.trim() || undefined,
        password || undefined,
        rememberMe
      );
      if (onAuthSuccess) {
        await onAuthSuccess(authResult.user, authResult.token);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed. This username may already be taken.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      executeSignIn();
    } else {
      executeRegister();
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F3EF] dark:bg-[#121311] text-[#181816] dark:text-[#F4F3EF] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Brand Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#181816] dark:bg-[#C5A059] text-white dark:text-[#111110] flex items-center justify-center shadow-xs">
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

        {/* Security Architecture Info Trigger */}
        <button
          type="button"
          onClick={() => setIsArchModalOpen(true)}
          className="text-xs font-semibold text-[#78756E] dark:text-[#C5A059] hover:text-[#181816] dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-3 rounded-lg border border-[#E0DCD3] dark:border-[#2C2A26] bg-white/70 dark:bg-[#1A1A18]/70"
        >
          <Shield className="w-3.5 h-3.5 text-[#C5A059]" />
          <span className="hidden sm:inline">Security Architecture</span>
          <span className="sm:hidden">Security</span>
        </button>
      </header>

      {/* Main Authentication Container */}
      <main className="w-full max-w-md mx-auto my-auto py-4">
        <div className="bg-white dark:bg-[#1A1A18] rounded-2xl border border-[#E5E2DA] dark:border-[#2C2A26] shadow-sm p-6 sm:p-8">
          {/* Header Title & Subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#181816] dark:text-white flex items-center justify-center gap-2">
              {mode === 'signin' ? (
                <>
                  <KeyRound className="w-5 h-5 text-[#C5A059]" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-[#C5A059]" />
                  <span>Create Account</span>
                </>
              )}
            </h1>
            <p className="text-xs text-[#78756E] dark:text-[#9C9990] mt-1.5 leading-relaxed">
              {mode === 'signin'
                ? 'Sign in using your unique username and 4-digit PIN.'
                : 'Choose a unique username and 4-digit PIN for instant access.'}
            </p>
          </div>

          {/* Error Banner */}
          {activeError && (
            <div
              id="auth-error-banner"
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{activeError}</span>
              </div>
            </div>
          )}

          {/* Success Banner */}
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
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Username Input Field (Required for both login and register) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="auth-username"
                  className="block text-xs font-semibold text-[#5E5B52] dark:text-[#A39F95]"
                >
                  Unique Username
                </label>
                {mode === 'register' && (
                  <span className="text-[10px] text-[#78756E] dark:text-[#9C9990]">
                    Letters, numbers, _, -
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#78756E] dark:text-[#9C9990]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="auth-username"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                    setLocalError(null);
                  }}
                  placeholder="e.g. shiva_06"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all font-mono"
                />
              </div>
            </div>

            {/* Registration: Optional Full Name */}
            {mode === 'register' && (
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
                  placeholder="Your Name (e.g. Shiva Matangi)"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                />
              </div>
            )}

            {/* PIN Input Field (Primary authentication mechanism) */}
            {!usePasswordInstead && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-pin"
                    className="block text-xs font-semibold text-[#5E5B52] dark:text-[#A39F95]"
                  >
                    {mode === 'register' ? 'Create 4-Digit PIN' : '4-Digit PIN'}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setUsePasswordInstead(true)}
                      className="text-xs font-medium text-[#78756E] dark:text-[#C5A059] hover:underline cursor-pointer"
                    >
                      Use password instead
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="auth-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ''));
                      setLocalError(null);
                    }}
                    placeholder="••••"
                    className="w-full pl-3.5 pr-10 py-2.5 text-lg tracking-[0.3em] font-mono text-center bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-3 top-2.5 p-1 text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Numeric PIN Keypad Helper */}
                {mode === 'signin' && (
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 max-w-[220px] mx-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handlePinDigitClick(digit)}
                        className="py-1.5 bg-[#F2EFE8] dark:bg-[#242320] hover:bg-[#E6E2D8] dark:hover:bg-[#2E2C28] text-sm font-semibold rounded-lg text-[#181816] dark:text-white transition-colors cursor-pointer select-none active:scale-95"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPin('')}
                      className="py-1.5 text-[11px] font-semibold text-[#8A8880] hover:text-[#181816] dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePinDigitClick('0')}
                      className="py-1.5 bg-[#F2EFE8] dark:bg-[#242320] hover:bg-[#E6E2D8] dark:hover:bg-[#2E2C28] text-sm font-semibold rounded-lg text-[#181816] dark:text-white transition-colors cursor-pointer select-none active:scale-95"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handlePinBackspace}
                      className="py-1.5 text-[11px] font-semibold text-[#8A8880] hover:text-rose-600 transition-colors cursor-pointer flex items-center justify-center"
                      title="Backspace"
                    >
                      ⌫
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Registration: Confirm PIN */}
            {mode === 'register' && !usePasswordInstead && (
              <div>
                <label
                  htmlFor="auth-confirm-pin"
                  className="block text-xs font-semibold text-[#5E5B52] dark:text-[#A39F95] mb-1.5"
                >
                  Confirm 4-Digit PIN
                </label>
                <input
                  id="auth-confirm-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, ''));
                    setLocalError(null);
                  }}
                  placeholder="••••"
                  className="w-full px-3.5 py-2.5 text-lg tracking-[0.3em] font-mono text-center bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
                />
              </div>
            )}

            {/* Password Field (If toggled or optional for register) */}
            {(usePasswordInstead || mode === 'register') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-[#5E5B52] dark:text-[#A39F95]"
                  >
                    {mode === 'register' ? (
                      <>
                        Account Password{' '}
                        <span className="text-[#8A8880] font-normal">(optional recovery key)</span>
                      </>
                    ) : (
                      'Account Password'
                    )}
                  </label>
                  {usePasswordInstead && mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setUsePasswordInstead(false)}
                      className="text-xs font-medium text-[#78756E] dark:text-[#C5A059] hover:underline cursor-pointer"
                    >
                      Use PIN instead
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required={usePasswordInstead}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder={
                      mode === 'register' ? 'At least 6 characters (or leave empty)' : 'Enter password'
                    }
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E0DCD3] dark:border-[#2F2E29] rounded-xl focus:bg-white dark:focus:bg-[#181816] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#181816] dark:text-white placeholder:text-[#9E9B92] transition-all"
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

            {/* Remember session checkbox */}
            <div className="flex items-center pt-0.5">
              <label className="flex items-center gap-2 text-xs text-[#5E5B52] dark:text-[#A39F95] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="auth-remember-session"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#C7C3B8] text-[#181816] focus:ring-[#C5A059] cursor-pointer"
                />
                <span>Remember my username on this device</span>
              </label>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* MANDATORY REQUIREMENT: Sign In and Register Buttons at Bottom */}
            {/* Kept Side by Side, with simple and easy flow                  */}
            {/* ------------------------------------------------------------- */}
            <div className="pt-2">
              <div className="grid grid-cols-2 gap-3">
                {/* Sign In Button */}
                <button
                  type={mode === 'signin' ? 'submit' : 'button'}
                  id="btn-auth-signin"
                  disabled={isBusy}
                  onClick={mode === 'signin' ? undefined : () => handleModeChange('signin')}
                  className={`min-h-[46px] w-full flex items-center justify-center gap-2 py-2.5 px-4 font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    mode === 'signin'
                      ? 'bg-[#181816] hover:bg-[#2C2A25] dark:bg-[#C5A059] dark:hover:bg-[#D4B066] text-white dark:text-[#111110] ring-1 ring-black/10'
                      : 'bg-[#F2EFE8] hover:bg-[#E6E2D8] dark:bg-[#262522] dark:hover:bg-[#302F2B] text-[#5E5B52] dark:text-[#A39F95] border border-[#E0DCD3] dark:border-[#33312B]'
                  }`}
                >
                  {isBusy && mode === 'signin' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <LogIn className="w-4 h-4 shrink-0" />
                  )}
                  <span>Sign In</span>
                </button>

                {/* Register Button */}
                <button
                  type={mode === 'register' ? 'submit' : 'button'}
                  id="btn-auth-register"
                  disabled={isBusy}
                  onClick={mode === 'register' ? undefined : () => handleModeChange('register')}
                  className={`min-h-[46px] w-full flex items-center justify-center gap-2 py-2.5 px-4 font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    mode === 'register'
                      ? 'bg-[#181816] hover:bg-[#2C2A25] dark:bg-[#C5A059] dark:hover:bg-[#D4B066] text-white dark:text-[#111110] ring-1 ring-black/10'
                      : 'bg-[#F2EFE8] hover:bg-[#E6E2D8] dark:bg-[#262522] dark:hover:bg-[#302F2B] text-[#5E5B52] dark:text-[#A39F95] border border-[#E0DCD3] dark:border-[#33312B]'
                  }`}
                >
                  {isBusy && mode === 'register' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <UserPlus className="w-4 h-4 shrink-0" />
                  )}
                  <span>Register</span>
                </button>
              </div>

              <p className="text-[10px] text-center text-[#78756E] dark:text-[#9C9990] mt-3">
                {mode === 'signin'
                  ? 'New to inflowtrack? Tap Register to choose your username.'
                  : 'Already registered? Tap Sign In to unlock with your PIN.'}
              </p>
            </div>
          </form>

          {/* Security Architecture Notice (Explicit verification guarantee) */}
          <div className="mt-5 pt-4 border-t border-[#E5E2DA] dark:border-[#2C2A26] flex items-center justify-between text-[10px] text-[#78756E] dark:text-[#9C9990]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              <span>PBKDF2-SHA256 salted encryption</span>
            </div>
            <button
              type="button"
              onClick={() => setIsArchModalOpen(true)}
              className="text-[#181816] dark:text-[#C5A059] font-medium hover:underline cursor-pointer"
            >
              Storage details →
            </button>
          </div>
        </div>

        {/* Feature Badges below Card */}
        <div className="mt-6 grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A1A18]/60 border border-[#E5E2DA]/80 dark:border-[#2C2A26]/80 flex flex-col items-center">
            <User className="w-4 h-4 text-[#C5A059] mb-1" />
            <span className="text-[11px] font-semibold text-[#181816] dark:text-white">
              Unique Username
            </span>
            <span className="text-[9.5px] text-[#78756E] dark:text-[#9C9990] mt-0.5">
              Personal ID
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A1A18]/60 border border-[#E5E2DA]/80 dark:border-[#2C2A26]/80 flex flex-col items-center">
            <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1" />
            <span className="text-[11px] font-semibold text-[#181816] dark:text-white">
              Quick PIN Login
            </span>
            <span className="text-[9.5px] text-[#78756E] dark:text-[#9C9990] mt-0.5">
              Instant access
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A1A18]/60 border border-[#E5E2DA]/80 dark:border-[#2C2A26]/80 flex flex-col items-center">
            <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-1" />
            <span className="text-[11px] font-semibold text-[#181816] dark:text-white">
              Card & UPI Vault
            </span>
            <span className="text-[9.5px] text-[#78756E] dark:text-[#9C9990] mt-0.5">
              Protected by PIN
            </span>
          </div>
        </div>
      </main>

      {/* Security Architecture & Storage Modal */}
      {isArchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#1A1A18] rounded-2xl border border-[#E5E2DA] dark:border-[#2C2A26] shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DA] dark:border-[#2C2A26] mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
                <h3 className="text-base font-bold text-[#181816] dark:text-white">
                  Security Architecture & Storage
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsArchModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#78756E] hover:text-[#181816] dark:hover:text-white hover:bg-[#F2EFE8] dark:hover:bg-[#252522] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#5E5B52] dark:text-[#A39F95] leading-relaxed">
              <div className="p-3 rounded-xl bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E5E2DA] dark:border-[#2C2A26]">
                <h4 className="font-semibold text-[#181816] dark:text-white flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Unique Username Storage</span>
                </h4>
                <p>
                  Usernames are stored in the server database (<code>.data/auth_users.json</code> and{' '}
                  <code>WorkbookStore.userSecurity[uid].username</code>). Each username is normalized,
                  indexed, and guaranteed unique across all accounts.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E5E2DA] dark:border-[#2C2A26]">
                <h4 className="font-semibold text-[#181816] dark:text-white flex items-center gap-1.5 mb-1">
                  <Lock className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>No Plaintext PINs or Passwords</span>
                </h4>
                <p>
                  Passwords and PINs are <strong>never stored as readable or plain-text values</strong> in Firebase or the database. All credentials undergo PBKDF2-HMAC-SHA256 hashing with 100,000 iterations and a unique 16-byte random salt per user.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F9F8F5] dark:bg-[#22211E] border border-[#E5E2DA] dark:border-[#2C2A26]">
                <h4 className="font-semibold text-[#181816] dark:text-white flex items-center gap-1.5 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Card, UPI ID & QR Code Storage</span>
                </h4>
                <p>
                  Card numbers, UPI IDs, and QR code configurations are saved securely in the database (<code>WorkbookStore.userCards[uid]</code>) isolated strictly by verified Firebase UID. All card-management actions (editing details, updating UPI ID, modifying QR code, deleting cards) are protected behind mandatory PIN authentication.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E5E2DA] dark:border-[#2C2A26] flex justify-end">
              <button
                type="button"
                onClick={() => setIsArchModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#181816] dark:bg-[#C5A059] text-white dark:text-[#111110] hover:bg-[#2C2A25] dark:hover:bg-[#D4B066] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center py-3 border-t border-[#E5E2DA] dark:border-[#2C2A26]/60">
        <p className="text-[11px] text-[#78756E] dark:text-[#9C9990]">
          inflowtrack — Money In Out Tracker · Track, Save, and Grow
        </p>
      </footer>
    </div>
  );
};
