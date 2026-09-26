/**
 * ============================================================================
 * File: src/services/firebase.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Firebase Authentication service (Authentication & Session Security ONLY).
 *   Connects to Firebase project `inflowtrack-06` via `firebase-applet-config.json`.
 *
 * Key Responsibilities:
 *   1. Email + Password Registration (`registerWithEmailPassword`), Sign-In
 *      (`loginWithEmailPassword`), and Sign-Out (`logout`).
 *   2. Password Reset Email (`sendPasswordReset`) and Authenticated Password
 *      Change (`changeAccountPassword`).
 *   3. Session Persistence (`browserLocalPersistence` when "Remember me" is
 *      checked, or `browserSessionPersistence` otherwise) and automatic ID
 *      token refresh (`getFreshAuthToken`).
 *   4. Does NOT use Cloud Firestore or Direct GSI OAuth. All financial data
 *      is stored in Google Sheets via backend-verified UID tokens.
 * ============================================================================
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleUser } from '../types';
import { scrubLegacyPlaintextSecurityStorage } from '../utils/security';

// Initialize Firebase App strictly for Authentication (NO Firestore)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const SESSION_TOKEN_KEY = 'financeflow_auth_session_token';
const SESSION_USER_KEY = 'financeflow_auth_session_user';
const REMEMBER_ME_KEY = 'financeflow_remember_session';

let cachedToken: string | null = null;
let cachedUser: GoogleUser | null = null;

function getStorage(): Storage {
  try {
    const remember = localStorage.getItem(REMEMBER_ME_KEY);
    if (remember === 'false') {
      return sessionStorage;
    }
    return localStorage;
  } catch {
    return localStorage;
  }
}

/**
 * Maps technical Firebase Auth errors into clear, user-friendly messages.
 * Never exposes technical credentials, tokens, or stack traces.
 */
export function formatAuthErrorMessage(err: unknown, fallbackMessage: string): string {
  if (!err) return fallbackMessage;
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    msg.includes('wrong-password') ||
    msg.includes('invalid-credential')
  ) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
    return 'No account found with this email address. Please register or check your email.';
  }
  if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (code === 'auth/weak-password' || msg.includes('weak-password')) {
    return 'Password is too weak. Please choose a password with at least 6 characters.';
  }
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return 'Too many failed attempts. Please wait a few minutes or reset your password.';
  }
  if (code === 'auth/user-token-expired' || code === 'auth/requires-recent-login') {
    return 'Your session has expired. Please sign in again to continue.';
  }
  if (code === 'auth/network-request-failed' || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    return 'Network unavailable. Please check your internet connection and try again.';
  }

  // Strip any technical "Firebase: Error (auth/...)" wrapper if present
  if (msg.startsWith('Firebase:')) {
    return fallbackMessage;
  }
  return msg || fallbackMessage;
}

function mapFirebaseUser(fbUser: FirebaseUser): GoogleUser {
  return {
    uid: fbUser.uid,
    email: fbUser.email || null,
    displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'FinanceFlow User'),
    photoURL: fbUser.photoURL || null,
    authProvider: 'firebase',
  };
}

function persistSession(user: GoogleUser, token: string, rememberMe = true): void {
  cachedUser = user;
  cachedToken = token;
  try {
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
    const targetStorage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem(SESSION_TOKEN_KEY);
    otherStorage.removeItem(SESSION_USER_KEY);
    targetStorage.setItem(SESSION_TOKEN_KEY, token);
    targetStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }
}

function clearPersistedSession(): void {
  cachedUser = null;
  cachedToken = null;
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    // Also remove any legacy GSI keys
    localStorage.removeItem('financeflow_google_access_token');
    localStorage.removeItem('financeflow_google_user');
    localStorage.removeItem('financeflow_token_expiry');
  } catch {
    // Ignore
  }
}

/**
 * Initializes authentication state and listens for Firebase Auth session changes.
 */
export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
): (() => void) => {
  // Always scrub any legacy plaintext PINs or OAuth tokens on boot
  scrubLegacyPlaintextSecurityStorage();

  let unsubscribed = false;

  const unsubscribeFirebase = onAuthStateChanged(auth, async (fbUser) => {
    if (unsubscribed) return;

    if (fbUser) {
      try {
        const idToken = await fbUser.getIdToken();
        const mapped = mapFirebaseUser(fbUser);
        const remember = localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
        persistSession(mapped, idToken, remember);
        if (onAuthSuccess) onAuthSuccess(mapped, idToken);
        return;
      } catch {
        // Fall through to check server session
      }
    }

    // Check if there is an active server-verified personal session
    try {
      const storage = getStorage();
      const savedToken = storage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
      const savedUserRaw = storage.getItem(SESSION_USER_KEY) || localStorage.getItem(SESSION_USER_KEY);

      if (savedToken && savedUserRaw) {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const verifiedUser: GoogleUser = data.user || JSON.parse(savedUserRaw);
          cachedToken = savedToken;
          cachedUser = verifiedUser;
          if (onAuthSuccess) onAuthSuccess(verifiedUser, savedToken);
          return;
        }
      }
    } catch {
      // Session invalid or network offline
    }

    clearPersistedSession();
    if (onAuthFailure) onAuthFailure();
  });

  return () => {
    unsubscribed = true;
    unsubscribeFirebase();
  };
};

