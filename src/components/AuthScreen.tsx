/**
 * ============================================================================
 * File: src/components/AuthScreen.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Luxury modern & classic professional website and Private Client Portal.
 *   Combines Warm Ivory (#F6F5F0), Deep Charcoal (#111110), and Muted Champagne
 *   Gold (#C5A059) with Cormorant Garamond serif headings and Poppins UI prose.
 *   Includes:
 *     1. Premium Navigation Bar (3-Zone Top Bar Contract)
 *     2. Hero Section + Integrated Private Client Authentication Vault
 *     3. Editorial About / Introduction Section
 *     4. Capabilities / Services Section
 *     5. Portfolio / Workspace Showcase Section
 *     6. Client Trust / Testimonials Section
 *     7. Executive Call-to-Action Section
 *     8. Multi-Column Professional Footer
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import {
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CreditCard,
  Layers,
  Database,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
  requestPasswordReset,
} from '../services/firebase';
import { GoogleUser } from '../types';
import editorialOfficeImg from '../assets/images/luxury_wealth_editorial_1790452680975.jpg';
import privateLedgerImg from '../assets/images/portfolio_private_ledger_1790452694167.jpg';
import executiveVaultImg from '../assets/images/portfolio_executive_vault_1790452707006.jpg';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = isSubmitting || externalLoading;
  const activeError = localError || externalError;

  const switchMode = (nextMode: AuthViewMode) => {
    setViewMode(nextMode);
    setLocalError(null);
    setSuccessMessage(null);
  };

  const focusAuthPortal = (mode: AuthViewMode = 'login') => {
    setIsMobileMenuOpen(false);
    switchMode(mode);
    if (authCardRef.current) {
      authCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      emailInputRef.current?.focus({ preventScroll: true });
    }, 320);
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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F6F5F0] dark:bg-[#111110] text-[#141412] dark:text-[#F6F5F0] flex flex-col font-sans antialiased selection:bg-[#C5A059]/25">
      {/* ===================================================================== */}
      {/* 1. PREMIUM RESPONSIVE NAVIGATION BAR (Desktop + Mobile Drawer)        */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 w-full bg-[#F6F5F0]/95 dark:bg-[#111110]/95 backdrop-blur-md border-b border-[#E5E0D4] dark:border-[#24231F]">
        <div className="fluid-container h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Zone 1: Single Text Element Wordmark */}
          <a
            href="#hero"
            onClick={() => setIsMobileMenuOpen(false)}
            className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#141412] dark:text-[#F6F5F0] whitespace-nowrap shrink-0"
          >
            inflotrack
          </a>

          {/* Zone 2: Minimal Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium text-[#5E5B52] dark:text-[#A39F95]">
            <a
              href="#about"
              className="py-2 border-b border-transparent hover:border-[#C5A059] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors whitespace-nowrap"
            >
              About
            </a>
            <a
              href="#capabilities"
              className="py-2 border-b border-transparent hover:border-[#C5A059] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors whitespace-nowrap"
            >
              Capabilities
            </a>
            <a
              href="#showcase"
              className="py-2 border-b border-transparent hover:border-[#C5A059] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors whitespace-nowrap"
            >
              Showcase
            </a>
            <a
              href="#trust"
              className="py-2 border-b border-transparent hover:border-[#C5A059] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors whitespace-nowrap"
            >
              Client Trust
            </a>
          </nav>

          {/* Zone 3: Desktop CTA Buttons + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => focusAuthPortal('login')}
              className="hidden sm:inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-xs font-medium text-[#141412] dark:text-[#F6F5F0] hover:text-[#8E7952] dark:hover:text-[#C5A059] transition-colors cursor-pointer whitespace-nowrap"
            >
              Client Sign In
            </button>
            <button
              type="button"
              onClick={() => focusAuthPortal('register')}
              className="hidden md:inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-xs font-semibold bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Open Private Vault
            </button>

            {/* Mobile Primary Action & Hamburger Toggle (44x44px touch target) */}
            <button
              type="button"
              onClick={() => focusAuthPortal('login')}
              className="md:hidden inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 text-xs font-semibold bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              Vault Access
            </button>
            <button
              type="button"
              id="btn-auth-mobile-menu"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="md:hidden w-11 h-11 rounded-xl border border-[#E4DFD3] dark:border-[#2C2A25] bg-white dark:bg-[#171715] text-[#141412] dark:text-[#F6F5F0] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden w-full bg-[#F6F5F0] dark:bg-[#141412] border-b border-[#E5E0D4] dark:border-[#262521] px-5 py-5 space-y-4 shadow-lg">
            <nav className="flex flex-col space-y-1">
              {[
                { href: '#about', label: '01. About & Philosophy' },
                { href: '#capabilities', label: '02. Core Capabilities' },
                { href: '#showcase', label: '03. Workspace Showcase' },
                { href: '#trust', label: '04. Client Trust' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-h-[44px] px-3 rounded-xl flex items-center justify-between text-xs font-medium text-[#141412] dark:text-[#F6F5F0] hover:bg-white dark:hover:bg-[#1E1E1B] transition-colors"
                >
                  <span>{link.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-[#C5A059]" />
                </a>
              ))}
            </nav>

            <div className="pt-3 border-t border-[#E5E0D4] dark:border-[#262521] flex flex-col gap-2.5 items-center">
              <button
                type="button"
                onClick={() => focusAuthPortal('register')}
                className="w-full max-w-xs min-h-[46px] px-5 py-3 rounded-xl bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Private Vault</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => focusAuthPortal('login')}
                className="w-full max-w-xs min-h-[46px] px-5 py-3 rounded-xl bg-white dark:bg-[#1C1C19] border border-[#E4DFD3] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-medium flex items-center justify-center cursor-pointer"
              >
                Client Sign In
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ===================================================================== */}
      {/* 2. HERO SECTION + INTEGRATED PRIVATE CLIENT VAULT                     */}
      {/* ===================================================================== */}
      <section
        id="hero"
        className="relative fluid-section-pad border-b border-[#E5E0D4] dark:border-[#24231F]"
      >
        <div className="fluid-container grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
          {/* Left Column: Luxury Editorial Proposition */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
            <div className="space-y-3.5 sm:space-y-4">
              <p className="text-[11px] sm:text-xs font-medium tracking-[0.16em] uppercase text-[#8E7952] dark:text-[#C5A059]">
                Private Wealth Architecture · Sovereign Ledger
              </p>
              <h1
                className="font-display fluid-hero-title font-semibold text-[#141412] dark:text-[#F6F5F0]"
                style={{ textWrap: 'balance' }}
              >
                Timeless financial clarity for your private capital, cards, and reserves.
              </h1>
              <p className="text-xs sm:text-base text-[#5E5B52] dark:text-[#A39F95] max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Designed with the discipline of a private family office. Track monthly cash flow,
                manage multi-card expenditure, and synchronize every ledger entry directly with
                your personal Google Sheet and Google Drive vault.
              </p>
            </div>

            {/* Primary & Secondary CTAs (Stacked & centered on mobile, row on tablet/desktop) */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 w-full">
              <button
                type="button"
                onClick={() => focusAuthPortal('register')}
                className="w-full sm:w-auto max-w-xs sm:max-w-none min-h-[46px] px-6 sm:px-7 py-3 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-sm"
              >
                <span>Establish Private Workspace</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </button>
              <a
                href="#showcase"
                className="w-full sm:w-auto max-w-xs sm:max-w-none min-h-[46px] px-6 py-3 bg-white dark:bg-[#181815] hover:bg-[#EFECE4] dark:hover:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0] border border-[#E4DFD3] dark:border-[#2C2A25] text-xs font-medium rounded-xl flex items-center justify-center transition-all whitespace-nowrap"
              >
                Explore Architecture
              </a>
            </div>

            {/* Editorial Quantitative Proof Strip */}
            <div className="pt-6 sm:pt-8 border-t border-[#E5E0D4] dark:border-[#24231F] grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
              <div className="p-3 sm:p-0 rounded-xl bg-white/50 sm:bg-transparent dark:bg-[#161614]/50 sm:dark:bg-transparent border border-[#E5E0D4]/60 sm:border-0 dark:border-[#24231F]">
                <div className="font-display tabular-nums text-2xl sm:text-3xl font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  100%
                </div>
                <p className="text-xs text-[#6E6A61] dark:text-[#9E9B92] mt-1">
                  Client-owned Google Sheet & Drive ledger
                </p>
              </div>
              <div className="p-3 sm:p-0 rounded-xl bg-white/50 sm:bg-transparent dark:bg-[#161614]/50 sm:dark:bg-transparent border border-[#E5E0D4]/60 sm:border-0 dark:border-[#24231F]">
                <div className="font-display tabular-nums text-2xl sm:text-3xl font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  100k
                </div>
                <p className="text-xs text-[#6E6A61] dark:text-[#9E9B92] mt-1">
                  PBKDF2-SHA256 salted PIN & recovery iterations
                </p>
              </div>
              <div className="p-3 sm:p-0 rounded-xl bg-white/50 sm:bg-transparent dark:bg-[#161614]/50 sm:dark:bg-transparent border border-[#E5E0D4]/60 sm:border-0 dark:border-[#24231F]">
                <div className="font-display tabular-nums text-2xl sm:text-3xl font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  12-Mo
                </div>
                <p className="text-xs text-[#6E6A61] dark:text-[#9E9B92] mt-1">
                  Automated monthly tab & reserve tracking
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Private Client Authentication Vault */}
          <div className="lg:col-span-5 w-full" ref={authCardRef}>
            <div className="w-full max-w-[min(100%,430px)] mx-auto bg-white dark:bg-[#171715] p-5 sm:p-8 rounded-2xl border border-[#E4DFD3] dark:border-[#2A2823] shadow-sm">
              {/* Form Heading */}
              <div className="mb-5 pb-4 border-b border-[#EFECE4] dark:border-[#24231F]">
                <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059] mb-1">
                  Private Client Access
                </p>
                <h2 className="font-display fluid-card-title font-semibold tracking-tight text-[#141412] dark:text-[#F6F5F0]">
                  {viewMode === 'login'
                    ? 'Sign in to your vault'
                    : viewMode === 'register'
                    ? 'Create private account'
                    : 'Recover account access'}
                </h2>
                <p className="text-xs text-[#6E6A61] dark:text-[#9E9B92] mt-1.5 leading-relaxed">
                  {viewMode === 'login'
                    ? 'Enter your credentials to access your personal cash-flow ledger and reserves.'
                    : viewMode === 'register'
                    ? 'Initialize your dedicated Google Sheet & Drive financial workspace.'
                    : 'Enter your registered email address to receive a password reset link.'}
                </p>
              </div>

              {/* Segmented Mode Control */}
              {viewMode !== 'reset' && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#F0EDE5] dark:bg-[#22211D] rounded-xl mb-5">
                  <button
                    type="button"
                    id="tab-auth-login"
                    onClick={() => switchMode('login')}
                    className={`min-h-[42px] py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      viewMode === 'login'
                        ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs font-semibold'
                        : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    id="tab-auth-register"
                    onClick={() => switchMode('register')}
                    className={`min-h-[42px] py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      viewMode === 'register'
                        ? 'bg-white dark:bg-[#141412] text-[#141412] dark:text-[#F6F5F0] shadow-2xs font-semibold'
                        : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
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
                  className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{activeError}</span>
                </div>
              )}

              {/* Success Banner */}
              {successMessage && (
                <div
                  id="auth-success-banner"
                  className="mb-5 p-3.5 bg-[#EDF3EC] dark:bg-emerald-950/40 border border-[#C6DEC3] dark:border-emerald-900/70 rounded-xl text-xs font-medium text-[#2E7D32] dark:text-emerald-300 flex items-start gap-2.5 leading-relaxed"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {viewMode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5"
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
                      className="w-full px-4 py-2.5 text-sm bg-[#F6F5F0]/80 dark:bg-[#22211D] border border-[#E4DFD3] dark:border-[#302E29] rounded-xl focus:bg-white dark:focus:bg-[#141412] focus:outline-none focus:border-[#C5A059] text-[#141412] dark:text-[#F6F5F0] placeholder:text-[#9E9B92] transition-all"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    ref={emailInputRef}
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
                    className="w-full px-4 py-2.5 text-sm bg-[#F6F5F0]/80 dark:bg-[#22211D] border border-[#E4DFD3] dark:border-[#302E29] rounded-xl focus:bg-white dark:focus:bg-[#141412] focus:outline-none focus:border-[#C5A059] text-[#141412] dark:text-[#F6F5F0] placeholder:text-[#9E9B92] transition-all"
                  />
                </div>

                {viewMode !== 'reset' && (
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
                          className="text-xs font-medium text-[#8E7952] dark:text-[#C5A059] hover:underline transition-colors cursor-pointer"
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
                        className="w-full pl-4 pr-10 py-2.5 text-sm bg-[#F6F5F0]/80 dark:bg-[#22211D] border border-[#E4DFD3] dark:border-[#302E29] rounded-xl focus:bg-white dark:focus:bg-[#141412] focus:outline-none focus:border-[#C5A059] text-[#141412] dark:text-[#F6F5F0] placeholder:text-[#9E9B92] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-2.5 p-0.5 text-[#8A8880] hover:text-[#141412] dark:hover:text-white transition-colors cursor-pointer"
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
                      className="w-full px-4 py-2.5 text-sm bg-[#F6F5F0]/80 dark:bg-[#22211D] border border-[#E4DFD3] dark:border-[#302E29] rounded-xl focus:bg-white dark:focus:bg-[#141412] focus:outline-none focus:border-[#C5A059] text-[#141412] dark:text-[#F6F5F0] placeholder:text-[#9E9B92] transition-all"
                    />
                  </div>
                )}

                {viewMode !== 'reset' && (
                  <div className="flex items-center pt-1">
                    <label className="flex items-center gap-2.5 text-xs text-[#5E5B52] dark:text-[#A39F95] font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="auth-remember-session"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-[#C7C3B8] text-[#141412] focus:ring-[#C5A059] cursor-pointer"
                      />
                      <span>Keep session active on this device</span>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  id="auth-submit-btn"
                  disabled={isBusy}
                  className="w-full min-h-[46px] flex items-center justify-center gap-2 py-3 px-5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] active:scale-[0.99] rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-2xs"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {viewMode === 'register'
                          ? 'Initializing workspace...'
                          : viewMode === 'reset'
                          ? 'Sending reset link...'
                          : 'Verifying credentials...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {viewMode === 'register'
                          ? 'Create Private Account'
                          : viewMode === 'reset'
                          ? 'Send Reset Link'
                          : 'Enter Workspace'}
                      </span>
                      <ArrowUpRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>

                {viewMode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full min-h-[44px] py-2 text-xs font-medium text-[#6E6A61] hover:text-[#141412] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. ABOUT / EDITORIAL INTRODUCTION SECTION                             */}
      {/* ===================================================================== */}
      <section
        id="about"
        className="fluid-section-pad bg-white dark:bg-[#151513] border-b border-[#E5E0D4] dark:border-[#24231F]"
      >
        <div className="fluid-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-5 sm:space-y-6">
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              01. Our Philosophy
            </p>
            <h2
              className="font-display fluid-section-title font-semibold text-[#141412] dark:text-[#F6F5F0]"
              style={{ textWrap: 'balance' }}
            >
              Crafted for individuals who treat personal capital with institutional rigor.
            </h2>
            <p className="text-xs sm:text-base text-[#5E5B52] dark:text-[#A39F95] leading-relaxed">
              Consumer budgeting apps trap your financial history inside proprietary silos and
              clutter your screen with noisy distractions. inflotrack combines the calm authority
              of a classic private bank with direct, transparent Google Sheets and Google Drive
              ownership.
            </p>
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 border-t border-[#EFECE4] dark:border-[#24231F]">
              <div>
                <h3 className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Sovereign Data Ownership
                </h3>
                <p className="text-xs text-[#6E6A61] dark:text-[#9E9B92] mt-1.5 leading-relaxed">
                  Every transaction, category, and reserve target is written in real time to your
                  personal inflowtrack workbook and backed up to Google Drive.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Zero-Plaintext PIN Protection
                </h3>
                <p className="text-xs text-[#6E6A61] dark:text-[#9E9B92] mt-1.5 leading-relaxed">
                  Optional 4-digit privacy locks mask sensitive reserve targets and auto-lock on
                  inactivity using salted PBKDF2-HMAC-SHA256 verification.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 w-full">
            <div className="relative w-full max-w-full rounded-2xl overflow-hidden border border-[#E4DFD3] dark:border-[#2A2823] bg-[#141412] aspect-16/10 sm:aspect-video shadow-sm group">
              <img
                src={editorialOfficeImg}
                alt="Bespoke private wealth management office with warm travertine stone walls and walnut executive desk"
                referrerPolicy="no-referrer"
                className="w-full max-w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-end p-5 sm:p-8">
                <div className="text-[#F6F5F0]">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[#C5A059] font-medium">
                    Institutional Standard
                  </p>
                  <p className="font-display text-lg sm:text-2xl font-medium mt-1">
                    Quiet precision across desktop and mobile viewports.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. SERVICES / CAPABILITIES SECTION                                    */}
      {/* ===================================================================== */}
      <section
        id="capabilities"
        className="fluid-section-pad bg-[#F6F5F0] dark:bg-[#111110] border-b border-[#E5E0D4] dark:border-[#24231F]"
      >
        <div className="fluid-container space-y-8 sm:space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              02. Core Capabilities
            </p>
            <h2
              className="font-display fluid-section-title font-semibold text-[#141412] dark:text-[#F6F5F0]"
              style={{ textWrap: 'balance' }}
            >
              Four pillars of disciplined personal treasury management.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {/* Capability 01 */}
            <div className="bg-white dark:bg-[#171715] p-6 sm:p-8 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] hover:border-[#C5A059] transition-all flex flex-col justify-between gap-6">
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base sm:text-lg font-semibold text-[#8E7952] dark:text-[#C5A059]">
                    01. Executive Cash-Flow Ledger
                  </span>
                  <Layers className="w-5 h-5 text-[#141412] dark:text-[#C5A059] stroke-[1.6] shrink-0" />
                </div>
                <h3 className="font-display fluid-card-title font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Horizontal Icon Categorization & Monthly Precision
                </h3>
                <p className="text-xs sm:text-sm text-[#5E5B52] dark:text-[#A39F95] leading-relaxed">
                  Record income, expenses, transfers, savings, and receivables in seconds using
                  tactile horizontal category selectors, instant search filters, and recurring
                  monthly templates.
                </p>
              </div>
              <div className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F] flex flex-wrap items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
                <span>Monthly & Daily Views</span>
                <span>CSV & XLSX Export</span>
              </div>
            </div>

            {/* Capability 02 */}
            <div className="bg-white dark:bg-[#171715] p-6 sm:p-8 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] hover:border-[#C5A059] transition-all flex flex-col justify-between gap-6">
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base sm:text-lg font-semibold text-[#8E7952] dark:text-[#C5A059]">
                    02. Private Card & Vault Analytics
                  </span>
                  <CreditCard className="w-5 h-5 text-[#141412] dark:text-[#C5A059] stroke-[1.6] shrink-0" />
                </div>
                <h3 className="font-display fluid-card-title font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Swipeable Cards Deck & Payment Mode Auditing
                </h3>
                <p className="text-xs sm:text-sm text-[#5E5B52] dark:text-[#A39F95] leading-relaxed">
                  Monitor expenditure across HDFC, SBI, Tata Neu, Amazon ICICI, UPI, and custom
                  cards in an interactive swipeable Cards & Vault deck separated cleanly from your
                  home cash-flow summary.
                </p>
              </div>
              <div className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F] flex flex-wrap items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
                <span>Interactive Swipe Deck</span>
                <span>One-Click Bill Settlement</span>
              </div>
            </div>

            {/* Capability 03 */}
            <div className="bg-white dark:bg-[#171715] p-6 sm:p-8 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] hover:border-[#C5A059] transition-all flex flex-col justify-between gap-6">
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base sm:text-lg font-semibold text-[#8E7952] dark:text-[#C5A059]">
                    03. Capital Preservation & Reserves
                  </span>
                  <ShieldCheck className="w-5 h-5 text-[#141412] dark:text-[#C5A059] stroke-[1.6] shrink-0" />
                </div>
                <h3 className="font-display fluid-card-title font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Savings, Emergency Fund, Lent & Borrowed Targets
                </h3>
                <p className="text-xs sm:text-sm text-[#5E5B52] dark:text-[#A39F95] leading-relaxed">
                  Track fulfillment against custom INR targets for long-term investments and
                  liquid emergency reserves while keeping a clear ledger of receivables and
                  payables.
                </p>
              </div>
              <div className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F] flex flex-wrap items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
                <span>Month · Year · All-Time</span>
                <span>Target Progress Telemetry</span>
              </div>
            </div>

            {/* Capability 04 */}
            <div className="bg-white dark:bg-[#171715] p-6 sm:p-8 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] hover:border-[#C5A059] transition-all flex flex-col justify-between gap-6">
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base sm:text-lg font-semibold text-[#8E7952] dark:text-[#C5A059]">
                    04. Sovereign Cloud & Security Architecture
                  </span>
                  <Database className="w-5 h-5 text-[#141412] dark:text-[#C5A059] stroke-[1.6] shrink-0" />
                </div>
                <h3 className="font-display fluid-card-title font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Google Sheets Sync & Encrypted Session Controls
                </h3>
                <p className="text-xs sm:text-sm text-[#5E5B52] dark:text-[#A39F95] leading-relaxed">
                  Every user’s records are strictly isolated by verified UID and synchronized with
                  dedicated monthly sheet tabs (`JAN_2026`, `FEB_2026`) and encrypted JSON backups
                  in Google Drive.
                </p>
              </div>
              <div className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F] flex flex-wrap items-center justify-between gap-2 text-xs text-[#78746B] dark:text-[#9E9B92]">
                <span>UID-Isolated Verification</span>
                <span>Auto-Lock Protection</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. PORTFOLIO / WORKSPACE SHOWCASE SECTION                             */}
      {/* ===================================================================== */}
      <section
        id="showcase"
        className="fluid-section-pad bg-white dark:bg-[#151513] border-b border-[#E5E0D4] dark:border-[#24231F]"
      >
        <div className="fluid-container space-y-8 sm:space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="space-y-3 max-w-xl">
              <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#8E7952] dark:text-[#C5A059]">
                03. Workspace Showcase
              </p>
              <h2
                className="font-display fluid-section-title font-semibold text-[#141412] dark:text-[#F6F5F0]"
                style={{ textWrap: 'balance' }}
              >
                Designed for clarity, permanence, and effortless daily execution.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => focusAuthPortal('login')}
              className="w-full sm:w-auto max-w-xs sm:max-w-none min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E4DFD3] dark:border-[#2C2A25] hover:border-[#C5A059] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Access Live Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
            </button>
          </div>

          {/* Editorial Asymmetric Bento Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Showcase Item 1 (7 cols) */}
            <div
              onClick={() => focusAuthPortal('login')}
              className="lg:col-span-7 group cursor-pointer rounded-2xl overflow-hidden border border-[#E4DFD3] dark:border-[#2A2823] bg-[#141412] flex flex-col justify-between"
            >
              <div className="relative w-full aspect-16/10 overflow-hidden bg-[#1A1917]">
                <img
                  src={privateLedgerImg}
                  alt="Luxury cotton-rag financial ledger book with matte black fountain pen and champagne gold timepiece"
                  referrerPolicy="no-referrer"
                  className="w-full max-w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-4 sm:bottom-5 left-4 sm:left-6 right-4 sm:right-6 flex items-end justify-between gap-3 text-[#F6F5F0]">
                  <div>
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-[#C5A059] font-medium">
                      Cash-Flow & Category Intelligence
                    </p>
                    <h3 className="font-display text-xl sm:text-3xl font-semibold mt-1">
                      Executive Monthly Ledger & Trend Suite
                    </h3>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#C5A059] shrink-0" />
                </div>
              </div>
            </div>

            {/* Showcase Item 2 (5 cols) */}
            <div
              onClick={() => focusAuthPortal('login')}
              className="lg:col-span-5 group cursor-pointer rounded-2xl overflow-hidden border border-[#E4DFD3] dark:border-[#2A2823] bg-[#141412] flex flex-col justify-between"
            >
              <div className="relative w-full aspect-16/10 lg:aspect-auto lg:h-full overflow-hidden bg-[#1A1917] min-h-[240px] sm:min-h-[280px]">
                <img
                  src={executiveVaultImg}
                  alt="Private bank vault lounge with warm limestone arches and brushed brass details"
                  referrerPolicy="no-referrer"
                  className="w-full max-w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-4 sm:bottom-5 left-4 sm:left-6 right-4 sm:right-6 flex items-end justify-between gap-3 text-[#F6F5F0]">
                  <div>
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-[#C5A059] font-medium">
                      Cards & Reserve Protection
                    </p>
                    <h3 className="font-display text-xl sm:text-2xl font-semibold mt-1">
                      Private Vault & Multi-Card Analytics
                    </h3>
                  </div>
                  <Lock className="w-4 h-4 text-[#C5A059] shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. TESTIMONIALS / CLIENT TRUST SECTION                                */}
      {/* ===================================================================== */}
      <section
        id="trust"
        className="fluid-section-pad bg-[#F6F5F0] dark:bg-[#111110] border-b border-[#E5E0D4] dark:border-[#24231F]"
      >
        <div className="fluid-container space-y-8 sm:space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              04. Client Perspectives
            </p>
            <h2
              className="font-display fluid-section-title font-semibold text-[#141412] dark:text-[#F6F5F0]"
              style={{ textWrap: 'balance' }}
            >
              Trusted by principals, consultants, and discerning households.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <blockquote className="bg-white dark:bg-[#171715] p-6 sm:p-7 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] flex flex-col justify-between gap-6">
              <p className="text-xs sm:text-sm text-[#3E3C36] dark:text-[#D5D1C8] leading-relaxed">
                “Moving our household reserve tracking from scattered spreadsheets into inflotrack
                cut monthly reconciliation from two hours to ten minutes while keeping every row
                inside our own Google Drive.”
              </p>
              <footer className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F]">
                <div className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Arjun Mehta
                </div>
                <div className="text-xs text-[#78746B] dark:text-[#9E9B92]">
                  Managing Partner · Meridian Advisory
                </div>
              </footer>
            </blockquote>

            <blockquote className="bg-white dark:bg-[#171715] p-6 sm:p-7 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] flex flex-col justify-between gap-6">
              <p className="text-xs sm:text-sm text-[#3E3C36] dark:text-[#D5D1C8] leading-relaxed">
                “The separation between the daily cash-flow overview and the PIN-protected Cards &
                Reserves vault gives me the exact discretion I need when reviewing finances on the
                move.”
              </p>
              <footer className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F]">
                <div className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Elena Rostova
                </div>
                <div className="text-xs text-[#78746B] dark:text-[#9E9B92]">
                  Principal Architect · Studio Vesper
                </div>
              </footer>
            </blockquote>

            <blockquote className="bg-white dark:bg-[#171715] p-6 sm:p-7 rounded-2xl border border-[#E4DFD3] dark:border-[#282622] flex flex-col justify-between gap-6">
              <p className="text-xs sm:text-sm text-[#3E3C36] dark:text-[#D5D1C8] leading-relaxed">
                “Having horizontal category selectors and automated monthly tabs (`AUG_2026`,
                `SEP_2026`) synced to Google Sheets means our tax advisor can audit clean ledgers
                instantly.”
              </p>
              <footer className="pt-4 border-t border-[#EFECE4] dark:border-[#24231F]">
                <div className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Vikramaditya Rao
                </div>
                <div className="text-xs text-[#78746B] dark:text-[#9E9B92]">
                  Director of Operations · Kaveri Capital
                </div>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. EXECUTIVE CALL-TO-ACTION SECTION (Centered & Responsive)           */}
      {/* ===================================================================== */}
      <section className="fluid-section-pad bg-[#141412] text-[#F6F5F0] border-b border-[#262521]">
        <div className="fluid-container max-w-4xl text-center space-y-5 sm:space-y-6">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#C5A059]">
            Private Wealth Workspace
          </p>
          <h2
            className="font-display fluid-section-title font-semibold tracking-tight text-[#F6F5F0]"
            style={{ textWrap: 'balance' }}
          >
            Begin your private financial ledger today.
          </h2>
          <p className="text-xs sm:text-sm text-[#A39F95] max-w-xl mx-auto leading-relaxed">
            Sign in or establish a new account to synchronize your income, expenses, cards, and
            long-term capital reserves with your personal Google Sheet and Drive vault.
          </p>
          {/* Centered CTA Buttons: Stacked on mobile, horizontal row on tablet/desktop */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full">
            <button
              type="button"
              onClick={() => focusAuthPortal('register')}
              className="w-full sm:w-auto max-w-xs sm:max-w-none min-h-[46px] px-7 py-3 bg-[#C5A059] hover:bg-[#D1AF6A] text-[#111110] text-xs font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer whitespace-nowrap"
            >
              Create Private Account
            </button>
            <button
              type="button"
              onClick={() => focusAuthPortal('login')}
              className="w-full sm:w-auto max-w-xs sm:max-w-none min-h-[46px] px-7 py-3 bg-transparent hover:bg-white/5 text-[#F6F5F0] border border-[#36342E] text-xs font-medium rounded-xl flex items-center justify-center transition-all cursor-pointer whitespace-nowrap"
            >
              Sign In to Existing Vault
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. PROFESSIONAL MULTI-COLUMN FOOTER                                   */}
      {/* ===================================================================== */}
      <footer className="bg-[#111110] text-[#A39F95] py-12 sm:py-14">
        <div className="fluid-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-[#24231F]">
          <div className="space-y-3">
            <div className="font-display text-2xl font-semibold text-[#F6F5F0]">
              inflotrack
            </div>
            <p className="text-xs text-[#8A867C] leading-relaxed">
              Personal income, expense, card, and reserve ledger synchronized with Google Sheets
              and Google Drive.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[#F6F5F0] tracking-wide">
              Navigation
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#hero" className="inline-block py-1 hover:text-[#C5A059] transition-colors">
                  Client Portal
                </a>
              </li>
              <li>
                <a href="#about" className="inline-block py-1 hover:text-[#C5A059] transition-colors">
                  Philosophy
                </a>
              </li>
              <li>
                <a href="#capabilities" className="inline-block py-1 hover:text-[#C5A059] transition-colors">
                  Capabilities
                </a>
              </li>
              <li>
                <a href="#showcase" className="inline-block py-1 hover:text-[#C5A059] transition-colors">
                  Workspace Showcase
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[#F6F5F0] tracking-wide">
              Architecture
            </div>
            <ul className="space-y-2 text-xs text-[#8A867C]">
              <li className="py-0.5">Google Sheets Live Workbook</li>
              <li className="py-0.5">Google Drive Private Backups</li>
              <li className="py-0.5">PBKDF2-SHA256 PIN Protection</li>
              <li className="py-0.5">Firebase UID Verification</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[#F6F5F0] tracking-wide">
              Client Access
            </div>
            <p className="text-xs text-[#8A867C] leading-relaxed">
              Protected by configurable session inactivity lock and encrypted recovery.
            </p>
            <button
              type="button"
              onClick={() => focusAuthPortal('login')}
              className="mt-1 min-h-[44px] inline-flex items-center gap-1.5 text-xs font-medium text-[#C5A059] hover:underline cursor-pointer"
            >
              <span>Sign in to workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="fluid-container pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-[#6E6A61]">
          <span>© {new Date().getFullYear()} inflotrack. All rights reserved.</span>
          <span>Track · Save · Grow</span>
        </div>
      </footer>
    </div>
  );
};
