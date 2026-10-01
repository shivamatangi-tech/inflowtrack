/**
 * ============================================================================
 * File: src/utils/security.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Client-side security helper for the optional 4-digit quick-unlock PIN,
 *   PIN recovery workflows, and session inactivity auto-lock/logout settings.
 *
 * Key Responsibilities & Security Guarantees:
 *   1. NEVER stores plaintext PINs or plaintext security-question answers in
 *      localStorage, sessionStorage, or Google Sheets.
 *   2. Automatically scrubs any legacy plaintext keys from browser storage.
 *   3. Communicates with `/api/security/*` using the user's verified Firebase
 *      ID Token so PINs and recovery answers are salted and hashed with
 *      PBKDF2-HMAC-SHA256 (100,000 iterations) on the backend.
 *   4. Manages configurable session inactivity timeout (e.g., 5, 15, 30, 60
 *      minutes) and action ('lock' PIN screen or 'logout' full account).
 * ============================================================================
 */

import { SecurityQuestionConfig } from '../types';

const SEC_METADATA_STORAGE_KEY = 'financeflow_security_metadata_v2';
const FAILED_ATTEMPTS_STORAGE_KEY = 'financeflow_failed_pin_attempts_v2';

export const DEFAULT_SECURITY_CONFIG: SecurityQuestionConfig = {
  pinEnabled: false,
  hasPinSet: false,
  pinLoginEnabled: false,
  hasPinLoginSet: false,
  question1: 'What is your primary bank name or secret recovery keyword?',
  hasQuestion1Set: false,
  question2: '',
  hasQuestion2Set: false,
  inactivityTimeoutMinutes: 15,
  inactivityAction: 'lock',
};

/**
 * Scrubs any legacy plaintext PIN or security answer keys from localStorage.
 */
export function scrubLegacyPlaintextSecurityStorage(): void {
  try {
    localStorage.removeItem('financeflow_sheet_pin');
    localStorage.removeItem('financeflow_security_pin');
    localStorage.removeItem('financeflow_security_config');
    localStorage.removeItem('financeflow_google_access_token');
  } catch {
    // Ignore storage errors in restricted environments
  }
}

/**
 * Safely cleans a numeric PIN input string.
 */
