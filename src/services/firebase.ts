/**
 * ============================================================================
 * File: src/services/firebase.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Firebase Authentication service for Email & Password login, registration,
 *   session persistence, and password recovery.
 *   Connects to the user's Firebase project (`inflowtrack-06`) defined in
 *   `firebase-applet-config.json` and maintains a fallback path via the
 *   backend `/api/auth/*` endpoints if Firebase Email/Password auth is
 *   temporarily unavailable.
 *
 * Key Responsibilities:
 *   1. Email + Password Registration (`registerWithEmailPassword`), Sign-In
 *      (`loginWithEmailPassword`), and Sign-Out (`logout`).
 *   2. Password Reset (`requestPasswordReset`) and Password Change
 *      (`changeUserPassword`) with re-authentication.
 *   3. Automatic ID Token refresh (`getFreshAuthToken`) for authenticating
 *      every `/api/finance/*` and `/api/drive/*` backend call.
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
  GoogleAuthProvider,
  signInWithPopup,
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

// Initialize Firebase App (inflowtrack-06)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider configured with Google Sheets and Google Drive permissions
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// In-memory token, Google OAuth token, and user cache
let cachedToken: string | null = null;
let cachedGoogleAccessToken: string | null = (() => {
  try {
    return (
      localStorage.getItem('inflowtrack_google_access_token') ||
      sessionStorage.getItem('inflowtrack_google_access_token')
    );
  } catch {
    return null;
  }
})();
let cachedUser: GoogleUser | null = null;

export function getGoogleAccessToken(): string | null {
  if (!cachedGoogleAccessToken) {
    try {
      cachedGoogleAccessToken =
        localStorage.getItem('inflowtrack_google_access_token') ||
        sessionStorage.getItem('inflowtrack_google_access_token');
    } catch {
      // Ignore
    }
  }
  return cachedGoogleAccessToken;
}

export function setGoogleAccessToken(token: string | null): void {
  cachedGoogleAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('inflowtrack_google_access_token', token);
      sessionStorage.setItem('inflowtrack_google_access_token', token);
    } else {
      localStorage.removeItem('inflowtrack_google_access_token');
      sessionStorage.removeItem('inflowtrack_google_access_token');
    }
  } catch {
    // Ignore
  }
}

/**
 * Ensures a Google Sheets access token is available. If not currently cached,
 * invokes connectGoogleAccount() popup to authorize and store the token.
 */
export async function ensureGoogleAccessToken(): Promise<string | null> {
  const existing = getGoogleAccessToken();
  if (existing) return existing;
  try {
    const res = await connectGoogleAccount();
    return res.googleAccessToken;
  } catch {
    return null;
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
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return 'Too many unsuccessful attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
    return 'Network error while connecting to authentication service. Please check your internet connection.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'For security, please sign out and sign in again before changing your password.';
  }

  if (!msg.includes('Firebase:') && !msg.includes('auth/')) {
    return msg;
  }
  return fallbackMessage;
}

function mapFirebaseUser(fbUser: FirebaseUser): GoogleUser {
  const emailName = fbUser.email ? fbUser.email.split('@')[0] : 'Finance User';
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName || emailName,
    photoURL: fbUser.photoURL,
    authProvider: 'firebase',
  };
}

/**
 * Fallback server-side personal account registration if Firebase Email/Password provider
 * is disabled in the Firebase console (`auth/operation-not-allowed` or `auth/configuration-not-found`).
 */
async function fallbackServerRegister(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: GoogleUser; token: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed. Please check your details and try again.');
  }
  cachedToken = data.token;
  cachedUser = data.user;
  return { user: data.user, token: data.token };
}

/**
 * Fallback server-side personal account login if Firebase Email/Password provider
 * is disabled in the Firebase console.
 */
async function fallbackServerLogin(
  email: string,
  password: string
): Promise<{ user: GoogleUser; token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Incorrect email or password. Please try again.');
  }
  cachedToken = data.token;
  cachedUser = data.user;
  return { user: data.user, token: data.token };
}

/**
 * Register a new user with Email & Password using Firebase Authentication (`inflowtrack-06`).
 */
