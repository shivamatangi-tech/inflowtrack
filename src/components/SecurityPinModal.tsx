/**
 * ============================================================================
 * File: src/components/SecurityPinModal.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Centralized modal for the optional 4-digit Quick-Unlock PIN, PIN Setup,
 *   PIN Change, and Forgot-PIN Recovery workflows.
 *
 * Key Responsibilities:
 *   1. Unlocks protected balances and financial targets after the main
 *      Firebase account is already authenticated.
 *   2. Verifies and updates PINs exclusively via backend salted PBKDF2-SHA256
 *      hashes (`/api/security/*`) — never stores plaintext PINs.
 *   3. Enforces a 3-attempt lockout and provides secure PIN recovery via
 *      Firebase Account Password re-authentication or hashed recovery answers.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  X,
  AlertCircle,
  CheckCircle2,
  Delete,
  ArrowLeft,
  ShieldAlert,
  HelpCircle,
  Check,
  Loader2,
} from 'lucide-react';
import {
  hasSecurityPinSet,
  getSecurityQuestions,
  resetFailedAttempts,
  isPinLockedOut,
  verifySecurityPinWithServer,
  updateSecurityPinWithServer,
  recoverSecurityPinWithServer,
} from '../utils/security';
import { getFreshAuthToken, verifyAccountPasswordForRecovery } from '../services/firebase';

export type PinModalMode = 'unlock' | 'setup' | 'change' | 'recovery';

interface SecurityPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessUnlock: () => void;
  initialMode?: PinModalMode;
  accessToken?: string | null;
  spreadsheetId?: string | null;
}

export const SecurityPinModal: React.FC<SecurityPinModalProps> = ({
  isOpen,
  onClose,
  onSuccessUnlock,
  initialMode = 'unlock',
  accessToken,
}) => {
  const [mode, setMode] = useState<PinModalMode>(initialMode);

  // States for PIN entry
  const [pin, setPin] = useState<string>('');
  const [currentPin, setCurrentPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [step, setStep] = useState<number>(1);

  // Recovery state (Account Password preferred, or Hashed Security Question)
  const [secConfig, setSecConfig] = useState(() => getSecurityQuestions());
  const [recoveryMethod, setRecoveryMethod] = useState<'password' | 'question'>('password');
  const [accountPasswordInput, setAccountPasswordInput] = useState<string>('');
  const [answer1Input, setAnswer1Input] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const locked = isPinLockedOut();
      const loadedQuestions = getSecurityQuestions();
      const pinConfigured = hasSecurityPinSet();

      setSecConfig(loadedQuestions);
      setPin('');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setAccountPasswordInput('');
      setAnswer1Input('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsBusy(false);

      if (locked && pinConfigured) {
        setMode('recovery');
        setStep(1);
      } else if (!pinConfigured && (initialMode === 'unlock' || initialMode === 'change')) {
        setMode('setup');
        setStep(1);
      } else {
        setMode(initialMode);
        setStep(1);
      }
    }
  }, [isOpen, initialMode]);

  // Keyboard support for typing digits in PIN keypad modes
  useEffect(() => {
    if (!isOpen || isBusy) return;
    if (mode === 'recovery' && step === 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, pin, step, mode, currentPin, newPin, confirmPin]);

  if (!isOpen) return null;

  const resolveAuthToken = async (): Promise<string> => {
    const fresh = await getFreshAuthToken();
    const tok = fresh || accessToken;
    if (!tok) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    return tok;
  };

  const handleDigitClick = (digit: string) => {
    if (isBusy) return;
    setErrorMessage(null);

    if (mode === 'unlock') {
      if (pin.length < 4) {
        const nextPin = pin + digit;
        setPin(nextPin);
        if (nextPin.length === 4) {
          void validateUnlock(nextPin);
        }
      }
    } else if (mode === 'setup') {
      if (step === 1) {
        if (newPin.length < 4) {
          const next = newPin + digit;
          setNewPin(next);
          if (next.length === 4) {
            setTimeout(() => setStep(2), 180);
          }
        }
      } else {
        if (confirmPin.length < 4) {
          const next = confirmPin + digit;
          setConfirmPin(next);
          if (next.length === 4) {
            void validateSetup(newPin, next);
          }
        }
      }
    } else if (mode === 'change') {
      if (step === 1) {
        if (currentPin.length < 4) {
          const next = currentPin + digit;
          setCurrentPin(next);
          if (next.length === 4) {
            void verifyCurrentPinStep(next);
          }
        }
      } else if (step === 2) {
        if (newPin.length < 4) {
          const next = newPin + digit;
          setNewPin(next);
          if (next.length === 4) {
            setTimeout(() => setStep(3), 180);
          }
        }
      } else if (step === 3) {
        if (confirmPin.length < 4) {
          const next = confirmPin + digit;
          setConfirmPin(next);
          if (next.length === 4) {
            void validateChange(currentPin, newPin, next);
          }
        }
      }
    } else if (mode === 'recovery') {
      if (step === 2) {
        if (newPin.length < 4) {
          const next = newPin + digit;
          setNewPin(next);
          if (next.length === 4) {
            setTimeout(() => setStep(3), 180);
          }
        }
      } else if (step === 3) {
        if (confirmPin.length < 4) {
          const next = confirmPin + digit;
          setConfirmPin(next);
          if (next.length === 4) {
            void validateRecoveryPinReset(newPin, next);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isBusy) return;
    setErrorMessage(null);
    if (mode === 'unlock') {
      setPin((prev) => prev.slice(0, -1));
    } else if (mode === 'setup') {
      if (step === 1) setNewPin((prev) => prev.slice(0, -1));
      else setConfirmPin((prev) => prev.slice(0, -1));
    } else if (mode === 'change') {
      if (step === 1) setCurrentPin((prev) => prev.slice(0, -1));
      else if (step === 2) setNewPin((prev) => prev.slice(0, -1));
      else setConfirmPin((prev) => prev.slice(0, -1));
    } else if (mode === 'recovery') {
      if (step === 2) setNewPin((prev) => prev.slice(0, -1));
      else if (step === 3) setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (isBusy) return;
    setErrorMessage(null);
    if (mode === 'unlock') setPin('');
    else if (mode === 'setup') {
      if (step === 1) setNewPin('');
      else setConfirmPin('');
    } else if (mode === 'change') {
      if (step === 1) setCurrentPin('');
      else if (step === 2) setNewPin('');
      else setConfirmPin('');
    } else if (mode === 'recovery') {
      if (step === 2) setNewPin('');
      else if (step === 3) setConfirmPin('');
    }
  };

  const validateUnlock = async (entered: string) => {
    setIsBusy(true);
    try {
      const token = await resolveAuthToken();
      const res = await verifySecurityPinWithServer(token, entered);
      if (res.verified) {
        resetFailedAttempts();
        setSuccessMessage('PIN Verified! Unlocking...');
        setTimeout(() => {
          onSuccessUnlock();
          onClose();
        }, 300);
      } else {
        if (res.lockedOut) {
          setErrorMessage(res.error || '3 failed attempts. Please recover using your Account Password.');
          setTimeout(() => {
            setMode('recovery');
            setStep(1);
            setPin('');
          }, 700);
        } else {
          setErrorMessage(res.error || 'Incorrect PIN.');
          setTimeout(() => setPin(''), 500);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to verify PIN right now.');
      setPin('');
    } finally {
      setIsBusy(false);
    }
  };

  const verifyCurrentPinStep = async (enteredCurrent: string) => {
    setIsBusy(true);
    try {
      const token = await resolveAuthToken();
      const res = await verifySecurityPinWithServer(token, enteredCurrent);
      if (res.verified) {
        setStep(2);
      } else if (res.lockedOut) {
        setErrorMessage('3 failed attempts. Security recovery required.');
        setTimeout(() => {
          setMode('recovery');
          setStep(1);
          setCurrentPin('');
        }, 700);
      } else {
        setErrorMessage(res.error || 'Incorrect current PIN.');
        setTimeout(() => setCurrentPin(''), 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
      setCurrentPin('');
    } finally {
      setIsBusy(false);
    }
  };

  const validateSetup = async (nPin: string, cPin: string) => {
    if (nPin !== cPin) {
      setErrorMessage('PINs do not match. Please try again.');
      setConfirmPin('');
      setStep(1);
      setNewPin('');
      return;
    }
    setIsBusy(true);
    try {
      const token = await resolveAuthToken();
      const res = await updateSecurityPinWithServer(token, { newPin: nPin });
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to configure PIN.');
        setConfirmPin('');
        return;
      }
      setSuccessMessage('Optional Quick-Unlock PIN saved as a salted hash!');
      setTimeout(() => {
        onSuccessUnlock();
        onClose();
      }, 450);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save PIN.');
    } finally {
      setIsBusy(false);
    }
  };

  const validateChange = async (cPin: string, nPin: string, confPin: string) => {
    if (nPin !== confPin) {
      setErrorMessage('New PINs do not match. Please try again.');
      setConfirmPin('');
      setStep(2);
      return;
    }
    setIsBusy(true);
    try {
      const token = await resolveAuthToken();
      const res = await updateSecurityPinWithServer(token, { currentPin: cPin, newPin: nPin });
      if (res.success) {
        setSuccessMessage('PIN updated securely (salted PBKDF2 hash synced)!');
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setErrorMessage(res.error || 'Failed to update PIN.');
        setConfirmPin('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update PIN.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleProceedToResetPinStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (recoveryMethod === 'password') {
      if (!accountPasswordInput.trim()) {
        setErrorMessage('Please enter your FinanceFlow account password.');
        return;
      }
    } else {
      if (!answer1Input.trim()) {
        setErrorMessage('Please enter your recovery answer.');
        return;
      }
    }

    setStep(2);
  };

  const validateRecoveryPinReset = async (nPin: string, confPin: string) => {
    if (nPin !== confPin) {
      setErrorMessage('New PINs do not match. Please try again.');
      setConfirmPin('');
      setStep(2);
      return;
    }

    setIsBusy(true);
    try {
      const token = await resolveAuthToken();
      let firebaseReauthenticated = false;

      if (recoveryMethod === 'password' && accountPasswordInput) {
        try {
          firebaseReauthenticated = await verifyAccountPasswordForRecovery(accountPasswordInput);
        } catch {
          firebaseReauthenticated = false;
        }
      }

      const res = await recoverSecurityPinWithServer(token, {
        accountPassword: recoveryMethod === 'password' ? accountPasswordInput : undefined,
        firebaseReauthenticated,
        securityAnswer1: recoveryMethod === 'question' ? answer1Input : undefined,
        newPin: nPin,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Recovery verification failed. Please check your credentials.');
        setStep(1);
        setNewPin('');
        setConfirmPin('');
        return;
      }

      setSuccessMessage('PIN reset successfully! Unlocking...');
      setTimeout(() => {
        onSuccessUnlock();
        onClose();
      }, 650);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset PIN.');
      setStep(1);
    } finally {
      setIsBusy(false);
    }
  };

  const getActiveDigitsCount = () => {
    if (mode === 'unlock') return pin.length;
    if (mode === 'setup') return step === 1 ? newPin.length : confirmPin.length;
    if (mode === 'change') {
      if (step === 1) return currentPin.length;
      if (step === 2) return newPin.length;
      return confirmPin.length;
    }
    if (mode === 'recovery') {
      if (step === 2) return newPin.length;
      if (step === 3) return confirmPin.length;
    }
    return 0;
  };

  const activeDigits = getActiveDigitsCount();

  const getHeaderTitle = () => {
    if (mode === 'unlock') return 'Quick-Unlock PIN';
    if (mode === 'setup') return 'Set Optional PIN';
    if (mode === 'recovery') return 'Reset Quick-Unlock PIN';
    return 'Change Quick-Unlock PIN';
  };

  const getHeaderSubtitle = () => {
    if (mode === 'unlock') return 'Enter your 4-digit PIN to reveal protected amounts';
    if (mode === 'setup') return step === 1 ? 'Choose a 4-digit quick-unlock PIN' : 'Confirm your 4-digit PIN';
    if (mode === 'recovery') {
      if (step === 1) return 'Verify your account to set a new PIN';
      if (step === 2) return 'Enter new 4-digit PIN';
      return 'Confirm new 4-digit PIN';
    }
    if (step === 1) return 'Enter current 4-digit PIN';
    if (step === 2) return 'Enter new 4-digit PIN';
    return 'Confirm new 4-digit PIN';
  };

  return (
    <div
      id="security-pin-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div
        id="security-pin-card"
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all animate-scaleUp"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              {mode === 'unlock' ? (
                <Lock className="w-4 h-4" />
              ) : mode === 'recovery' ? (
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {getHeaderTitle()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                {getHeaderSubtitle()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Action Area */}
        <div className="p-4 sm:p-5 flex flex-col items-center text-center">
          {errorMessage && (
            <div className="w-full mb-3 px-3 py-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 text-center animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="w-full mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2 text-center">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* RECOVERY MODE - Step 1: Account Password or Hashed Security Question */}
          {mode === 'recovery' && step === 1 ? (
            <form onSubmit={handleProceedToResetPinStep} className="w-full space-y-3.5 text-left mt-1">
              {secConfig.hasQuestion1Set && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryMethod('password');
                      setErrorMessage(null);
                    }}
                    className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                      recoveryMethod === 'password'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Account Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryMethod('question');
                      setErrorMessage(null);
                    }}
                    className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                      recoveryMethod === 'question'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Recovery Question
                  </button>
                </div>
              )}

              {recoveryMethod === 'password' ? (
                <>
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl text-[11px] text-indigo-800 dark:text-indigo-300 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      Confirm your FinanceFlow account login password to securely reset your 4-digit quick-unlock PIN.
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Account Login Password
                    </label>
                    <input
                      type="password"
                      value={accountPasswordInput}
                      onChange={(e) => {
                        setAccountPasswordInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="Enter your account password..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                      autoFocus
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      Your answer is verified against the salted PBKDF2 hash on the server.
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {secConfig.question1 || 'Security Recovery Question'}
                    </label>
                    <input
                      type="password"
                      value={answer1Input}
                      onChange={(e) => {
                        setAnswer1Input(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="Enter your recovery answer..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                      autoFocus
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                id="btn-verify-security-answers"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-2"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Continue to Set New PIN</span>
              </button>
            </form>
          ) : (
            /* NUMERIC KEYPAD & PIN DOTS */
            <>
              <div className="flex items-center justify-center gap-3 my-3">
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = index < activeDigits;
                  return (
                    <div
                      key={index}
                      className={`transition-all duration-150 w-4 h-4 rounded-full ${
                        isFilled
                          ? 'bg-indigo-600 dark:bg-indigo-500 scale-110 shadow-sm shadow-indigo-500/30'
                          : 'border-2 border-slate-300 dark:border-slate-700 bg-transparent'
                      }`}
                    />
                  );
                })}
              </div>

              {isBusy && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 my-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying securely...</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    id={`btn-pin-${num}`}
                    disabled={isBusy}
                    onClick={() => handleDigitClick(String(num))}
                    className="h-11 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-100 font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  id="btn-pin-clear"
                  disabled={isBusy}
                  onClick={handleClear}
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 text-slate-500 dark:text-slate-400 font-semibold text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  id="btn-pin-0"
                  disabled={isBusy}
                  onClick={() => handleDigitClick('0')}
                  className="h-11 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-100 font-bold text-base sm:text-lg flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  id="btn-pin-backspace"
                  disabled={isBusy}
                  onClick={handleBackspace}
                  className="h-11 sm:h-12 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                >
                  <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </>
          )}

          {/* Footer Action Links */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 w-full flex items-center justify-between text-xs px-1">
            {mode === 'unlock' ? (
              <>
                <button
                  type="button"
                  id="btn-modal-forgot-pin"
                  onClick={() => {
                    setMode('recovery');
                    setStep(1);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-medium transition-colors cursor-pointer"
                >
                  Forgot PIN?
                </button>

                <button
                  type="button"
                  id="btn-modal-change-pin"
                  onClick={() => {
                    setMode('change');
                    setStep(1);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setCurrentPin('');
                    setNewPin('');
                    setConfirmPin('');
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold transition-colors cursor-pointer"
                >
                  Change PIN
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (hasSecurityPinSet()) {
                    setMode('unlock');
                    setStep(1);
                    setPin('');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  } else {
                    onClose();
                  }
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold mx-auto cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{hasSecurityPinSet() ? 'Back to Unlock' : 'Cancel'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
