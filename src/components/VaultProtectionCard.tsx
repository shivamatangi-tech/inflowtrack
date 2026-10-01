/**
 * ============================================================================
 * File: src/components/VaultProtectionCard.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Vault Protection card for managing the 4-digit Security PIN, session
 *   inactivity auto-lock triggers, and security recovery questions.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Check,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import {
  hasSecurityPinSet,
  getInactivityTimeoutMinutes,
  getInactivityAction,
  saveInactivitySettings,
  saveSecurityQuestionsWithServer,
  getStoredSecurityQuestionConfig,
} from '../utils/security';
import { getFreshAuthToken } from '../services/firebase';

interface VaultProtectionCardProps {
  isUnlocked?: boolean;
  onOpenUnlockModal?: () => void;
  onOpenChangePinModal?: () => void;
  onLock?: () => void;
}

export const VaultProtectionCard: React.FC<VaultProtectionCardProps> = ({
  isUnlocked = false,
  onOpenUnlockModal,
  onOpenChangePinModal,
  onLock,
}) => {
  const [hasPin, setHasPin] = useState(() => hasSecurityPinSet());
  const [timeoutMinutes, setTimeoutMinutes] = useState(() => getInactivityTimeoutMinutes());
  const [inactivityAction, setInactivityAction] = useState<'lock' | 'logout'>(() => getInactivityAction());
  const [isSavingInactivity, setIsSavingInactivity] = useState(false);
  const [inactivitySuccess, setInactivitySuccess] = useState<string | null>(null);

  // Recovery Questions State
  const [showQuestionsForm, setShowQuestionsForm] = useState(false);
  const [q1, setQ1] = useState('');
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState('');
  const [a2, setA2] = useState('');
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [questionsSuccess, setQuestionsSuccess] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  useEffect(() => {
    setHasPin(hasSecurityPinSet());
    setTimeoutMinutes(getInactivityTimeoutMinutes());
    setInactivityAction(getInactivityAction());

    const cfg = getStoredSecurityQuestionConfig();
    if (cfg) {
      if (cfg.question1) setQ1(cfg.question1);
      if (cfg.question2) setQ2(cfg.question2);
    }
  }, [isUnlocked]);

  const handleSaveInactivity = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInactivity(true);
    saveInactivitySettings(timeoutMinutes, inactivityAction);
    setInactivitySuccess('Session inactivity settings saved.');
    setTimeout(() => {
      setIsSavingInactivity(false);
      setInactivitySuccess(null);
    }, 3000);
  };

  const handleSaveQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q1.trim() || !a1.trim()) {
      setQuestionsError('Please provide at least Question 1 and its answer.');
      return;
    }

    setIsSavingQuestions(true);
    setQuestionsError(null);
    setQuestionsSuccess(null);

    try {
      const token = await getFreshAuthToken();
      await saveSecurityQuestionsWithServer(token, {
        question1: q1.trim(),
        answer1: a1.trim(),
        question2: q2.trim() || undefined,
        answer2: a2.trim() || undefined,
      });

      setQuestionsSuccess('Security recovery questions saved securely with salted PBKDF2 hash.');
      setA1('');
      setA2('');
      setShowQuestionsForm(false);
      setTimeout(() => setQuestionsSuccess(null), 4000);
    } catch (err: any) {
      setQuestionsError(err?.message || 'Failed to save security questions.');
    } finally {
      setIsSavingQuestions(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Vault Protection
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Security PIN controls, auto-lock timer, and sensitive data masking
            </p>
          </div>
        </div>

        {/* PIN Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] w-fit">
          <KeyRound className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>{hasPin ? 'PIN Configured' : 'PIN Not Set'}</span>
        </div>
      </div>

      {inactivitySuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{inactivitySuccess}</span>
        </div>
      )}

      {/* PIN Status & Action Row */}
      <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
            <span>4-Digit Quick Unlock PIN</span>
          </div>
          <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
            Masks balances, payment card numbers, and financial targets with PBKDF2-HMAC-SHA256 encryption.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPin && (
            <button
              type="button"
              onClick={isUnlocked ? onLock : onOpenUnlockModal}
              className="min-h-[40px] px-3.5 py-1.5 bg-white dark:bg-[#161614] hover:bg-[#EFECE4] dark:hover:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              {isUnlocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Lock Session</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unlock PIN</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenChangePinModal}
            className="min-h-[40px] px-4 py-1.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{hasPin ? 'Change PIN' : 'Set 4-Digit PIN'}</span>
          </button>
        </div>
      </div>

      {/* Inactivity Auto-Lock Settings Form */}
      <form
        onSubmit={handleSaveInactivity}
        className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] space-y-3"
      >
        <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#C5A059]" />
          <span>Session Inactivity Auto-Lock</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label
              htmlFor="vault-inactivity-minutes"
              className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
            >
              Auto-Lock After Idle
            </label>
            <select
              id="vault-inactivity-minutes"
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(parseInt(e.target.value, 10))}
              className="w-full min-h-[42px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value={5}>5 Minutes</option>
              <option value={15}>15 Minutes (Default)</option>
              <option value={30}>30 Minutes</option>
              <option value={60}>1 Hour</option>
              <option value={0}>Never (Disabled)</option>
            </select>
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="vault-inactivity-action"
              className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
            >
              Action on Idle
            </label>
            <select
              id="vault-inactivity-action"
              value={inactivityAction}
              onChange={(e) => setInactivityAction(e.target.value as 'lock' | 'logout')}
              className="w-full min-h-[42px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="lock">Lock with PIN</option>
              <option value="logout">Full Sign Out</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSavingInactivity}
              className="w-full min-h-[42px] px-4 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSavingInactivity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Trigger</span>
            </button>
          </div>
        </div>
      </form>

      {/* Recovery Security Questions Collapsible */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-[#C5A059]" />
            <span>PIN Recovery Questions</span>
          </div>
          <button
            type="button"
            onClick={() => setShowQuestionsForm((prev) => !prev)}
            className="text-xs text-[#8E7952] dark:text-[#C5A059] font-medium hover:underline cursor-pointer"
          >
            {showQuestionsForm ? 'Close' : 'Configure Recovery'}
          </button>
        </div>

        {questionsSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium mb-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{questionsSuccess}</span>
          </div>
        )}

        {questionsError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium mb-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{questionsError}</span>
          </div>
        )}

        {showQuestionsForm && (
          <form
            onSubmit={handleSaveQuestions}
            className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="vault-q1"
                  className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
                >
                  Question 1
                </label>
                <input
                  type="text"
                  id="vault-q1"
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  placeholder="e.g. Name of your first pet?"
                  required
                  className="w-full min-h-[40px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label
                  htmlFor="vault-a1"
                  className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
                >
                  Answer 1
                </label>
                <input
                  type="password"
                  id="vault-a1"
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  placeholder="Secret answer"
                  required
                  className="w-full min-h-[40px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingQuestions}
                className="min-h-[40px] px-4 py-1.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingQuestions ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Recovery Questions</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