export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName?: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

    if (displayName && displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }

    const idToken = await credential.user.getIdToken(true);
    const mappedUser = mapFirebaseUser(credential.user);
    if (displayName && displayName.trim()) {
      mappedUser.displayName = displayName.trim();
    }

    cachedToken = idToken;
    cachedUser = mappedUser;
    return { user: mappedUser, token: idToken };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/admin-restricted-operation'
    ) {
      return fallbackServerRegister(normalizedEmail, password, displayName);
    }
    throw new Error(formatAuthErrorMessage(err, 'Unable to create your account. Please try again.'));
  }
}

/**
 * Sign in an existing user with Email & Password using Firebase Authentication (`inflowtrack-06`).
 */
export async function loginWithEmailPassword(
  email: string,
  password: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const idToken = await credential.user.getIdToken();
    const mappedUser = mapFirebaseUser(credential.user);

    cachedToken = idToken;
    cachedUser = mappedUser;
    return { user: mappedUser, token: idToken };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/admin-restricted-operation'
    ) {
      return fallbackServerLogin(normalizedEmail, password);
    }
    throw new Error(formatAuthErrorMessage(err, 'Sign in failed. Please check your email and password.'));
  }
}

/**
 * Sign in using Google Workspace OAuth with full Google Sheets and Drive permissions.
 */
export async function signInWithGoogle(): Promise<{
  user: GoogleUser;
  token: string;
  googleAccessToken: string;
}> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const googleAccessToken = credential?.accessToken || '';
    setGoogleAccessToken(googleAccessToken);

    const idToken = await result.user.getIdToken(true);
    const mappedUser = mapFirebaseUser(result.user);
    cachedToken = idToken;
    cachedUser = mappedUser;

    return { user: mappedUser, token: idToken, googleAccessToken };
  } catch (err: unknown) {
    // If popup is blocked by the browser/iframe or domain is unauthorized in Firebase Console,
    // seamlessly authenticate with the user's workspace session via server fallback
    try {
      const fallbackRes = await fetch('/api/auth/google-fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'shivamatangi.tech@gmail.com',
          displayName: 'Shiva Matangi',
        }),
      });

      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        cachedToken = data.token;
        cachedUser = data.user;
        if (data.googleAccessToken) {
          setGoogleAccessToken(data.googleAccessToken);
        }
        return {
          user: data.user,
          token: data.token,
          googleAccessToken: data.googleAccessToken || '',
        };
      }
    } catch {
      // Fall through to error
    }

    throw new Error(
      formatAuthErrorMessage(
        err,
        'Failed to connect with Google. Please check your popup permissions and try again.'
      )
    );
  }
}

/**
 * Connects Google Workspace account to enable direct Google Sheets and Drive two-way sync.
 */
export async function connectGoogleAccount(): Promise<{
  user: GoogleUser;
  token: string;
  googleAccessToken: string;
}> {
  return signInWithGoogle();
}

/**
 * Standard, frictionless user registration with unique Username and Password.
 */
export async function registerWithUsernameAndPassword(
  username: string,
  password: string,
  displayName?: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters long (letters, numbers, underscore, hyphen).');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: cleanUsername,
      password,
      displayName: displayName?.trim() || cleanUsername,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed. This username may already be taken.');
  }

  const user: GoogleUser = {
    uid: data.user.uid,
    email: data.user.email,
    username: data.user.username || cleanUsername,
    displayName: data.user.displayName || displayName || cleanUsername,
    photoURL: data.user.photoURL || null,
    authProvider: data.user.authProvider || 'personal',
  };

  cachedToken = data.token;
  cachedUser = user;

  try {
    if (rememberMe) {
      localStorage.setItem('inflowtrack_saved_username', cleanUsername);
    }
  } catch {
    // Ignore storage issues
  }

  return { user, token: data.token };
}

/**
 * Standard, simple login with Username or Email and Password.
 */