export function cleanPin(rawPin: unknown): string {
  if (rawPin === null || rawPin === undefined) return '';
  const str = String(rawPin).trim();
  return str.replace(/^['"]+|['"]+$/g, '').trim();
}

/**
 * Synchronizes non-sensitive security metadata (boolean flags & question text ONLY — never plaintext PINs or answers).
 */
export function syncSecurityConfigMetadata(secConfig?: Partial<SecurityQuestionConfig>): void {
  scrubLegacyPlaintextSecurityStorage();
  if (!secConfig) return;
  try {
    const current = getSecurityQuestions();
    const updated: SecurityQuestionConfig = {
      pinEnabled: secConfig.pinEnabled ?? current.pinEnabled ?? false,
      hasPinSet: secConfig.hasPinSet ?? current.hasPinSet ?? false,
      pinLoginEnabled: secConfig.pinLoginEnabled ?? current.pinLoginEnabled ?? false,
      hasPinLoginSet: secConfig.hasPinLoginSet ?? current.hasPinLoginSet ?? false,
      question1: secConfig.question1 || current.question1 || DEFAULT_SECURITY_CONFIG.question1,
      hasQuestion1Set: secConfig.hasQuestion1Set ?? current.hasQuestion1Set ?? false,
      question2: secConfig.question2 ?? current.question2 ?? '',
      hasQuestion2Set: secConfig.hasQuestion2Set ?? current.hasQuestion2Set ?? false,
      inactivityTimeoutMinutes:
        secConfig.inactivityTimeoutMinutes !== undefined
          ? secConfig.inactivityTimeoutMinutes
          : current.inactivityTimeoutMinutes ?? 15,
      inactivityAction: secConfig.inactivityAction || current.inactivityAction || 'lock',
    };
    localStorage.setItem(SEC_METADATA_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Gets non-sensitive Security Configuration metadata.
 */
export function getSecurityQuestions(): SecurityQuestionConfig {
  try {
    const raw = localStorage.getItem(SEC_METADATA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pinEnabled: Boolean(parsed.pinEnabled),
        hasPinSet: Boolean(parsed.hasPinSet),
        pinLoginEnabled: Boolean(parsed.pinLoginEnabled),
        hasPinLoginSet: Boolean(parsed.hasPinLoginSet),
        question1: parsed.question1 || DEFAULT_SECURITY_CONFIG.question1,
        hasQuestion1Set: Boolean(parsed.hasQuestion1Set),
        question2: parsed.question2 || '',
        hasQuestion2Set: Boolean(parsed.hasQuestion2Set),
        inactivityTimeoutMinutes:
          typeof parsed.inactivityTimeoutMinutes === 'number' ? parsed.inactivityTimeoutMinutes : 15,
        inactivityAction: parsed.inactivityAction === 'logout' ? 'logout' : 'lock',
      };
    }
  } catch {
    // Return default
  }
  return { ...DEFAULT_SECURITY_CONFIG };
}

/**
 * Checks whether Easy PIN Login is configured and enabled for this user.
 */
export function hasPinLoginConfigured(): boolean {
  const cfg = getSecurityQuestions();
  return Boolean(cfg.pinLoginEnabled && cfg.hasPinLoginSet);
}

/**
 * Checks whether the user has configured an optional quick-unlock PIN.
 */
export function hasSecurityPinSet(): boolean {
  const cfg = getSecurityQuestions();
  return Boolean(cfg.hasPinSet && cfg.pinEnabled);
}

/**
 * Returns the configured inactivity timeout in minutes (default 15 mins).
 */
export function getInactivityTimeoutMinutes(): number {
  const cfg = getSecurityQuestions();
  return typeof cfg.inactivityTimeoutMinutes === 'number' ? cfg.inactivityTimeoutMinutes : 15;
}

/**
 * Returns the configured inactivity action ('lock' or 'logout').
 */
export function getInactivityAction(): 'lock' | 'logout' {
  const cfg = getSecurityQuestions();
  return cfg.inactivityAction === 'logout' ? 'logout' : 'lock';
}

/**
 * Tracks failed PIN attempts locally (synced with backend lockout).
 */
export function getFailedAttemptsCount(): number {
  try {
    const count = localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY);
    return count ? parseInt(count, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function recordFailedAttempt(serverCount?: number): number {
  try {
    const next = typeof serverCount === 'number' ? serverCount : getFailedAttemptsCount() + 1;
    localStorage.setItem(FAILED_ATTEMPTS_STORAGE_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function resetFailedAttempts(): void {
  try {
    localStorage.removeItem(FAILED_ATTEMPTS_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function isPinLockedOut(): boolean {
  return getFailedAttemptsCount() >= 3;
}

/**
 * Verifies the entered PIN against the backend PBKDF2-SHA256 salted hash for the authenticated user.
 */
export async function verifySecurityPinWithServer(
  authToken: string,
  enteredPin: string
): Promise<{ verified: boolean; lockedOut?: boolean; failedAttempts?: number; error?: string }> {
  const clean = cleanPin(enteredPin);
  if (!clean || clean.length < 4) {
    return { verified: false, error: 'Please enter a valid 4-digit PIN.' };
  }

  const res = await fetch('/api/security/verify-pin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pin: clean }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.verified) {
    resetFailedAttempts();
    return { verified: true, failedAttempts: 0 };
  }

  const attempts = recordFailedAttempt(data.failedAttempts);
  return {
    verified: false,
    lockedOut: Boolean(data.lockedOut || attempts >= 3),
    failedAttempts: attempts,
    error: data.error || `Incorrect PIN. (Attempt ${attempts} of 3)`,
  };
}

/**
 * Sets, changes, or disables the user's optional quick-unlock PIN via backend salted PBKDF2 hashing.
 */
export async function updateSecurityPinWithServer(
  authToken: string,
  options: { currentPin?: string; newPin?: string; disablePin?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/security/set-pin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || 'Failed to update security PIN.' };
  }

  syncSecurityConfigMetadata({
    pinEnabled: Boolean(data.pinEnabled),
    hasPinSet: Boolean(data.hasPinSet),
  });
  resetFailedAttempts();
  return { success: true };
}

/**
 * Sets, updates, or disables Easy PIN Login in Firebase for the authenticated user.
 */
export async function setupPinLoginWithServer(
  authToken: string,
  options: { pin?: string; accountPassword?: string; enable: boolean }
): Promise<{ success: boolean; pinLoginEnabled?: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/security/setup-pin-login', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || 'Failed to update Easy PIN Login configuration.' };
  }

  syncSecurityConfigMetadata({
    pinLoginEnabled: Boolean(data.pinLoginEnabled),
    hasPinLoginSet: Boolean(data.hasPinLoginSet),
  });

  return {
    success: true,
    pinLoginEnabled: Boolean(data.pinLoginEnabled),
    message: data.message || 'Easy PIN Login preferences updated successfully.',
  };
}

/**
 * Recovers/resets a locked or forgotten PIN using either the user's Account Password
 * (recommended) or their hashed Security Question Answer.
 */
export async function recoverSecurityPinWithServer(
  authToken: string,
  payload: {
    accountPassword?: string;
    firebaseReauthenticated?: boolean;
    securityAnswer1?: string;
    newPin: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/security/recover-pin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'Recovery verification failed. Please check your credentials.',
    };
  }

  syncSecurityConfigMetadata({ pinEnabled: true, hasPinSet: true });
  resetFailedAttempts();
  return { success: true };
}

/**
 * Updates the user's security recovery question (stored as a salted PBKDF2 hash on the server)
 * and/or inactivity timeout configuration.
 */
export async function saveSecurityRecoverySettings(
  authToken: string,
  settings: {
    question1?: string;
    answer1?: string;
    question2?: string;
    answer2?: string;
    inactivityTimeoutMinutes?: number;
    inactivityAction?: 'lock' | 'logout';
  }
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/security/recovery-questions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || 'Failed to update security settings.' };
  }

  syncSecurityConfigMetadata({
    question1: data.question1,
    hasQuestion1Set: data.hasQuestion1Set,
    question2: data.question2,
    hasQuestion2Set: data.hasQuestion2Set,
    inactivityTimeoutMinutes: data.inactivityTimeoutMinutes,
    inactivityAction: data.inactivityAction,
  });

  return { success: true };
}

/**
 * Saves inactivity settings to local security metadata and optionally to the backend.
 */
export function saveInactivitySettings(
  timeoutMinutes: number,
  inactivityAction: 'lock' | 'logout'
): void {
  syncSecurityConfigMetadata({
    inactivityTimeoutMinutes: timeoutMinutes,
    inactivityAction,
  });
}

/**
 * Saves security recovery questions to the backend server and updates local security metadata.
 */
export async function saveSecurityQuestionsWithServer(
  authToken: string | null,
  questions: {
    question1: string;
    answer1: string;
    question2?: string;
    answer2?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (authToken) {
    return saveSecurityRecoverySettings(authToken, questions);
  }
  syncSecurityConfigMetadata({
    question1: questions.question1,
    hasQuestion1Set: Boolean(questions.answer1),
    question2: questions.question2,
    hasQuestion2Set: Boolean(questions.answer2),
  });
  return { success: true };
}

/**
 * Retrieves the stored security questions and inactivity configuration.
 */
export const getStoredSecurityQuestionConfig = getSecurityQuestions;

export function resetSecurityPin(): void {
  scrubLegacyPlaintextSecurityStorage();
  resetFailedAttempts();
  try {
    localStorage.removeItem(SEC_METADATA_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