/**
 * Registers a new user with Email + Password using Firebase Authentication.
 */
export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName?: string,
  rememberMe = true
): Promise<{ user: GoogleUser; accessToken: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (displayName && displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    const idToken = await credential.user.getIdToken();
    const user: GoogleUser = {
      uid: credential.user.uid,
      email: credential.user.email || cleanEmail,
      displayName: displayName?.trim() || credential.user.displayName || cleanEmail.split('@')[0],
      photoURL: null,
      authProvider: 'firebase',
    };
    persistSession(user, idToken, rememberMe);
    return { user, accessToken: idToken };
  } catch (fbErr: any) {
    const code = fbErr?.code || '';
    // If Firebase Console Email/Password provider is not yet toggled on, use server-side PBKDF2 personal auth
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/admin-restricted-operation'
    ) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }
      persistSession(data.user, data.token, rememberMe);
      return { user: data.user, accessToken: data.token };
    }

    throw new Error(formatAuthErrorMessage(fbErr, 'Unable to create account. Please try again.'));
  }
}

/**
 * Signs in an existing user with Email + Password using Firebase Authentication.
 */
export async function loginWithEmailPassword(
  email: string,
  password: string,
  rememberMe = true
): Promise<{ user: GoogleUser; accessToken: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const idToken = await credential.user.getIdToken();
    const user = mapFirebaseUser(credential.user);
    persistSession(user, idToken, rememberMe);
    return { user, accessToken: idToken };
  } catch (fbErr: any) {
    const code = fbErr?.code || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential'
    ) {
      // Check server-side personal auth store if account was created before Firebase Console toggle
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        if (res.ok) {
          const data = await res.json();
          persistSession(data.user, data.token, rememberMe);
          return { user: data.user, accessToken: data.token };
        }
      } catch {
        // Ignore and throw formatted error below
      }
    }

    throw new Error(formatAuthErrorMessage(fbErr, 'Incorrect email or password. Please try again.'));
  }
}

/**
 * Sends a Firebase password reset email.
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address to reset your password.');
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return 'Password reset link has been sent to your email address. Please check your inbox.';
  } catch (fbErr: any) {
    const code = fbErr?.code || '';
    if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
      const res = await fetch('/api/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed. Please verify your email address.');
      }
      return 'Account verified. Enable Email/Password in Firebase Console to receive automated reset emails, or change your password in Settings.';
    }
    throw new Error(formatAuthErrorMessage(fbErr, 'Password reset failed. Please verify your email and try again.'));
  }
}

/**
 * Changes the currently authenticated user's password.
 */
export async function changeAccountPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!currentPassword) {
    throw new Error('Please enter your current password.');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const fbUser = auth.currentUser;
  if (fbUser && fbUser.email) {
    try {
      const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
      await reauthenticateWithCredential(fbUser, credential);
      await updatePassword(fbUser, newPassword);
      const freshToken = await fbUser.getIdToken(true);
      if (cachedUser) {
        persistSession(cachedUser, freshToken, localStorage.getItem(REMEMBER_ME_KEY) !== 'false');
      }
      return;
    } catch (fbErr: any) {
      throw new Error(formatAuthErrorMessage(fbErr, 'Failed to change password. Please verify your current password.'));
    }
  }

  // Fallback for personal server-authenticated account
  const token = await getFreshAuthToken();
  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to change password. Please verify your current password.');
  }
}

/**
 * Verifies the user's account password for sensitive operations (such as PIN recovery).
 */
export async function verifyAccountPasswordForRecovery(password: string): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (fbUser && fbUser.email) {
    const credential = EmailAuthProvider.credential(fbUser.email, password);
    await reauthenticateWithCredential(fbUser, credential);
    return true;
  }
  return false;
}

/**
 * Returns a fresh Firebase ID Token (or active session token) for backend verification.
 */
export async function getFreshAuthToken(): Promise<string | null> {
  try {
    if (auth.currentUser) {
      const fresh = await auth.currentUser.getIdToken();
      cachedToken = fresh;
      return fresh;
    }
  } catch {
    // Fallback to cached token
  }
  return getAccessToken();
}

export const getAccessToken = (): string | null => {
  if (cachedToken) return cachedToken;
  try {
    return (
      sessionStorage.getItem(SESSION_TOKEN_KEY) ||
      localStorage.getItem(SESSION_TOKEN_KEY) ||
      null
    );
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string | null) => {
  cachedToken = token;
};

export const getCurrentUser = (): GoogleUser | null => {
  return cachedUser;
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error
  }
  clearPersistedSession();
};