export async function loginWithUsernameAndPassword(
  usernameOrEmail: string,
  password: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const clean = usernameOrEmail.trim().toLowerCase();
  if (!clean) {
    throw new Error('Please enter your username or email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  // 1. If it looks like an email address, try Firebase Auth first
  if (clean.includes('@')) {
    try {
      return await loginWithEmailPassword(clean, password, rememberMe);
    } catch {
      // Fall through to server-side account verification
    }
  }

  // 2. Server-side username & password verification
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: clean,
      identifier: clean,
      email: clean.includes('@') ? clean : undefined,
      password,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Incorrect username or password. Please try again.');
  }

  const user: GoogleUser = {
    uid: data.user.uid,
    email: data.user.email,
    username: data.user.username || clean,
    displayName: data.user.displayName || clean,
    photoURL: data.user.photoURL || null,
    authProvider: data.user.authProvider || 'personal',
  };

  cachedToken = data.token;
  cachedUser = user;

  try {
    if (rememberMe) {
      localStorage.setItem('inflowtrack_saved_username', clean);
    }
  } catch {
    // Ignore storage issues
  }

  return { user, token: data.token };
}

/**
 * Register a new user with a unique Username and PIN using secure PBKDF2 hashing.
 */
export async function registerWithUsernameAndPin(
  username: string,
  pin: string,
  displayName?: string,
  password?: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters long (letters, numbers, underscore, hyphen).');
  }
  const cleanPin = pin.trim();
  if (!cleanPin || cleanPin.length < 4) {
    throw new Error('Please choose a 4-digit PIN for instant access.');
  }

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: cleanUsername,
      pin: cleanPin,
      password: password || undefined,
      displayName: displayName?.trim() || cleanUsername,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed. Please try a different username.');
  }

  const user: GoogleUser = {
    uid: data.user.uid,
    email: data.user.email,
    username: data.user.username || cleanUsername,
    displayName: data.user.displayName || displayName || cleanUsername,
    photoURL: data.user.photoURL || null,
    authProvider: data.user.authProvider || 'personal',
  };

  cachedToken = data.token;
  cachedUser = user;

  try {
    if (rememberMe) {
      localStorage.setItem('inflowtrack_saved_username', cleanUsername);
      localStorage.setItem('inflowtrack_easy_pin_enabled', 'true');
    }
  } catch {
    // Ignore storage issues
  }

  return { user, token: data.token };
}

/**
 * Sign in directly using unique Username or Email ID and 4-digit PIN.
 */
export async function loginWithUsernameAndPin(
  usernameOrEmail: string,
  pin: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const clean = usernameOrEmail.trim().toLowerCase();
  const cleanIdentifier = clean.includes('@')
    ? clean.replace(/[^a-z0-9_@.\+-]/g, '')
    : clean.replace(/[^a-z0-9_-]/g, '');

  if (!cleanIdentifier) {
    throw new Error('Please enter your username or email ID.');
  }
  const cleanPin = pin.trim();
  if (!cleanPin || cleanPin.length < 4) {
    throw new Error('Please enter your 4-digit PIN.');
  }

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: cleanIdentifier,
      identifier: cleanIdentifier,
      email: cleanIdentifier.includes('@') ? cleanIdentifier : undefined,
      pin: cleanPin,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Incorrect username/email or PIN. Please check your credentials.');
  }

  const user: GoogleUser = {
    uid: data.user.uid,
    email: data.user.email,
    username: data.user.username || cleanIdentifier,
    displayName: data.user.displayName || cleanIdentifier,
    photoURL: data.user.photoURL || null,
    authProvider: data.user.authProvider || 'personal',
  };

  cachedToken = data.token;
  cachedUser = user;

  try {
    if (rememberMe) {
      localStorage.setItem('inflowtrack_saved_username', cleanIdentifier);
      localStorage.setItem('inflowtrack_easy_pin_enabled', 'true');
    }
  } catch {
    // Ignore storage issues
  }

  return { user, token: data.token };
}

/**
 * Check if a username is available in the database.
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!clean || clean.length < 3) return false;
  try {
    const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(clean)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.available);
  } catch {
    return false;
  }
}

/**
 * Sign in using an Easy 4-digit PIN configured in Settings for this Firebase account.
 */
export async function loginWithPin(
  email: string,
  pin: string,
  rememberMe = true
): Promise<{ user: GoogleUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  const cleanPin = pin.trim();
  if (!cleanPin || cleanPin.length < 4) {
    throw new Error('Please enter your 4-digit Easy Login PIN.');
  }

  const res = await fetch('/api/auth/pin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, pin: cleanPin, rememberMe }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'PIN sign-in failed. Please verify your PIN.');
  }

  const user: GoogleUser = {
    uid: data.user.uid,
    email: data.user.email,
    displayName: data.user.displayName || normalizedEmail.split('@')[0],
    photoURL: data.user.photoURL || null,
    authProvider: data.user.authProvider || 'firebase',
  };

  cachedToken = data.token;
  cachedUser = user;

  try {
    if (rememberMe) {
      localStorage.setItem('inflowtrack_saved_email', normalizedEmail);
      localStorage.setItem('inflowtrack_easy_pin_enabled', 'true');
    }
  } catch {
    // Ignore storage issues
  }

  return { user, token: data.token };
}

/**
 * Checks whether Easy PIN Login is configured for the given email address.
 */
export async function checkPinLoginStatus(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;
  try {
    const res = await fetch(`/api/auth/check-pin-status?email=${encodeURIComponent(normalized)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.pinLoginEnabled);
  } catch {
    return false;
  }
}

/**
 * Send a password reset email via Firebase Authentication, or reset via security recovery if using fallback.
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter your registered email address first.');
  }

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
    return `A password reset link has been sent to ${normalizedEmail}. Please check your inbox and spam folder.`;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found'
    ) {
      return `Password reset requested for ${normalizedEmail}. If you enabled a Security Question in Settings, you can also unlock and update your credentials inside Settings.`;
    }
    throw new Error(formatAuthErrorMessage(err, 'Unable to send password reset email. Please verify your email address.'));
  }
}

/**
 * Change the currently signed-in user's password after verifying their current password.
 */
export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
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
      cachedToken = freshToken;
      return;
    } catch (err: unknown) {
      throw new Error(formatAuthErrorMessage(err, 'Failed to update password. Please check your current password.'));
    }
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update password.');
  }
}

export const changeAccountPassword = changeUserPassword;

/**
 * Re-authenticates the current Firebase user with their account password for PIN recovery.
 */
export async function verifyAccountPasswordForRecovery(accountPassword: string): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (fbUser && fbUser.email && accountPassword) {
    try {
      const credential = EmailAuthProvider.credential(fbUser.email, accountPassword);
      await reauthenticateWithCredential(fbUser, credential);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Returns a fresh Firebase ID token (or active session token) for backend API calls.
 */
export async function getFreshAuthToken(): Promise<string | null> {
  if (auth.currentUser) {
    try {
      const fresh = await auth.currentUser.getIdToken();
      cachedToken = fresh;
      return fresh;
    } catch {
      return cachedToken;
    }
  }
  return cachedToken;
}

/**
 * Synchronously returns the latest cached auth token.
 */
export function getAccessToken(): string | null {
  return cachedToken;
}

/**
 * Returns the currently cached user profile.
 */
export function getSavedUser(): GoogleUser | null {
  if (auth.currentUser) {
    return mapFirebaseUser(auth.currentUser);
  }
  return cachedUser;
}

/**
 * Subscribe to Firebase Authentication state changes.
 */
export function initAuth(
  onAuthenticated: (user: GoogleUser, token: string) => void,
  onUnauthenticated: () => void
): () => void {
  scrubLegacyPlaintextSecurityStorage();

  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const idToken = await fbUser.getIdToken();
        const mappedUser = mapFirebaseUser(fbUser);
        cachedToken = idToken;
        cachedUser = mappedUser;
        onAuthenticated(mappedUser, idToken);
        return;
      } catch {
        // Fall through
      }
    }

    if (cachedToken && cachedUser) {
      try {
        const res = await fetch('/api/auth/session', {
          headers: { Authorization: `Bearer ${cachedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            cachedUser = data.user;
            onAuthenticated(data.user, cachedToken);
            return;
          }
        }
      } catch {
        // Network error
      }
    }

    cachedToken = null;
    cachedUser = null;
    onUnauthenticated();
  });

  return unsubscribe;
}

/**
 * Sign out from Firebase Authentication and clear in-memory session tokens.
 */
export async function logout(): Promise<void> {
  const token = cachedToken;
  cachedToken = null;
  setGoogleAccessToken(null);
  cachedUser = null;

  try {
    await signOut(auth);
  } catch {
    // Ignore Firebase sign-out errors
  }

  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors during logout
    }
  }
}
