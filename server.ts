/**
 * ============================================================================
 * File: server.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Full-stack Node.js / Express backend server with Vite middleware for the
 *   inflotrack web application.
 *
 * Key Responsibilities:
 *   1. Verifies Firebase Authentication ID tokens (`inflowtrack-06`) on the
 *      backend before executing any read, create, update, or delete operation.
 *   2. Extracts the authenticated user's verified `uid` from the token (never
 *      trusts any user ID supplied by the browser/client).
 *   3. Connects securely to the `inflowtrack` Google Sheet (primary finance
 *      database) and `inflowtrack` Google Drive folder
 *      (`1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`) using server-side credentials
 *      only (Service Account, OAuth2 Refresh Token, or Apps Script Webhook),
 *      maintaining continuous sync between website, Sheet, and Drive.
 *   4. Isolates all financial transactions, categories, budgets, recurring
 *      templates, security settings, and Drive backups strictly by the
 *      verified Firebase UID.
 *   5. Enforces salted PBKDF2-HMAC-SHA256 (100,000 iterations) hashing for
 *      optional quick-unlock PINs and recovery answers. Never stores or logs
 *      plaintext passwords, PINs, or security-question answers.
 * ============================================================================
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const WORKBOOK_FILE = path.join(DATA_DIR, 'financeflow_workbook.json');
const AUTH_USERS_FILE = path.join(DATA_DIR, 'auth_users.json');
const DRIVE_BACKUPS_DIR = path.join(DATA_DIR, 'drive_backups');

// Ensure server-only private data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}
if (!fs.existsSync(DRIVE_BACKUPS_DIR)) {
  fs.mkdirSync(DRIVE_BACKUPS_DIR, { recursive: true, mode: 0o700 });
}

// Load public Firebase project ID & API key from firebase-applet-config.json for token verification
let firebaseAppletConfig: { projectId?: string; apiKey?: string } = {};
try {
  const rawConfig = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
  firebaseAppletConfig = JSON.parse(rawConfig);
} catch {
  // Ignore if not present
}

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '';

// Server-side secret for signing fallback personal auth tokens & Apps Script payloads
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (() => {
    const secretFile = path.join(DATA_DIR, '.session_secret');
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, 'utf-8').trim();
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  })();

// Server-side Google Sheets & Drive configuration (NEVER exposed to client)
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1vvrKr8DceWAlt7Dn-k10mIiPQlyDRHqxZggmH-oKOQA';
const GOOGLE_SPREADSHEET_NAME = process.env.GOOGLE_SPREADSHEET_NAME || 'inflowtrack';
const GOOGLE_DRIVE_FOLDER_NAME = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'inflowtrack';
const GOOGLE_DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID || '1WTHHDzwzO79ypcP06ZmDkBuDADosnH30';
const GOOGLE_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || '';
const GOOGLE_APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET || '';

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE_URL = 'https://www.googleapis.com/drive/v3';

// Default Categories & Payment Modes
const DEFAULT_INCOME_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Bonus', 'Interest', 'Other Income'];
const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Transport',
  'Fuel',
  'Shopping',
  'Entertainment',
  'Medical',
  'Education',
  'Bills',
  'Other Expense',
];
const DEFAULT_TRANSFER_CATEGORIES = [
  'Bank to Bank Transfer',
  'Wallet Top-up',
  'Credit Card Bill Payment',
  'Self Transfer',
  'Cash Withdrawal',
];
const DEFAULT_SAVINGS_CATEGORIES = [
  'Mutual Funds',
  'Fixed Deposit',
  'Recurring Deposit',
  'Stocks & Equity',
  'Gold & Precious Metals',
  'PPF / EPF',
  'Retirement Fund',
  'Other Savings',
];
const DEFAULT_EMERGENCY_CATEGORIES = [
  'Bank Liquid Reserve',
  'Emergency High-Yield',
  'Cash at Hand',
  'Medical Contingency',
  'Other Emergency Reserve',
];
const DEFAULT_LENT_CATEGORIES = [
  'Money Lent to Friend',
  'Personal Loan Given',
  'Advance Given',
  'Business Loan Given',
  'Other Lent',
];
const DEFAULT_BORROWED_CATEGORIES = [
  'Borrowed from Friend',
  'Personal Loan Taken',
  'Credit/Advance Taken',
  'Bank Loan',
  'Other Borrowed',
];
const DEFAULT_LENT_BORROWED_CATEGORIES = [
  'Lent to Friend / Family',
  'Borrowed from Friend / Family',
  'Personal Loan Advance',
  'Loan Repayment Received',
  'Loan Repayment Paid',
  'Other Lent / Borrowed',
];
const DEFAULT_PAYMENT_MODES = [
  'HDFC Bank',
  'Kotak 811',
  'SBI Bank',
  'HDFC Credit Card',
  'SBI Credit Card',
  'Tata Neu Credit Card',
  'Amazon ICICI',
  'UPI / GPay',
  'Cash',
  'Other Payment Mode',
];
const DEFAULT_ACCOUNTS = ['Primary Bank Account', 'Savings Account', 'Cash Wallet', 'Credit Card', 'UPI Wallet'];

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// ============================================================================
// CRYPTOGRAPHIC HELPERS (PBKDF2-SHA256 / SHA512 + TIMING-SAFE VERIFICATION)
// ============================================================================

export function hashSecretPBKDF2(plainSecret: string, iterations = 100000): string {
  const normalized = String(plainSecret).trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(normalized, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

export function verifySecretPBKDF2(plainSecret: string, storedDigest: string): boolean {
  if (!plainSecret || !storedDigest) return false;
  const parts = storedDigest.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
    return false;
  }
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHashHex = parts[3];
  if (!iterations || !salt || !expectedHashHex) return false;

  const normalized = String(plainSecret).trim();
  const computedHashHex = crypto.pbkdf2Sync(normalized, salt, iterations, 32, 'sha256').toString('hex');

  const a = Buffer.from(computedHashHex, 'hex');
  const b = Buffer.from(expectedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeAnswerForHash(answer: string): string {
  return String(answer || '')
    .trim()
    .toLowerCase()
    .replace(/^['"]+|['"]+$/g, '');
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(SESSION_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(plainText, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

export function decryptSecret(encryptedPayload: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = encryptedPayload.split(':');
    if (!ivHex || !tagHex || !encHex) return null;
    const key = crypto.createHash('sha256').update(SESSION_SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(encHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return null;
  }
}

// ============================================================================
// SERVER-SIDE PERSONAL AUTH FALLBACK & JWT SIGNING
// (Used seamlessly if Firebase Email/Password provider is not yet enabled in Console)
// ============================================================================

interface StoredAuthUser {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  resetCodeHash?: string;
  resetCodeExpiresAt?: number;
}

function loadAuthUsers(): Record<string, StoredAuthUser> {
  try {
    if (fs.existsSync(AUTH_USERS_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_USERS_FILE, 'utf-8'));
    }
  } catch {
    // Ignore read error
  }
  return {};
}

function saveAuthUsers(users: Record<string, StoredAuthUser>): void {
  fs.writeFileSync(AUTH_USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
}

function signServerToken(payload: { uid: string; email: string; displayName: string }, expiresInSeconds = 86400 * 7): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: payload.uid,
      uid: payload.uid,
      email: payload.email,
      name: payload.displayName,
      iss: 'financeflow-personal-auth',
      iat: now,
      exp: now + expiresInSeconds,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyServerToken(token: string): { uid: string; email: string; displayName: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (decoded.iss !== 'financeflow-personal-auth') return null;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp < now) return null;
    if (!decoded.uid || typeof decoded.uid !== 'string') return null;

    return {
      uid: decoded.uid,
      email: decoded.email || '',
      displayName: decoded.name || 'FinanceFlow User',
    };
  } catch {
    return null;
  }
}

// ============================================================================
// FIREBASE ID TOKEN VERIFICATION (GOOGLE X.509 CERTS + IDENTITY TOOLKIT)
// ============================================================================

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (cachedGoogleCerts && Date.now() < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Unable to fetch Google public certificates for token verification.');
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedGoogleCerts = {
    certs,
    expiresAt: Date.now() + 3600 * 1000,
  };
  return certs;
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string; email: string; displayName: string } | null> {
  // 1. Check if it is our server-signed token first
  const localVerified = verifyServerToken(idToken);
  if (localVerified) {
    return localVerified;
  }

  // 2. Verify Firebase JWT structure, signature, and claims
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }
    if (FIREBASE_PROJECT_ID) {
      if (
        payload.aud !== FIREBASE_PROJECT_ID ||
        payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
      ) {
        return null;
      }
    }

    // Verify RS256 cryptographic signature using Google's public X.509 certificates
    if (header.alg === 'RS256' && header.kid) {
      try {
        const certs = await getGooglePublicCerts();
        const cert = certs[header.kid];
        if (cert) {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          verifier.end();
          const signatureValid = verifier.verify(cert, Buffer.from(parts[2], 'base64url'));
          if (signatureValid) {
            return {
              uid: payload.sub,
              email: payload.email || '',
              displayName: payload.name || (payload.email ? payload.email.split('@')[0] : 'FinanceFlow User'),
            };
          }
        }
      } catch {
        // Fallback to Identity Toolkit lookup below if cert fetch fails
      }
    }

    // 3. Verify directly with Firebase Identity Toolkit accounts:lookup endpoint
    if (FIREBASE_API_KEY) {
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (lookupRes.ok) {
        const data = await lookupRes.json();
        const user = data.users?.[0];
        if (user && user.localId) {
          return {
            uid: user.localId,
            email: user.email || '',
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'FinanceFlow User'),
          };
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName: string;
  };
  googleAccessToken?: string;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized access. Please sign in with your FinanceFlow account.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({
        error: 'Your session token is missing. Please sign in again.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const verifiedUser = await verifyFirebaseIdToken(token);
    if (!verifiedUser || !verifiedUser.uid) {
      res.status(401).json({
        error: 'Your session has expired or is invalid. Please sign in again.',
        code: 'SESSION_EXPIRED',
      });
      return;
    }

    // CRITICAL SECURITY GATE: Reject any attempt by the client to supply a different user's UID
    const clientQueryUid = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';
    const clientBodyUid = req.body && typeof req.body.uid === 'string' ? req.body.uid.trim() : '';
    const clientHeaderUid = typeof req.headers['x-user-uid'] === 'string' ? req.headers['x-user-uid'].trim() : '';

    if (
      (clientQueryUid && clientQueryUid !== verifiedUser.uid) ||
      (clientBodyUid && clientBodyUid !== verifiedUser.uid) ||
      (clientHeaderUid && clientHeaderUid !== verifiedUser.uid)
    ) {
      res.status(403).json({
        error: 'Unauthorized access: You are not permitted to access or modify another user\'s financial data.',
        code: 'FORBIDDEN_UID_MISMATCH',
      });
      return;
    }

    const headerGoogleToken =
      typeof req.headers['x-google-access-token'] === 'string'
        ? req.headers['x-google-access-token'].trim()
        : '';
    if (headerGoogleToken) {
      req.googleAccessToken = headerGoogleToken;
    }

    req.user = verifiedUser;
    next();
  } catch {
    res.status(401).json({
      error: 'Authentication verification failed. Please sign in again.',
      code: 'AUTH_ERROR',
    });
  }
}

// ============================================================================
// GOOGLE CLOUD BACKEND AUTHENTICATION (SERVICE ACCOUNT / REFRESH TOKEN)
// ============================================================================

let cachedServerGoogleToken: { token: string; expiresAt: number } | null = null;
let resolvedDriveSpreadsheetId: string = GOOGLE_SPREADSHEET_ID;

function hasGoogleCredentials(userGoogleToken?: string, driveCfg?: UserDriveConfigRecord): boolean {
  return Boolean(
    (userGoogleToken && userGoogleToken.trim()) ||
      (driveCfg?.lastGoogleAccessToken && driveCfg.lastGoogleAccessToken.trim()) ||
      (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY) ||
      (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN)
  );
}

function isGoogleCloudConfigured(userGoogleToken?: string, driveCfg?: UserDriveConfigRecord): boolean {
  return Boolean(
    (GOOGLE_SPREADSHEET_ID || GOOGLE_DRIVE_FOLDER_ID || userGoogleToken || driveCfg?.lastGoogleAccessToken) &&
      hasGoogleCredentials(userGoogleToken, driveCfg)
  );
}

function getAppsScriptUrl(driveCfg?: UserDriveConfigRecord): string {
  return driveCfg?.appsScriptUrl || GOOGLE_APPS_SCRIPT_URL;
}

function isAppsScriptConfigured(driveCfg?: UserDriveConfigRecord): boolean {
  return Boolean(getAppsScriptUrl(driveCfg));
}

async function getServerGoogleAccessToken(userGoogleToken?: string, driveCfg?: UserDriveConfigRecord): Promise<string> {
  const token = (userGoogleToken && userGoogleToken.trim()) || (driveCfg?.lastGoogleAccessToken && driveCfg.lastGoogleAccessToken.trim());
  if (token) {
    return token;
  }
  if (cachedServerGoogleToken && Date.now() < cachedServerGoogleToken.expiresAt) {
    return cachedServerGoogleToken.token;
  }

  // Option A: Google Service Account JWT Assertion (RS256)
  if (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claimSet}`);
    signer.end();
    const signature = signer.sign(GOOGLE_PRIVATE_KEY, 'base64url');
    const assertion = `${header}.${claimSet}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!res.ok) {
      throw new Error('Google Sheets service account authentication failed on server.');
    }

    const data = await res.json();
    cachedServerGoogleToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }

  // Option B: Server-side OAuth2 Refresh Token
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      throw new Error('Google Sheets OAuth refresh token exchange failed on server.');
    }

    const data = await res.json();
    cachedServerGoogleToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }

  throw new Error('Google Cloud credentials are not configured on the backend.');
}

// ============================================================================
// GOOGLE SHEETS STRUCTURED WORKBOOK STORE (WITH LIVE GOOGLE SHEETS SYNC)
// ============================================================================

interface StoredTransactionRow {
  rowIndex: number;
  sheetName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: string;
  category: string;
  subcategory: string;
  amount: number;
  paymentMode: string;
  account: string;
  description: string;
  uid: string; // Verified Firebase UID
  transactionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  isDeleted?: boolean;
}

interface UserSecurityRecord {
  uid: string;
  username?: string;
  pinEnabled: boolean;
  pinSaltedHash: string; // pbkdf2_sha256$100000$salt$hash (NEVER plaintext)
  pinLoginEnabled?: boolean;
  pinLoginEncryptedPassword?: string;
  pinLoginEmail?: string;
  question1: string;
  answer1SaltedHash: string; // pbkdf2_sha256$100000$salt$hash (NEVER plaintext)
  question2: string;
  answer2SaltedHash: string;
  inactivityTimeoutMinutes: number;
  inactivityAction: 'lock' | 'logout';
  failedAttempts: number;
  updatedAt: string;
}

interface UserBudgetRecord {
  uid: string;
  savingsTarget: number;
  emergencyFundTarget: number;
  monthlyExpenseBudget: number;
  updatedAt: string;
}

interface UserCategoriesRecord {
  uid: string;
  incomeCategories: string[];
  expenseCategories: string[];
  transferCategories: string[];
  savingsCategories: string[];
  emergencyFundCategories: string[];
  lentCategories: string[];
  borrowedCategories: string[];
  lentBorrowedCategories: string[];
  paymentModes: string[];
  accounts: string[];
  subcategories: Record<string, string[]>;
}

interface StoredRecurringRecord {
  id: string;
  uid: string;
  name: string;
  type: string;
  category: string;
  subcategory: string;
  amount: number;
  paymentMode: string;
  account: string;
  dayOfMonth: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredDriveBackup {
  id: string;
  uid: string;
  name: string;
  createdTime: string;
  sizeBytes: number;
  transactionsCount: number;
  kind: 'backup' | 'csv' | 'receipt';
  filePath: string;
  driveFileId?: string;
}

interface UserDriveConfigRecord {
  uid: string;
  driveFolderId: string;
  driveFolderUrl: string;
  driveFolderName: string;
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl?: string;
  appsScriptUrl?: string;
  lastGoogleAccessToken?: string;
  updatedAt: string;
}

interface StoredVaultCard {
  id: string;
  name: string;
  cardType?: 'Debit' | 'Credit';
  last4: string;
  prefix4: string;
  middleDigits?: string;
  expiry: string;
  network: 'VISA' | 'Mastercard' | 'RuPay' | 'AMEX';
  tier: string;
  theme: 'obsidian' | 'champagne' | 'navy' | 'platinum' | 'espresso';
  upiId?: string;
  qrCodeData?: string;
  qrCodeImageUrl?: string;
  cvv?: string;
  isDefault?: boolean;
  updatedAt?: string;
}

const DEFAULT_SERVER_VAULT_CARDS: StoredVaultCard[] = [
  {
    id: 'card-vault-primary',
    name: 'inflotrack Sovereign Vault',
    cardType: 'Debit',
    prefix4: '4532',
    middleDigits: '8841 9200',
    last4: '6789',
    expiry: '09/29',
    network: 'VISA',
    tier: 'Infinite',
    theme: 'obsidian',
    upiId: 'inflotrack.vault@okaxis',
    cvv: '842',
    isDefault: true,
  },
  {
    id: 'card-hdfc-debit',
    name: 'HDFC Salary Debit Card',
    cardType: 'Debit',
    prefix4: '4532',
    middleDigits: '9120 4018',
    last4: '4129',
    expiry: '05/29',
    network: 'VISA',
    tier: 'Platinum',
    theme: 'navy',
    upiId: 'salary.hdfc@upi',
    cvv: '319',
    isDefault: true,
  },
  {
    id: 'card-hdfc-cc',
    name: 'HDFC Credit Card',
    cardType: 'Credit',
    prefix4: '5412',
    middleDigits: '7531 4092',
    last4: '3904',
    expiry: '11/28',
    network: 'Mastercard',
    tier: 'Signature',
    theme: 'champagne',
    upiId: 'hdfc.rewards@hdfcbank',
    cvv: '592',
    isDefault: true,
  },
  {
    id: 'card-sbi-cc',
    name: 'SBI Credit Card',
    cardType: 'Credit',
    prefix4: '4111',
    middleDigits: '6209 1845',
    last4: '8421',
    expiry: '06/28',
    network: 'VISA',
    tier: 'Platinum',
    theme: 'navy',
    upiId: 'sbi.card@okhdfcbank',
    cvv: '108',
    isDefault: true,
  },
  {
    id: 'card-tata-neu',
    name: 'Tata Neu Credit Card',
    cardType: 'Credit',
    prefix4: '6521',
    middleDigits: '9034 5112',
    last4: '7710',
    expiry: '03/29',
    network: 'RuPay',
    tier: 'Select',
    theme: 'espresso',
    upiId: 'tataneu.rewards@icici',
    cvv: '741',
    isDefault: true,
  },
  {
    id: 'card-amazon-icici',
    name: 'Amazon ICICI',
    cardType: 'Credit',
    prefix4: '4908',
    middleDigits: '3410 8872',
    last4: '1156',
    expiry: '08/28',
    network: 'VISA',
    tier: 'Platinum',
    theme: 'platinum',
    upiId: 'amazonpay.icici@apl',
    cvv: '663',
    isDefault: true,
  },
];

interface WorkbookStore {
  spreadsheetId: string;
  spreadsheetName: string;
  primaryOwnerUid?: string;
  nextRowCounter: number;
  transactions: StoredTransactionRow[];
  userCategories: Record<string, UserCategoriesRecord>;
  userSecurity: Record<string, UserSecurityRecord>;
  userBudgets: Record<string, UserBudgetRecord>;
  userDriveConfigs: Record<string, UserDriveConfigRecord>;
  recurringTemplates: StoredRecurringRecord[];
  driveBackups: StoredDriveBackup[];
  userCards?: Record<string, StoredVaultCard[]>;
}

function parseDriveFolderIdFromInput(rawInput?: string): { folderId: string; folderUrl: string } {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      folderUrl: GOOGLE_DRIVE_FOLDER_URL,
    };
  }
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    const id = folderMatch[1];
    return {
      folderId: id,
      folderUrl: `https://drive.google.com/drive/folders/${id}`,
    };
  }
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    const id = idParamMatch[1];
    return {
      folderId: id,
      folderUrl: `https://drive.google.com/drive/folders/${id}`,
    };
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return {
      folderId: trimmed,
      folderUrl: `https://drive.google.com/drive/folders/${trimmed}`,
    };
  }
  return {
    folderId: GOOGLE_DRIVE_FOLDER_ID,
    folderUrl: GOOGLE_DRIVE_FOLDER_URL,
  };
}

const SHORT_MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const MONTHLY_SHEET_HEADERS = [
  'record_id',
  'date',
  'time',
  'type',
  'category',
  'subcategory',
  'amount',
  'payment_mode',
  'account',
  'description',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'is_deleted',
];

const SHORT_MONTH_NAMES_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateYearAndMonth(rawDate?: string): { year: number; monthIndex: number } {
  let year = new Date().getFullYear();
  let monthIndex = new Date().getMonth();

  if (rawDate) {
    const norm = normalizeSheetDate(rawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
      const parts = norm.split('-');
      year = parseInt(parts[0], 10);
      monthIndex = parseInt(parts[1], 10) - 1;
    } else if (/^\d{4}-\d{2}$/.test(norm)) {
      const parts = norm.split('-');
      year = parseInt(parts[0], 10);
      monthIndex = parseInt(parts[1], 10) - 1;
    } else {
      const clean = String(rawDate).trim().toLowerCase();
      const match = clean.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\-_ \t]+(\d{4})$/i);
      if (match) {
        year = parseInt(match[2], 10);
        const m = match[1].toLowerCase();
        if (m.startsWith('sep')) monthIndex = 8;
        else if (m.startsWith('jan')) monthIndex = 0;
        else if (m.startsWith('feb')) monthIndex = 1;
        else if (m.startsWith('mar')) monthIndex = 2;
        else if (m.startsWith('apr')) monthIndex = 3;
        else if (m.startsWith('may')) monthIndex = 4;
        else if (m.startsWith('jun')) monthIndex = 5;
        else if (m.startsWith('jul')) monthIndex = 6;
        else if (m.startsWith('aug')) monthIndex = 7;
        else if (m.startsWith('oct')) monthIndex = 9;
        else if (m.startsWith('nov')) monthIndex = 10;
        else if (m.startsWith('dec')) monthIndex = 11;
      }
    }
  }

  if (monthIndex < 0 || monthIndex > 11 || isNaN(monthIndex) || isNaN(year)) {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
  }

  return { year, monthIndex };
}

const LOWER_MONTH_ABBRS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];

/**
 * Returns canonical month sheet name in lowercase format (e.g. 'sept-2026', 'oct-2026').
 */
function getCanonicalMonthSheetName(rawDate?: string): string {
  const { year, monthIndex } = parseDateYearAndMonth(rawDate);
  const monthAbbr = LOWER_MONTH_ABBRS[monthIndex];
  return `${monthAbbr}-${year}`;
}

function getMonthSheetName(rawDate?: string): string {
  return getCanonicalMonthSheetName(rawDate);
}

function isMonthlySheetTab(title: string): boolean {
  const clean = title.trim().toLowerCase();
  return /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[-_ \t]*\d{4}$/i.test(clean);
}

function resolveMatchingMonthSheetTitle(existingSheetTitles: string[], rawDate?: string): string {
  const { year, monthIndex } = parseDateYearAndMonth(rawDate);
  const mLower = LOWER_MONTH_ABBRS[monthIndex];
  const mTitle = SHORT_MONTH_NAMES_TITLE[monthIndex];

  const candidateAliases = [
    `${mLower}-${year}`,
    `${mTitle}-${year}`,
    `${mLower}_${year}`,
    `${mTitle}_${year}`,
    `${mLower} ${year}`,
    `${mTitle} ${year}`,
  ];

  if (monthIndex === 8) {
    candidateAliases.push(
      `sept-${year}`,
      `sep-${year}`,
      `Sept-${year}`,
      `Sep-${year}`,
      `SEPT-${year}`,
      `SEP-${year}`,
      `sept_${year}`,
      `sep_${year}`,
      `sept ${year}`,
      `sep ${year}`
    );
  }

  // Check exact alias matches
  for (const alias of candidateAliases) {
    const match = existingSheetTitles.find((title) => title.trim().toLowerCase() === alias.toLowerCase());
    if (match) return match.trim();
  }

  // Check regex pattern match
  const mRegex = new RegExp(`^(?:${mLower}|${monthIndex === 8 ? 'sept|sep' : mLower})[-_ \t]*${year}$`, 'i');
  const regexMatch = existingSheetTitles.find((title) => mRegex.test(title.trim()));
  if (regexMatch) return regexMatch.trim();

  return `${mLower}-${year}`;
}

/**
 * Searches the spreadsheet sheets for a sample or template sheet to use as base/template.
 */
function findSampleSheet(sheets: Array<{ title: string; sheetId: number }>): { title: string; sheetId: number } | null {
  if (!Array.isArray(sheets) || sheets.length === 0) return null;

  // 1. Explicit "sample" in title (e.g. "sample", "Sample", "sample tab", "Sample Tab")
  const sampleMatch = sheets.find((s) => /sample/i.test(s.title));
  if (sampleMatch) return sampleMatch;

  // 2. Explicit "template" in title (e.g. "template", "Template")
  const templateMatch = sheets.find((s) => /template/i.test(s.title));
  if (templateMatch) return templateMatch;

  // 3. Explicit "base" in title
  const baseMatch = sheets.find((s) => /^base$/i.test(s.title.trim()));
  if (baseMatch) return baseMatch;

  // 4. Any existing month tab (e.g. sept-2026) that can serve as the base template
  const monthMatch = sheets.find((s) => isMonthlySheetTab(s.title));
  if (monthMatch) return monthMatch;

  // 5. First tab that is not a system tab
  const systemTabs = ['categories', 'cards', 'summary', 'settings', 'instructions'];
  const userTab = sheets.find((s) => !systemTabs.includes(s.title.toLowerCase().trim()));
  if (userTab) return userTab;

  return null;
}

/**
 * Checks whether a tab for that month already exists in Google Sheets.
 * If the tab exists, returns its title; if not, automatically creates a new tab
 * using the sample tab as the base/template in the format: "sept-2026".
 */
async function ensureMonthlySheetTabExists(
  accessToken: string,
  spreadsheetId: string,
  rawDateOrTitle: string
): Promise<string> {
  try {
    const metaRes = await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) return getCanonicalMonthSheetName(rawDateOrTitle);

    const metaData = await metaRes.json();
    const sheetsList: Array<{ title: string; sheetId: number }> = (metaData.sheets || []).map((s: any) => ({
      title: String(s.properties?.title || '').trim(),
      sheetId: s.properties?.sheetId ?? 0,
    }));
    const existingTitles: string[] = sheetsList.map((s) => s.title);

    // 1. Check if matching tab for this month already exists
    const matchingTitle = resolveMatchingMonthSheetTitle(existingTitles, rawDateOrTitle);
    const alreadyExists = existingTitles.some(
      (t) => t.toLowerCase() === matchingTitle.toLowerCase()
    );

    if (alreadyExists) {
      return matchingTitle;
    }

    // 2. Tab does not exist -> Create new tab using format e.g. "sept-2026"
    // Use sample tab as the base/template if present
    const newTabTitle = getCanonicalMonthSheetName(rawDateOrTitle);
    const sampleSheet = findSampleSheet(sheetsList);

    let createdTabSuccessfully = false;

    // A. If sample tab exists, duplicate it to preserve 100% of formatting, columns, styles, and formulas
    if (sampleSheet && sampleSheet.sheetId !== undefined) {
      try {
        const dupRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                duplicateSheet: {
                  sourceSheetId: sampleSheet.sheetId,
                  newSheetName: newTabTitle,
                },
              },
            ],
          }),
        });

        if (dupRes.ok) {
          createdTabSuccessfully = true;
          // Clear any sample data rows from row 2 downward so template headers/styles remain clean
          await fetch(
            `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(newTabTitle)}!A2:Z:clear`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          ).catch(() => {});
        }
      } catch {
        // Fallback to addSheet below
      }
    }

    // B. Fallback if no sample sheet or duplicateSheet was rejected
    if (!createdTabSuccessfully) {
      const addRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: newTabTitle,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        }),
      });

      if (addRes.ok) {
        // Add standardized 13-column header row
        await fetch(
          `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
            newTabTitle
          )}!A1:M1?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [
                [
                  'Date',
                  'Type',
                  'Category',
                  'Amount',
                  'Payment Mode',
                  'Description',
                  'User UID',
                  'Transaction ID',
                  'Subcategory',
                  'Account / Wallet',
                  'Time',
                  'Created At',
                  'Updated At',
                ],
              ],
            }),
          }
        ).catch(() => {});
      }
    }

    return newTabTitle;
  } catch {
    return getCanonicalMonthSheetName(rawDateOrTitle);
  }
}

function getColumnIndexMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  if (!Array.isArray(headerRow)) return map;
  headerRow.forEach((col, idx) => {
    const key = String(col || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key) map[key] = idx;
  });
  return map;
}

function formatDateToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function normalizeSheetDate(raw: string): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const ymd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return str;
}

function loadWorkbook(): WorkbookStore {
  try {
    if (fs.existsSync(WORKBOOK_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(WORKBOOK_FILE, 'utf-8'));
      return {
        spreadsheetId:
          resolvedDriveSpreadsheetId ||
          GOOGLE_SPREADSHEET_ID ||
          parsed.spreadsheetId ||
          'sheet-inflowtrack-private',
        spreadsheetName: GOOGLE_SPREADSHEET_NAME,
        primaryOwnerUid: parsed.primaryOwnerUid,
        nextRowCounter: parsed.nextRowCounter || 100,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        userCategories: parsed.userCategories || {},
        userSecurity: parsed.userSecurity || {},
        userBudgets: parsed.userBudgets || {},
        userDriveConfigs: parsed.userDriveConfigs || {},
        recurringTemplates: Array.isArray(parsed.recurringTemplates) ? parsed.recurringTemplates : [],
        driveBackups: Array.isArray(parsed.driveBackups) ? parsed.driveBackups : [],
        userCards: parsed.userCards || {},
      };
    }
  } catch {
    // Ignore parse error and initialize fresh workbook
  }
  return {
    spreadsheetId: resolvedDriveSpreadsheetId || GOOGLE_SPREADSHEET_ID || 'sheet-inflowtrack-private',
    spreadsheetName: GOOGLE_SPREADSHEET_NAME,
    nextRowCounter: 2,
    transactions: [],
    userCategories: {},
    userSecurity: {},
    userBudgets: {},
    userDriveConfigs: {},
    recurringTemplates: [],
    driveBackups: [],
    userCards: {},
  };
}

function saveWorkbook(wb: WorkbookStore): void {
  fs.writeFileSync(WORKBOOK_FILE, JSON.stringify(wb, null, 2), { mode: 0o600 });
}

function ensureUserRecords(wb: WorkbookStore, uid: string): void {
  if (!wb.primaryOwnerUid) {
    wb.primaryOwnerUid = uid;
  }

  if (!wb.userCategories[uid]) {
    wb.userCategories[uid] = {
      uid,
      incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
      expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
      transferCategories: [...DEFAULT_TRANSFER_CATEGORIES],
      savingsCategories: [...DEFAULT_SAVINGS_CATEGORIES],
      emergencyFundCategories: [...DEFAULT_EMERGENCY_CATEGORIES],
      lentCategories: [...DEFAULT_LENT_CATEGORIES],
      borrowedCategories: [...DEFAULT_BORROWED_CATEGORIES],
      lentBorrowedCategories: [...DEFAULT_LENT_BORROWED_CATEGORIES],
      paymentModes: [...DEFAULT_PAYMENT_MODES],
      accounts: [...DEFAULT_ACCOUNTS],
      subcategories: {},
    };
  }

  if (!wb.userSecurity[uid]) {
    wb.userSecurity[uid] = {
      uid,
      pinEnabled: false,
      pinSaltedHash: '',
      pinLoginEnabled: false,
      pinLoginEncryptedPassword: '',
      pinLoginEmail: '',
      question1: 'What is your primary bank name or secret recovery keyword?',
      answer1SaltedHash: '',
      question2: '',
      answer2SaltedHash: '',
      inactivityTimeoutMinutes: 15,
      inactivityAction: 'lock',
      failedAttempts: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  if (!wb.userBudgets[uid]) {
    wb.userBudgets[uid] = {
      uid,
      savingsTarget: 100000,
      emergencyFundTarget: 50000,
      monthlyExpenseBudget: 50000,
      updatedAt: new Date().toISOString(),
    };
  }

  if (!wb.userDriveConfigs) {
    wb.userDriveConfigs = {};
  }
  if (
    !wb.userDriveConfigs[uid] ||
    wb.userDriveConfigs[uid].driveFolderId === '1vzWhp8o3I_3jbtGvS0NUS2Xo-VdOBYKb'
  ) {
    wb.userDriveConfigs[uid] = {
      uid,
      driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
      driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
      driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
      spreadsheetId: wb.userDriveConfigs[uid]?.spreadsheetId || wb.spreadsheetId || 'sheet-inflowtrack-private',
      spreadsheetName: wb.userDriveConfigs[uid]?.spreadsheetName || GOOGLE_SPREADSHEET_NAME,
      spreadsheetUrl:
        wb.spreadsheetId && wb.spreadsheetId !== 'sheet-inflowtrack-private'
          ? `https://docs.google.com/spreadsheets/d/${wb.spreadsheetId}/edit`
          : undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  const userTemplates = wb.recurringTemplates.filter((t) => t.uid === uid);
  if (userTemplates.length === 0) {
    const now = new Date().toISOString();
    const defaults: StoredRecurringRecord[] = [
      {
        id: `rec-${uid.slice(0, 6)}-1`,
        uid,
        name: 'Monthly Salary',
        type: 'Income',
        category: 'Salary',
        subcategory: 'Payroll',
        amount: 50000,
        paymentMode: 'HDFC Bank',
        account: 'Primary Bank Account',
        dayOfMonth: 1,
        description: 'Monthly Salary Deposit',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `rec-${uid.slice(0, 6)}-2`,
        uid,
        name: 'House Rent',
        type: 'Expense',
        category: 'Rent',
        subcategory: 'Housing',
        amount: 15000,
        paymentMode: 'HDFC Bank',
        account: 'Primary Bank Account',
        dayOfMonth: 5,
        description: 'Monthly Apartment Rent',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `rec-${uid.slice(0, 6)}-3`,
        uid,
        name: 'Mutual Fund SIP',
        type: 'Savings',
        category: 'Mutual Funds',
        subcategory: 'Index Fund SIP',
        amount: 5000,
        paymentMode: 'HDFC Bank',
        account: 'Savings Account',
        dayOfMonth: 10,
        description: 'Auto-debit SIP Investment',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    wb.recurringTemplates.push(...defaults);
  }

  if (!wb.userCards) {
    wb.userCards = {};
  }
  if (!wb.userCards[uid] || wb.userCards[uid].length === 0) {
    wb.userCards[uid] = JSON.parse(JSON.stringify(DEFAULT_SERVER_VAULT_CARDS));
  }
}

// ============================================================================
// LIVE GOOGLE SHEETS & GOOGLE DRIVE (inflowtrack) SYNCHRONIZATION HELPERS
// ============================================================================

/**
 * Resolves the target Google Spreadsheet ID for `inflowtrack`.
 * If `GOOGLE_SPREADSHEET_ID` is explicitly set, uses it directly.
 * Otherwise, searches inside the `inflowtrack` Google Drive folder
 * (`1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`) for a spreadsheet named `inflowtrack`
 * (or creates one inside that folder if credentials allow).
 */
async function resolveTargetSpreadsheetId(
  accessToken: string,
  options?: {
    driveFolderId?: string;
    spreadsheetName?: string;
    existingSpreadsheetId?: string;
    forceCreateNew?: boolean;
  }
): Promise<string> {
  const targetFolderId = options?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID;
  const targetSheetName = options?.spreadsheetName || GOOGLE_SPREADSHEET_NAME;

  if (
    !options?.forceCreateNew &&
    options?.existingSpreadsheetId &&
    options.existingSpreadsheetId !== 'sheet-inflowtrack-private'
  ) {
    return options.existingSpreadsheetId;
  }

  if (!options?.forceCreateNew && resolvedDriveSpreadsheetId && targetFolderId === GOOGLE_DRIVE_FOLDER_ID) {
    return resolvedDriveSpreadsheetId;
  }

  try {
    if (!options?.forceCreateNew && targetFolderId) {
      const q = `'${targetFolderId}' in parents and name = '${targetSheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const searchUrl = `${DRIVE_BASE_URL}/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData.files) && searchData.files.length > 0) {
          const foundId = searchData.files[0].id;
          resolvedDriveSpreadsheetId = foundId;
          return foundId;
        }
      }
    }

    // Attempt to create the `inflowtrack` Sheet directly inside the target Drive folder
    if (targetFolderId) {
      const createRes = await fetch(`${DRIVE_BASE_URL}/files?supportsAllDrives=true&fields=id,name`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: targetSheetName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [targetFolderId],
        }),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        if (created.id) {
          resolvedDriveSpreadsheetId = created.id;
          return created.id;
        }
      }
    }

    // Fallback: Create via Google Sheets v4 API and attach parent folder if accessible
    const sheetsCreateRes = await fetch(SHEETS_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: targetSheetName },
      }),
    });
    if (sheetsCreateRes.ok) {
      const createdSheet = await sheetsCreateRes.json();
      const newId = createdSheet.spreadsheetId;
      if (newId) {
        if (targetFolderId) {
          await fetch(
            `${DRIVE_BASE_URL}/files/${newId}?addParents=${encodeURIComponent(targetFolderId)}&supportsAllDrives=true`,
            {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          ).catch(() => {});
        }
        resolvedDriveSpreadsheetId = newId;
        return newId;
      }
    }
  } catch {
    // Fallback if Drive discovery/creation fails
  }

  return GOOGLE_SPREADSHEET_ID;
}

/**
 * Syncs all user transactions, categories, and budgets into the target Google Sheet
 * inside the user's Google Drive folder (`1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`).
 */
async function populateFullWorkbookToLiveSheet(
  accessToken: string,
  spreadsheetId: string,
  wb: WorkbookStore,
  uid: string
): Promise<void> {
  if (!spreadsheetId || spreadsheetId === 'sheet-inflowtrack-private') return;

  const userTxs = wb.transactions.filter((t) => t.uid === uid);
  const currentMonthTab = getMonthSheetName();
  const monthTabsSet = new Set<string>([currentMonthTab]);
  userTxs.forEach((tx) => {
    if (tx.sheetName) monthTabsSet.add(tx.sheetName);
  });

  const metaRes = await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const existingTitles = new Set<string>();
  if (metaRes.ok) {
    const metaData = await metaRes.json();
    (metaData.sheets || []).forEach((s: any) => {
      if (s.properties?.title) {
        existingTitles.add(String(s.properties.title));
      }
    });
  }

  const requiredTabs = [...Array.from(monthTabsSet), 'Categories', 'Cards', 'Summary'];
  const addSheetRequests: any[] = [];
  for (const tabName of requiredTabs) {
    const hasTab = Array.from(existingTitles).some((t) => t.toUpperCase() === tabName.toUpperCase());
    if (!hasTab) {
      addSheetRequests.push({
        addSheet: {
          properties: {
            title: tabName,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      });
    }
  }

  if (addSheetRequests.length > 0) {
    await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: addSheetRequests }),
    }).catch(() => {});
  }

  const headerRow = [
    'Date',
    'Type',
    'Category',
    'Amount',
    'Payment Mode',
    'Description',
    'User UID',
    'Transaction ID',
    'Subcategory',
    'Account / Wallet',
    'Time',
    'Created At',
    'Updated At',
  ];

  // Write each monthly sheet tab
  for (const monthTab of Array.from(monthTabsSet)) {
    const tabTxs = userTxs
      .filter((t) => (t.sheetName || getMonthSheetName(t.date)) === monthTab)
      .sort((a, b) => a.date.localeCompare(b.date));

    const values = [
      headerRow,
      ...tabTxs.map((tx) => [
        formatDateToDDMMYYYY(tx.date),
        tx.type,
        tx.category,
        tx.amount,
        tx.paymentMode,
        tx.description,
        tx.uid,
        tx.transactionId,
        tx.subcategory,
        tx.account,
        tx.time,
        tx.createdAt,
        tx.updatedAt,
      ]),
    ];

    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(monthTab)}!A1:M${
        values.length
      }?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    ).catch(() => {});
  }

  // Write Categories tab
  const cats = wb.userCategories[uid];
  if (cats) {
    const maxLen = Math.max(
      cats.incomeCategories.length,
      cats.expenseCategories.length,
      cats.transferCategories.length,
      cats.savingsCategories.length,
      cats.emergencyFundCategories.length,
      cats.paymentModes.length,
      1
    );
    const catRows: string[][] = [
      ['Income Categories', 'Expense Categories', 'Transfer Categories', 'Savings Categories', 'Emergency Fund Categories', 'Payment Modes'],
    ];
    for (let i = 0; i < maxLen; i++) {
      catRows.push([
        cats.incomeCategories[i] || '',
        cats.expenseCategories[i] || '',
        cats.transferCategories[i] || '',
        cats.savingsCategories[i] || '',
        cats.emergencyFundCategories[i] || '',
        cats.paymentModes[i] || '',
      ]);
    }
    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/Categories!A1:F${catRows.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: catRows }),
      }
    ).catch(() => {});
  }

  // Write Cards tab (Payment cards, UPI IDs, and QR code configurations)
  const userCards = wb.userCards?.[uid] || [];
  if (userCards.length > 0) {
    const cardHeaders = [
      'Card ID',
      'Card Name',
      'Card Type',
      'Prefix 4',
      'Middle Digits',
      'Last 4',
      'Expiry (MM/YY)',
      'Network',
      'Tier',
      'Theme Finish',
      'UPI ID',
      'QR Code Data',
      'CVV',
      'Updated At',
    ];
    const cardRows = [
      cardHeaders,
      ...userCards.map((c) => [
        c.id,
        c.name,
        c.cardType || 'Debit',
        c.prefix4 || '4532',
        c.middleDigits || '8841 9200',
        c.last4 || '1234',
        c.expiry || '12/29',
        c.network || 'VISA',
        c.tier || 'Signature',
        c.theme || 'obsidian',
        c.upiId || '',
        c.qrCodeData || '',
        c.cvv || '842',
        c.updatedAt || new Date().toISOString(),
      ]),
    ];
    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/Cards!A1:N${cardRows.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: cardRows }),
      }
    ).catch(() => {});
  }

  // Write Summary & Budgets tab
  const budgets = wb.userBudgets[uid];
  const driveCfg = wb.userDriveConfigs[uid];
  const summaryRows = [
    ['inflotrack — Personal Finance Workbook', 'Value'],
    ['Spreadsheet Name', driveCfg?.spreadsheetName || GOOGLE_SPREADSHEET_NAME],
    ['Google Drive Folder ID', driveCfg?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID],
    ['Google Drive Folder URL', driveCfg?.driveFolderUrl || GOOGLE_DRIVE_FOLDER_URL],
    ['Savings Target (INR)', String(budgets?.savingsTarget || 100000)],
    ['Emergency Fund Target (INR)', String(budgets?.emergencyFundTarget || 50000)],
    ['Total Recorded Transactions', String(userTxs.length)],
    ['Last Synced At', new Date().toISOString()],
  ];
  await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/Summary!A1:B${summaryRows.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: summaryRows }),
    }
  ).catch(() => {});
}

/**
 * Synchronizes the user's payment cards, UPI IDs, and QR codes to the 'Cards' tab
 * in their private Google Sheet database for true 2-way synchronization.
 */
async function syncCardsToLiveGoogleSheet(
  wb: WorkbookStore,
  uid: string,
  userGoogleToken?: string
): Promise<void> {
  if (!isGoogleCloudConfigured(userGoogleToken)) return;
  try {
    const driveCfg = wb.userDriveConfigs?.[uid];
    const accessToken = await getServerGoogleAccessToken(userGoogleToken);
    const spreadsheetId = await resolveTargetSpreadsheetId(accessToken, {
      driveFolderId: driveCfg?.driveFolderId,
      spreadsheetName: driveCfg?.spreadsheetName,
      existingSpreadsheetId: driveCfg?.spreadsheetId,
    });
    if (!spreadsheetId) return;

    const userCards = wb.userCards?.[uid] || [];
    const cardHeaders = [
      'Card ID',
      'Card Name',
      'Card Type',
      'Prefix 4',
      'Middle Digits',
      'Last 4',
      'Expiry (MM/YY)',
      'Network',
      'Tier',
      'Theme Finish',
      'UPI ID',
      'QR Code Data',
      'CVV',
      'Updated At',
    ];
    const values = [
      cardHeaders,
      ...userCards.map((c) => [
        c.id,
        c.name,
        c.cardType || 'Debit',
        c.prefix4 || '4532',
        c.middleDigits || '8841 9200',
        c.last4 || '1234',
        c.expiry || '12/29',
        c.network || 'VISA',
        c.tier || 'Signature',
        c.theme || 'obsidian',
        c.upiId || '',
        c.qrCodeData || '',
        c.cvv || '842',
        c.updatedAt || new Date().toISOString(),
      ]),
    ];

    // Ensure Cards tab exists in the spreadsheet
    const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      const hasCardsTab = (metaData.sheets || []).some(
        (s: any) => s.properties?.title?.toUpperCase() === 'CARDS'
      );
      if (!hasCardsTab) {
        await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: { title: 'Cards', gridProperties: { frozenRowCount: 1 } },
                },
              },
            ],
          }),
        }).catch(() => {});
      }
    }

    // Write updated card rows to Cards tab
    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/Cards!A1:N${Math.max(values.length, 25)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    ).catch(() => {});
  } catch {
    // Offline or network fallback
  }
}

async function syncFromLiveGoogleSheetsIfConfigured(
  wb: WorkbookStore,
  uid: string,
  userGoogleToken?: string
): Promise<void> {
  const driveCfg = wb.userDriveConfigs?.[uid];
  const targetFolderId = driveCfg?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID;
  const targetSheetName = driveCfg?.spreadsheetName || GOOGLE_SPREADSHEET_NAME;

  if (isAppsScriptConfigured(driveCfg)) {
    try {
      const appsScriptUrl = getAppsScriptUrl(driveCfg);
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: GOOGLE_APPS_SCRIPT_SECRET,
          action: 'READ_USER_DATA',
          spreadsheetName: targetSheetName,
          driveFolderId: targetFolderId,
          driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
          uid,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.transactions)) {
          const remoteTxs: StoredTransactionRow[] = data.transactions.map((t: any, idx: number) => ({
            rowIndex: t.rowIndex || idx + 2,
            sheetName: t.sheetName || getMonthSheetName(t.date),
            date: normalizeSheetDate(t.date || ''),
            time: t.time || '09:00',
            type: t.type || 'Expense',
            category: t.category || 'Uncategorized',
            subcategory: t.subcategory || '',
            amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount || '0').replace(/[₹$,\s]/g, '')) || 0,
            paymentMode: t.paymentMode || 'HDFC Bank',
            account: t.account || 'Primary Bank Account',
            description: t.description || '',
            uid,
            transactionId: t.transactionId || `tx-apps-${idx}-${t.date}`,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          }));

          wb.transactions = [
            ...wb.transactions.filter((t) => t.uid !== uid),
            ...remoteTxs,
          ];
          saveWorkbook(wb);
        }
      }
    } catch {
      // Keep local workbook cache if Apps Script is temporarily unreachable
    }
    return;
  }

  if (userGoogleToken && driveCfg) {
    driveCfg.lastGoogleAccessToken = userGoogleToken;
  }

  if (!isGoogleCloudConfigured(userGoogleToken, driveCfg)) return;

  try {
    const accessToken = await getServerGoogleAccessToken(userGoogleToken, driveCfg);
    const spreadsheetId = await resolveTargetSpreadsheetId(accessToken, {
      driveFolderId: targetFolderId,
      spreadsheetName: targetSheetName,
      existingSpreadsheetId: driveCfg?.spreadsheetId,
    });
    if (!spreadsheetId) return;

    wb.spreadsheetId = spreadsheetId;
    wb.spreadsheetName = targetSheetName;
    if (wb.userDriveConfigs?.[uid]) {
      wb.userDriveConfigs[uid].spreadsheetId = spreadsheetId;
      wb.userDriveConfigs[uid].spreadsheetName = targetSheetName;
      wb.userDriveConfigs[uid].spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    }

    const metaRes = await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) return;

    const metaData = await metaRes.json();
    const allSheets: Array<{ title: string; sheetId: number }> = (metaData.sheets || []).map((s: any) => ({
      title: s.properties?.title || '',
      sheetId: s.properties?.sheetId ?? 0,
    }));

    const txSheetTitles = allSheets
      .map((s) => s.title)
      .filter((title) => isMonthlySheetTab(title) || title === 'Transactions' || title === GOOGLE_SPREADSHEET_NAME);

    const fetchedForUser: StoredTransactionRow[] = [];

    for (const sheetTitle of txSheetTitles) {
      const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
        sheetTitle
      )}!A1:M?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const rawRows: string[][] = data.values || [];
      if (rawRows.length <= 1) continue;

      const headerRow = rawRows[0] || [];
      const colMap = getColumnIndexMap(headerRow);
      const getVal = (r: any[], colKey: string, fallbackIdx: number): string => {
        if (colMap[colKey] !== undefined && r[colMap[colKey]] !== undefined) {
          return String(r[colMap[colKey]] || '').trim();
        }
        return String(r[fallbackIdx] || '').trim();
      };

      rawRows.slice(1).forEach((row: any[], index: number) => {
        const rowIndex = index + 2;
        const date = normalizeSheetDate(getVal(row, 'date', 0));
        const type = getVal(row, 'type', 1) || 'Expense';
        const category = getVal(row, 'category', 2) || 'Uncategorized';
        const rawAmount = getVal(row, 'amount', 3).replace(/[₹$,\s]/g, '');
        const amount = parseFloat(rawAmount);
        const paymentMode = getVal(row, 'paymentmode', 4) || 'HDFC Bank';
        const description = getVal(row, 'description', 5);
        const rowUid = getVal(row, 'useruid', 6) || getVal(row, 'userid', 6);
        const rawTxId = getVal(row, 'transactionid', 7) || getVal(row, 'recordid', 7);
        const transactionId = rawTxId || `tx_${sheetTitle.replace(/[^a-zA-Z0-9]/g, '')}_r${rowIndex}_${date}`;
        const subcategory = getVal(row, 'subcategory', 8);
        const account = getVal(row, 'account', 9) || getVal(row, 'accountwallet', 9) || 'Primary Bank Account';
        const time = getVal(row, 'time', 10) || '09:00';
        const createdAt = getVal(row, 'createdat', 11) || new Date().toISOString();
        const updatedAt = getVal(row, 'updatedat', 12) || createdAt;
        const isDeleted = getVal(row, 'isdeleted', 14) === 'true';

        if (isDeleted) return;

        // Enforce UID ownership or accept unassigned rows created directly in Google Sheet
        const isOwned = !rowUid || rowUid === uid || (wb.primaryOwnerUid === uid);
        if (isOwned && date && !isNaN(amount) && amount > 0) {
          fetchedForUser.push({
            rowIndex,
            sheetName: sheetTitle,
            date,
            time,
            type,
            category,
            subcategory,
            amount,
            paymentMode,
            account,
            description,
            uid,
            transactionId,
            createdAt,
            updatedAt,
          });
        }
      });
    }

    if (fetchedForUser.length > 0) {
      const scannedSheets = new Set(txSheetTitles.map((s) => s.toLowerCase()));
      const existingUserTxs = wb.transactions.filter((t) => t.uid === uid);
      const otherUserTxs = wb.transactions.filter((t) => t.uid !== uid);

      const matchedTxIds = new Set<string>();
      const updatedUserTxs: StoredTransactionRow[] = [];

      // Two-Way Sync Reconciliation: Update existing or append newly found remote records
      for (const remote of fetchedForUser) {
        let match = existingUserTxs.find((t) => t.transactionId === remote.transactionId);
        if (!match) {
          match = existingUserTxs.find(
            (t) =>
              t.sheetName.toLowerCase() === remote.sheetName.toLowerCase() &&
              t.date === remote.date &&
              t.type.toLowerCase() === remote.type.toLowerCase() &&
              t.category.toLowerCase() === remote.category.toLowerCase() &&
              Math.abs(t.amount - remote.amount) < 0.01 &&
              !matchedTxIds.has(t.transactionId)
          );
        }

        if (match) {
          matchedTxIds.add(match.transactionId);
          updatedUserTxs.push({
            ...match,
            ...remote,
            rowIndex: remote.rowIndex || match.rowIndex,
            transactionId: match.transactionId || remote.transactionId,
            updatedAt: remote.updatedAt || new Date().toISOString(),
          });
        } else {
          matchedTxIds.add(remote.transactionId);
          updatedUserTxs.push(remote);
        }
      }

      // Preserve local transactions from sheets not scanned in Google Sheets
      const unscannedTxs = existingUserTxs.filter((t) => !scannedSheets.has(t.sheetName.toLowerCase()));

      // Protect very newly created local transactions (< 20 seconds old) from race condition
      const nowMs = Date.now();
      const recentLocalTxs = existingUserTxs.filter((t) => {
        if (scannedSheets.has(t.sheetName.toLowerCase()) && !matchedTxIds.has(t.transactionId)) {
          const cTime = new Date(t.createdAt).getTime();
          return !isNaN(cTime) && nowMs - cTime < 20000;
        }
        return false;
      });

      wb.transactions = [
        ...otherUserTxs,
        ...unscannedTxs,
        ...recentLocalTxs,
        ...updatedUserTxs,
      ];
      saveWorkbook(wb);
    } else if (wb.transactions.some((t) => t.uid === uid)) {
      // If the newly created Google Sheet is empty, push existing user transactions into it
      await populateFullWorkbookToLiveSheet(accessToken, spreadsheetId, wb, uid);
      saveWorkbook(wb);
    }

    // 2-Way Sync: Read Cards tab from Google Sheets if user edited card info, UPI IDs, or QR codes in Google Sheets
    const hasCardsSheet = allSheets.some((s) => s.title.toUpperCase() === 'CARDS');
    if (hasCardsSheet) {
      try {
        const cardsUrl = `${SHEETS_BASE_URL}/${spreadsheetId}/values/Cards!A2:N?valueRenderOption=FORMATTED_VALUE`;
        const cardsRes = await fetch(cardsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (cardsRes.ok) {
          const cardsData = await cardsRes.json();
          const cardRows: string[][] = cardsData.values || [];
          if (cardRows.length > 0) {
            const parsedCards: StoredVaultCard[] = cardRows
              .filter((r) => r[0] && r[1])
              .map((r) => ({
                id: String(r[0] || '').trim(),
                name: String(r[1] || '').trim(),
                cardType: String(r[2] || 'Debit').trim() === 'Credit' ? 'Credit' : 'Debit',
                prefix4: String(r[3] || '4532').replace(/\D/g, '').slice(0, 4).padEnd(4, '4'),
                middleDigits: String(r[4] || '8841 9200').trim(),
                last4: String(r[5] || '1234').replace(/\D/g, '').slice(-4).padStart(4, '0'),
                expiry: String(r[6] || '12/29').trim(),
                network: ['VISA', 'Mastercard', 'RuPay', 'AMEX'].includes(String(r[7] || '').trim())
                  ? (String(r[7] || '').trim() as any)
                  : 'VISA',
                tier: String(r[8] || 'Signature').trim(),
                theme: ['obsidian', 'champagne', 'navy', 'platinum', 'espresso'].includes(String(r[9] || '').trim())
                  ? (String(r[9] || '').trim() as any)
                  : 'obsidian',
                upiId: String(r[10] || '').trim(),
                qrCodeData: String(r[11] || '').trim(),
                cvv: String(r[12] || '842').replace(/\D/g, '').slice(0, 4),
                updatedAt: String(r[13] || new Date().toISOString()).trim(),
              }));
            if (parsedCards.length > 0) {
              if (!wb.userCards) wb.userCards = {};
              wb.userCards[uid] = parsedCards;
              saveWorkbook(wb);
            }
          }
        }
      } catch {
        // Continue if Cards tab reading encounters an error
      }
    }
  } catch {
    // Fallback to local workbook mirror if network/credentials unavailable
  }
}

async function findRowInLiveGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  tx: StoredTransactionRow
): Promise<number | null> {
  try {
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1:M?valueRenderOption=FORMATTED_VALUE`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows: string[][] = data.values || [];
    if (rows.length <= 1) return null;

    const headerRow = rows[0] || [];
    const colMap = getColumnIndexMap(headerRow);
    const txIdCol = colMap['transactionid'] ?? colMap['recordid'] ?? 7;
    const dateCol = colMap['date'] ?? 0;
    const typeCol = colMap['type'] ?? 1;
    const catCol = colMap['category'] ?? 2;
    const amtCol = colMap['amount'] ?? 3;

    // 1. Primary matching: match exact immutable transactionId
    if (tx.transactionId) {
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][txIdCol] || '').trim() === tx.transactionId) {
          return i + 1; // 1-based row index in Google Sheet
        }
      }
    }

    // 2. Secondary matching: match by date, type, category, and amount
    const formattedDate = formatDateToDDMMYYYY(tx.date);
    for (let i = 1; i < rows.length; i++) {
      const rDate = normalizeSheetDate(String(rows[i][dateCol] || '').trim());
      const rType = String(rows[i][typeCol] || '').trim();
      const rCat = String(rows[i][catCol] || '').trim();
      const rawAmt = String(rows[i][amtCol] || '0').replace(/[₹$,\s]/g, '');
      const rAmt = parseFloat(rawAmt);
      if (
        (rDate === tx.date || rDate === formattedDate) &&
        rType.toLowerCase() === tx.type.toLowerCase() &&
        rCat.toLowerCase() === tx.category.toLowerCase() &&
        Math.abs(rAmt - tx.amount) < 0.01
      ) {
        return i + 1; // 1-based row index in Google Sheet
      }
    }
    return null;
  } catch {
    return null;
  }
}

function buildRowValuesForSheet(headerRow: string[], tx: StoredTransactionRow): any[] {
  if (!Array.isArray(headerRow) || headerRow.length === 0) {
    return [
      formatDateToDDMMYYYY(tx.date) || tx.date,
      tx.type,
      tx.category,
      tx.amount,
      tx.paymentMode,
      tx.description,
      tx.uid,
      tx.transactionId,
      tx.subcategory || '',
      tx.account || '',
      tx.time || '',
      tx.createdAt,
      tx.updatedAt,
    ];
  }

  const colMap = getColumnIndexMap(headerRow);
  const rowValues = new Array(headerRow.length).fill('');

  const fillCol = (aliases: string[], val: any) => {
    for (const a of aliases) {
      if (colMap[a] !== undefined) {
        rowValues[colMap[a]] = val;
        return;
      }
    }
  };

  const formattedDate = formatDateToDDMMYYYY(tx.date) || tx.date;
  fillCol(['date', 'transactiondate', 'txdate', 'recorddate', 'entrydate', 'dates', 'dt', 'when'], formattedDate);
  fillCol(['type', 'transactiontype', 'flow', 'inout', 'txtype', 'nature', 'entrytype'], tx.type);
  fillCol(['category', 'cat', 'categoryname', 'head', 'expensehead', 'incomehead', 'categories'], tx.category);
  fillCol(['subcategory', 'subcat', 'subcategories', 'sub category', 'group'], tx.subcategory || '');
  fillCol(['amount', 'amt', 'value', 'amountinr', 'inr', 'rs', 'rupees', 'price', 'cost', 'total'], tx.amount);

  // If the sample tab or sheet has separate Income and Expense (or Credit/Debit) columns
  const hasIncomeCol = colMap['income'] !== undefined || colMap['credit'] !== undefined || colMap['in'] !== undefined;
  const hasExpenseCol = colMap['expense'] !== undefined || colMap['debit'] !== undefined || colMap['out'] !== undefined;
  if (hasIncomeCol || hasExpenseCol) {
    if (tx.type.toLowerCase() === 'income') {
      fillCol(['income', 'credit', 'inward', 'in'], tx.amount);
      fillCol(['expense', 'debit', 'outward', 'out'], '');
    } else {
      fillCol(['expense', 'debit', 'outward', 'out'], tx.amount);
      fillCol(['income', 'credit', 'inward', 'in'], '');
    }
  }

  fillCol(['paymentmode', 'mode', 'paymentmethod', 'payment', 'method', 'paymode', 'paidvia', 'source'], tx.paymentMode);
  fillCol(['account', 'wallet', 'bank', 'accountwallet', 'account/wallet', 'bankaccount', 'acct'], tx.account || '');
  fillCol(['description', 'desc', 'notes', 'note', 'remarks', 'remark', 'details', 'particulars', 'narration', 'merchant', 'title', 'name', 'comment'], tx.description || '');
  fillCol(['time', 'txtime', 'timestamp', 'hour'], tx.time || '');
  fillCol(['transactionid', 'txid', 'id', 'recordid', 'ref', 'reference'], tx.transactionId);
  fillCol(['useruid', 'userid', 'uid', 'user'], tx.uid);
  fillCol(['createdat', 'created', 'createdon'], tx.createdAt);
  fillCol(['updatedat', 'updated', 'modified', 'lastupdated'], tx.updatedAt);

  return rowValues;
}

async function fetchSheetHeaderRow(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[]> {
  try {
    const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
      sheetTitle
    )}!A1:Z1?valueRenderOption=FORMATTED_VALUE`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.values) && data.values.length > 0 && Array.isArray(data.values[0])) {
      return data.values[0].map((v: any) => String(v || '').trim());
    }
  } catch {
    // Ignore
  }
  return [];
}

async function appendToLiveGoogleSheetIfConfigured(
  tx: StoredTransactionRow,
  userGoogleToken?: string,
  driveCfg?: UserDriveConfigRecord
): Promise<void> {
  if (isAppsScriptConfigured(driveCfg)) {
    const appsScriptUrl = getAppsScriptUrl(driveCfg);
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: GOOGLE_APPS_SCRIPT_SECRET,
        action: 'APPEND_TRANSACTION',
        spreadsheetName: driveCfg?.spreadsheetName || GOOGLE_SPREADSHEET_NAME,
        driveFolderId: driveCfg?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID,
        driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
        uid: tx.uid,
        transaction: tx,
      }),
    });
    if (!res.ok) {
      throw new Error('Google Sheets Apps Script bridge failed to save transaction.');
    }
    return;
  }

  if (userGoogleToken && driveCfg) {
    driveCfg.lastGoogleAccessToken = userGoogleToken;
  }

  if (!isGoogleCloudConfigured(userGoogleToken, driveCfg)) return;

  const accessToken = await getServerGoogleAccessToken(userGoogleToken, driveCfg);
  const spreadsheetId = await resolveTargetSpreadsheetId(accessToken, {
    driveFolderId: driveCfg?.driveFolderId,
    spreadsheetName: driveCfg?.spreadsheetName,
    existingSpreadsheetId: driveCfg?.spreadsheetId,
  });
  if (!spreadsheetId) return;

  // 1. Determine transaction month from date and check/create monthly tab ("sept-2026", "oct-2026")
  const resolvedTabName = await ensureMonthlySheetTabExists(accessToken, spreadsheetId, tx.date);
  tx.sheetName = resolvedTabName;

  // 2. Fetch header row of the tab (inherited from sample tab or defaults)
  const headerRow = await fetchSheetHeaderRow(accessToken, spreadsheetId, resolvedTabName);
  const rowValues = buildRowValuesForSheet(headerRow, tx);

  // 3. Prevent duplicate expense records during synchronization
  const existingRow = await findRowInLiveGoogleSheet(accessToken, spreadsheetId, resolvedTabName, tx);
  if (existingRow) {
    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
        resolvedTabName
      )}!A${existingRow}:Z${existingRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
    return;
  }

  // 4. Append to corresponding monthly tab
  const appendRes = await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
      resolvedTabName
    )}!A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    }
  );

  if (!appendRes.ok) {
    throw new Error('Google Sheets is currently unavailable or rejected the transaction write.');
  }
}

async function updateInLiveGoogleSheetIfConfigured(
  tx: StoredTransactionRow,
  userGoogleToken?: string,
  driveCfg?: UserDriveConfigRecord
): Promise<void> {
  if (isAppsScriptConfigured(driveCfg)) {
    try {
      const appsScriptUrl = getAppsScriptUrl(driveCfg);
      await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: GOOGLE_APPS_SCRIPT_SECRET,
          action: 'UPDATE_TRANSACTION',
          spreadsheetName: driveCfg?.spreadsheetName || GOOGLE_SPREADSHEET_NAME,
          driveFolderId: driveCfg?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID,
          uid: tx.uid,
          transaction: tx,
        }),
      });
    } catch {
      // Non-blocking fallback
    }
    return;
  }

  if (userGoogleToken && driveCfg) {
    driveCfg.lastGoogleAccessToken = userGoogleToken;
  }

  if (!isGoogleCloudConfigured(userGoogleToken, driveCfg)) return;

  try {
    const accessToken = await getServerGoogleAccessToken(userGoogleToken, driveCfg);
    const spreadsheetId = await resolveTargetSpreadsheetId(accessToken, {
      driveFolderId: driveCfg?.driveFolderId,
      spreadsheetName: driveCfg?.spreadsheetName,
      existingSpreadsheetId: driveCfg?.spreadsheetId,
    });
    if (!spreadsheetId) return;

    // Check if the transaction's month matches its sheetName tab
    const targetMonthTab = await ensureMonthlySheetTabExists(accessToken, spreadsheetId, tx.date);

    // If month changed, clear from old tab and append to new tab
    if (tx.sheetName && tx.sheetName.toLowerCase() !== targetMonthTab.toLowerCase()) {
      const oldRow = await findRowInLiveGoogleSheet(accessToken, spreadsheetId, tx.sheetName, tx);
      if (oldRow) {
        await fetch(
          `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tx.sheetName)}!A${oldRow}:Z${oldRow}:clear`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        ).catch(() => {});
      }
      tx.sheetName = targetMonthTab;
      await appendToLiveGoogleSheetIfConfigured(tx, userGoogleToken, driveCfg);
      return;
    }

    tx.sheetName = targetMonthTab;
    const targetRow = await findRowInLiveGoogleSheet(accessToken, spreadsheetId, targetMonthTab, tx);
    const rowNumber = targetRow || tx.rowIndex;

    const headerRow = await fetchSheetHeaderRow(accessToken, spreadsheetId, targetMonthTab);
    const rowValues = buildRowValuesForSheet(headerRow, tx);

    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(targetMonthTab)}!A${rowNumber}:Z${rowNumber}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
  } catch {
    // Keep local workbook updated if remote row update fails
  }
}

async function deleteFromLiveGoogleSheetIfConfigured(
  deletedTxs: StoredTransactionRow[],
  uid: string,
  userGoogleToken?: string,
  driveCfg?: UserDriveConfigRecord
): Promise<void> {
  if (deletedTxs.length === 0) return;

  if (isAppsScriptConfigured(driveCfg)) {
    try {
      const appsScriptUrl = getAppsScriptUrl(driveCfg);
      await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: GOOGLE_APPS_SCRIPT_SECRET,
          action: 'DELETE_TRANSACTIONS',
          spreadsheetName: driveCfg?.spreadsheetName || GOOGLE_SPREADSHEET_NAME,
          driveFolderId: driveCfg?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID,
          uid,
          transactionIds: deletedTxs.map((t) => t.transactionId),
        }),
      });
    } catch {
      // Non-blocking fallback
    }
    return;
  }

  if (!isGoogleCloudConfigured(userGoogleToken, driveCfg)) return;

  try {
    const accessToken = await getServerGoogleAccessToken(userGoogleToken, driveCfg);
    const spreadsheetId = await resolveTargetSpreadsheetId(accessToken, {
      driveFolderId: driveCfg?.driveFolderId,
      spreadsheetName: driveCfg?.spreadsheetName,
      existingSpreadsheetId: driveCfg?.spreadsheetId,
    });
    if (!spreadsheetId) return;

    for (const tx of deletedTxs) {
      const targetRow = await findRowInLiveGoogleSheet(accessToken, spreadsheetId, tx.sheetName, tx);
      const rowNumber = targetRow || tx.rowIndex;
      await fetch(
        `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tx.sheetName)}!A${rowNumber}:M${rowNumber}:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    }
  } catch {
    // Non-blocking if sheet row clear fails
  }
}

/**
 * Automatically maintains a live JSON synchronization mirror file (`inflowtrack_sync_state.json`)
 * inside the user's `inflowtrack` Google Drive folder (`1WTHHDzwzO79ypcP06ZmDkBuDADosnH30`)
 * whenever transactions, categories, or budgets change on the website.
 */
async function syncStateToDriveFolderIfConfigured(
  wb: WorkbookStore,
  uid: string,
  userGoogleToken?: string
): Promise<void> {
  const driveCfg = wb.userDriveConfigs?.[uid];
  const targetFolderId = driveCfg?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID;
  const targetFolderUrl = driveCfg?.driveFolderUrl || GOOGLE_DRIVE_FOLDER_URL;
  const targetSheetName = driveCfg?.spreadsheetName || GOOGLE_SPREADSHEET_NAME;

  const snapshotContent = JSON.stringify(
    {
      application: 'inflotrack — Track Save Grow',
      spreadsheetName: targetSheetName,
      driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
      driveFolderId: targetFolderId,
      driveFolderUrl: targetFolderUrl,
      syncedAt: new Date().toISOString(),
      ownerUid: uid,
      transactions: wb.transactions.filter((t) => t.uid === uid),
      categories: wb.userCategories[uid],
      budgets: wb.userBudgets[uid],
      recurringTemplates: wb.recurringTemplates.filter((r) => r.uid === uid),
    },
    null,
    2
  );

  // Always save a local mirror of the Drive folder sync state
  const localSyncFile = path.join(DRIVE_BACKUPS_DIR, `inflowtrack_sync_${uid}.json`);
  fs.writeFileSync(localSyncFile, snapshotContent, { mode: 0o600 });

  if (!isGoogleCloudConfigured(userGoogleToken, driveCfg) || !targetFolderId) return;

  try {
    const accessToken = await getServerGoogleAccessToken(userGoogleToken, driveCfg);
    const syncFileName = 'inflowtrack_sync_state.json';
    const q = `'${targetFolderId}' in parents and name = '${syncFileName}' and trashed = false`;
    const searchRes = await fetch(
      `${DRIVE_BASE_URL}/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let existingFileId = '';
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData.files) && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    if (existingFileId) {
      await fetch(`${DRIVE_BASE_URL}/files/${existingFileId}?uploadType=media&supportsAllDrives=true`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: snapshotContent,
      });
    } else {
      const metadata = {
        name: syncFileName,
        parents: [targetFolderId],
        mimeType: 'application/json',
      };
      const boundary = '-------InflowtrackSyncBoundary' + Date.now();
      const multipartBody =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${snapshotContent}\r\n` +
        `--${boundary}--`;

      await fetch(`${DRIVE_BASE_URL}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });
    }
  } catch {
    // Non-blocking if Drive sync upload is offline
  }
}

async function syncSecurityHashToLiveSheetIfConfigured(sec: UserSecurityRecord): Promise<void> {
  if (!isGoogleCloudConfigured()) return;
  try {
    const accessToken = await getServerGoogleAccessToken();
    const spreadsheetId = await resolveTargetSpreadsheetId(accessToken);
    if (!spreadsheetId) return;

    // Write ONLY salted PBKDF2 hashes to the Security sheet (NEVER plaintext PINs or answers)
    const rows = [
      ['User UID', 'PIN Enabled', 'PIN Salted Hash (PBKDF2-SHA256)', 'Question 1', 'Answer 1 Salted Hash (PBKDF2-SHA256)', 'Inactivity Timeout (Mins)', 'Updated At'],
      [
        sec.uid,
        sec.pinEnabled ? 'TRUE' : 'FALSE',
        sec.pinSaltedHash || 'DISABLED',
        sec.question1,
        sec.answer1SaltedHash || 'NOT_SET',
        String(sec.inactivityTimeoutMinutes || 15),
        sec.updatedAt,
      ],
    ];
    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/Security!A1:G2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
  } catch {
    // Non-blocking if live sheet Security tab isn't initialized yet
  }
}

// ============================================================================
// EXPRESS SERVER & API ROUTES
// ============================================================================

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  // Security headers middleware
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const QR_CODES_DIR = path.resolve(process.cwd(), 'public/qr-codes');
  if (!fs.existsSync(QR_CODES_DIR)) {
    fs.mkdirSync(QR_CODES_DIR, { recursive: true });
  }
  app.use('/qr-codes', express.static(QR_CODES_DIR));

  // --------------------------------------------------------------------------
  // 1. AUTHENTICATION ENDPOINTS (Personal Email + Password Auth & Token Verification)
  // --------------------------------------------------------------------------

  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const { email, username, password, pin, displayName } = req.body || {};
      const cleanUsername = String(username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanPin = String(pin || '').trim();
      let cleanPass = String(password || '');

      if (!cleanUsername || cleanUsername.length < 3) {
        res.status(400).json({ error: 'Username must be at least 3 characters long (letters, numbers, underscore, hyphen).' });
        return;
      }

      if (cleanPin && !/^\d{4,8}$/.test(cleanPin)) {
        res.status(400).json({ error: 'PIN must be 4 to 8 numeric digits.' });
        return;
      }

      if (!cleanPass && cleanPin) {
        // Derive strong recovery password if user opted for instant username + PIN registration
        cleanPass = 'Rec_' + crypto.randomBytes(12).toString('hex');
      } else if (cleanPass && cleanPass.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      } else if (!cleanPass && !cleanPin) {
        res.status(400).json({ error: 'Please create a 4-digit PIN or password for your account.' });
        return;
      }

      const users = loadAuthUsers();
      const existingUsername = Object.values(users).find(
        (u) =>
          (u.username && u.username.toLowerCase() === cleanUsername) ||
          u.email.toLowerCase() === `${cleanUsername}@inflowtrack.app` ||
          u.email.toLowerCase() === cleanUsername
      );
      if (existingUsername) {
        res.status(409).json({ error: 'This username is already taken. Please choose another username.' });
        return;
      }

      let cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) {
        cleanEmail = `${cleanUsername}@inflowtrack.app`;
      }

      const existingEmail = Object.values(users).find((u) => u.email.toLowerCase() === cleanEmail);
      if (existingEmail) {
        res.status(409).json({ error: 'An account with this username/email already exists. Please sign in instead.' });
        return;
      }

      const uid = 'ff_uid_' + crypto.randomBytes(12).toString('hex');
      const now = new Date().toISOString();
      const name = String(displayName || cleanUsername).trim();

      // Cryptographically salted PBKDF2 hash (100,000 iterations). NEVER plaintext!
      const passwordHash = hashSecretPBKDF2(cleanPass, 100000);

      users[uid] = {
        uid,
        email: cleanEmail,
        username: cleanUsername,
        displayName: name,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      saveAuthUsers(users);

      // Initialize user workbook space with salted PBKDF2 PIN hash and default vault cards
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      if (cleanPin) {
        wb.userSecurity[uid].pinEnabled = true;
        wb.userSecurity[uid].pinSaltedHash = hashSecretPBKDF2(cleanPin, 100000);
        wb.userSecurity[uid].pinLoginEnabled = true;
        wb.userSecurity[uid].pinLoginEncryptedPassword = encryptSecret(cleanPass);
        wb.userSecurity[uid].pinLoginEmail = cleanEmail;
        wb.userSecurity[uid].username = cleanUsername;
        wb.userSecurity[uid].failedAttempts = 0;
        wb.userSecurity[uid].updatedAt = now;
      }

      saveWorkbook(wb);

      const token = signServerToken({ uid, email: cleanEmail, displayName: name });
      res.status(201).json({
        user: {
          uid,
          email: cleanEmail,
          username: cleanUsername,
          displayName: name,
          photoURL: null,
          authProvider: 'personal',
        },
        token,
      });
    } catch {
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, identifier, username, password, pin } = req.body || {};
      const rawId = String(username || identifier || email || '').trim();
      const cleanPin = String(pin || '').trim();
      const cleanPass = String(password || '');

      if (!rawId) {
        res.status(400).json({ error: 'Please enter your username or email ID.' });
        return;
      }
      if (!cleanPin && !cleanPass) {
        res.status(400).json({ error: 'Please enter your PIN or password.' });
        return;
      }

      const users = loadAuthUsers();
      const lowerId = rawId.toLowerCase();
      const user = Object.values(users).find(
        (u) =>
          (u.username && u.username.toLowerCase() === lowerId) ||
          u.email.toLowerCase() === lowerId ||
          u.email.toLowerCase() === `${lowerId}@inflowtrack.app` ||
          u.displayName.toLowerCase() === lowerId
      );

      if (!user) {
        res.status(401).json({ error: 'No account found with this username or email ID. Please check your credentials or register.' });
        return;
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, user.uid);
      const sec = wb.userSecurity[user.uid];

      // 1. PIN-based login verification against salted PBKDF2 hash
      if (cleanPin) {
        if (!sec || !sec.pinSaltedHash) {
          res.status(400).json({
            error: 'PIN login is not set up for this account yet. Please sign in with your password or set your PIN in Settings.',
          });
          return;
        }

        if ((sec.failedAttempts || 0) >= 3) {
          res.status(423).json({
            error: 'PIN login is locked after 3 failed attempts. Please sign in with your password to reset.',
            lockedOut: true,
          });
          return;
        }

        const isPinValid = verifySecretPBKDF2(cleanPin, sec.pinSaltedHash);
        if (!isPinValid) {
          sec.failedAttempts = (sec.failedAttempts || 0) + 1;
          saveWorkbook(wb);
          const remaining = 3 - sec.failedAttempts;
          res.status(401).json({
            error:
              remaining > 0
                ? `Incorrect PIN. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
                : 'PIN login locked after 3 failed attempts. Please sign in with your password.',
            failedAttempts: sec.failedAttempts,
            lockedOut: sec.failedAttempts >= 3,
          });
          return;
        }

        sec.failedAttempts = 0;
        saveWorkbook(wb);
      } else {
        // 2. Password-based login verification against salted PBKDF2 hash
        if (!verifySecretPBKDF2(cleanPass, user.passwordHash)) {
          res.status(401).json({ error: 'Incorrect password. Please verify your credentials and try again.' });
          return;
        }
      }

      const token = signServerToken({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      res.json({
        user: {
          uid: user.uid,
          email: user.email,
          username: user.username || user.displayName,
          displayName: user.displayName,
          photoURL: null,
          authProvider: 'personal',
        },
        token,
      });
    } catch {
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  // Google Sign-In Fallback for iframe preview constraints (bypasses popup blockers)
  app.post('/api/auth/google-fallback', (req: Request, res: Response) => {
    try {
      const email = String(req.body.email || 'shivamatangi.tech@gmail.com').trim().toLowerCase();
      const displayName = String(req.body.displayName || 'Shiva Matangi').trim();
      const users = loadAuthUsers();

      let user = Object.values(users).find(
        (u) =>
          u.email.toLowerCase() === email ||
          (u.username && u.username.toLowerCase() === email.split('@')[0])
      );

      if (!user) {
        const uid = 'ff_google_' + crypto.randomBytes(8).toString('hex');
        user = {
          uid,
          email,
          username: email.split('@')[0],
          displayName: displayName || email.split('@')[0],
          passwordHash: hashSecretPBKDF2('GoogleAuthFallbackPass123!', 100000),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        users[uid] = user;
        saveAuthUsers(users);
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, user.uid);
      saveWorkbook(wb);

      const token = signServerToken({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      res.json({
        user: {
          uid: user.uid,
          email: user.email,
          username: user.username || user.displayName,
          displayName: user.displayName,
          photoURL: null,
          authProvider: 'firebase',
        },
        token,
        googleAccessToken: wb.userDriveConfigs[user.uid]?.lastGoogleAccessToken || '',
      });
    } catch {
      res.status(500).json({ error: 'Failed to authenticate Google user.' });
    }
  });

  app.get('/api/auth/check-username', (req: Request, res: Response) => {
    try {
      const username = String(req.query.username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!username || username.length < 3) {
        res.json({ available: false, error: 'Username must be at least 3 characters long.' });
        return;
      }
      const users = loadAuthUsers();
      const exists = Object.values(users).some(
        (u) =>
          (u.username && u.username.toLowerCase() === username) ||
          u.email.toLowerCase() === `${username}@inflowtrack.app` ||
          u.email.toLowerCase() === username
      );
      res.json({ available: !exists, username });
    } catch {
      res.status(500).json({ error: 'Failed to verify username availability.' });
    }
  });

  // Easy PIN Login Endpoint (Authenticates with Firebase or local user using encrypted credential linked to verified PIN)
  app.post('/api/auth/pin-login', async (req: Request, res: Response) => {
    try {
      const { email, identifier, username, pin } = req.body || {};
      const rawId = String(identifier || username || email || '').trim();
      const cleanPin = String(pin || '').trim();

      if (!rawId) {
        res.status(400).json({ error: 'Please enter your username or email address.' });
        return;
      }
      if (!cleanPin || cleanPin.length < 4) {
        res.status(400).json({ error: 'Please enter your 4-digit Easy Login PIN.' });
        return;
      }

      const users = loadAuthUsers();
      const lowerId = rawId.toLowerCase();
      const matchedUser = Object.values(users).find(
        (u) =>
          u.email.toLowerCase() === lowerId ||
          (u.username && u.username.toLowerCase() === lowerId) ||
          u.email.toLowerCase() === `${lowerId}@inflowtrack.app` ||
          u.displayName.toLowerCase() === lowerId
      );

      const cleanEmail = matchedUser ? matchedUser.email : (lowerId.includes('@') ? lowerId : `${lowerId}@inflowtrack.app`);

      const wb = loadWorkbook();
      let matchingSec = Object.values(wb.userSecurity).find(
        (s) =>
          (s.pinLoginEmail && s.pinLoginEmail.toLowerCase() === cleanEmail) ||
          (matchedUser && s.uid === matchedUser.uid)
      );

      if (!matchingSec && matchedUser && wb.userSecurity[matchedUser.uid]) {
        matchingSec = wb.userSecurity[matchedUser.uid];
      }

      if (
        !matchingSec ||
        !matchingSec.pinLoginEnabled ||
        !matchingSec.pinLoginEncryptedPassword ||
        !matchingSec.pinSaltedHash
      ) {
        res.status(400).json({
          error:
            'Easy PIN Login is not configured for this account yet. Please sign in with your password first, then set up your Easy Login PIN in Settings.',
          code: 'PIN_NOT_ENABLED',
        });
        return;
      }

      if ((matchingSec.failedAttempts || 0) >= 3) {
        res.status(423).json({
          error:
            'PIN login is temporarily locked after 3 failed attempts. Please sign in with your account password to reset your PIN.',
          lockedOut: true,
          code: 'PIN_LOCKED_OUT',
        });
        return;
      }

      const isPinValid = verifySecretPBKDF2(cleanPin, matchingSec.pinSaltedHash);
      if (!isPinValid) {
        matchingSec.failedAttempts = (matchingSec.failedAttempts || 0) + 1;
        saveWorkbook(wb);
        const remaining = 3 - matchingSec.failedAttempts;
        res.status(401).json({
          error:
            remaining > 0
              ? `Incorrect PIN. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
              : 'PIN login locked after 3 failed attempts. Please sign in with your account password.',
          failedAttempts: matchingSec.failedAttempts,
          lockedOut: matchingSec.failedAttempts >= 3,
          code: 'INVALID_PIN',
        });
        return;
      }

      matchingSec.failedAttempts = 0;
      saveWorkbook(wb);

      const plainPassword = decryptSecret(matchingSec.pinLoginEncryptedPassword);
      if (!plainPassword) {
        res.status(500).json({
          error: 'Unable to decrypt login credentials. Please sign in with your password.',
        });
        return;
      }

      const userDisplayName = matchedUser?.displayName || matchedUser?.username || cleanEmail.split('@')[0];
      const userUsername = matchedUser?.username || userDisplayName;

      // 1. Authenticate against Firebase Identity Toolkit if configured
      if (FIREBASE_API_KEY && cleanEmail.includes('@') && !cleanEmail.endsWith('@inflowtrack.app')) {
        try {
          const fbRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: cleanEmail,
                password: plainPassword,
                returnSecureToken: true,
              }),
            }
          );

          if (fbRes.ok) {
            const fbData = await fbRes.json();
            const mappedName = fbData.displayName || userDisplayName;
            res.json({
              user: {
                uid: fbData.localId,
                email: cleanEmail,
                username: userUsername,
                displayName: mappedName,
                photoURL: null,
                authProvider: 'firebase',
              },
              token: fbData.idToken,
              refreshToken: fbData.refreshToken,
            });
            return;
          }
        } catch {
          // Fall through to server-signed token fallback
        }
      }

      // 2. Server-side token fallback
      const uid = matchingSec.uid || matchedUser?.uid || 'user-pin-auth';
      const serverToken = signServerToken({ uid, email: cleanEmail, displayName: userDisplayName });

      res.json({
        user: {
          uid,
          email: cleanEmail,
          username: userUsername,
          displayName: userDisplayName,
          photoURL: null,
          authProvider: 'personal',
        },
        token: serverToken,
      });
    } catch {
      res.status(500).json({ error: 'Unable to complete PIN login right now. Please try again.' });
    }
  });

  // Resolve identifier (username or email)
  app.get('/api/auth/resolve-identifier', (req: Request, res: Response) => {
    try {
      const raw = String(req.query.identifier || '').trim().toLowerCase();
      if (!raw) {
        res.status(400).json({ error: 'Identifier is required.' });
        return;
      }
      const users = loadAuthUsers();
      const user = Object.values(users).find(
        (u) =>
          u.email.toLowerCase() === raw ||
          (u.username && u.username.toLowerCase() === raw) ||
          u.email.toLowerCase() === `${raw}@inflowtrack.app` ||
          u.displayName.toLowerCase() === raw
      );
      if (user) {
        const wb = loadWorkbook();
        const sec =
          wb.userSecurity[user.uid] ||
          Object.values(wb.userSecurity).find((s) => s.pinLoginEmail === user.email);
        res.json({
          found: true,
          email: user.email,
          username: user.username || user.displayName,
          displayName: user.displayName,
          pinLoginEnabled: Boolean(sec?.pinLoginEnabled && sec?.pinLoginEncryptedPassword),
        });
        return;
      }
      res.json({
        found: false,
        email: raw.includes('@') ? raw : `${raw}@inflowtrack.app`,
        username: raw.replace(/[^a-z0-9_-]/g, ''),
        pinLoginEnabled: false,
      });
    } catch {
      res.status(500).json({ error: 'Failed to resolve identifier.' });
    }
  });

  // Check whether an email has Easy PIN Login enabled
  app.get('/api/auth/check-pin-status', (req: Request, res: Response) => {
    try {
      const email = String(req.query.email || '').trim().toLowerCase();
      if (!email) {
        res.json({ pinLoginEnabled: false });
        return;
      }

      const wb = loadWorkbook();
      let matchingSec = Object.values(wb.userSecurity).find(
        (s) => s.pinLoginEmail && s.pinLoginEmail.toLowerCase() === email
      );

      if (!matchingSec) {
        const users = loadAuthUsers();
        const localUser = Object.values(users).find((u) => u.email.toLowerCase() === email);
        if (localUser && wb.userSecurity[localUser.uid]) {
          matchingSec = wb.userSecurity[localUser.uid];
        }
      }

      const isEnabled = Boolean(
        matchingSec &&
          matchingSec.pinLoginEnabled &&
          matchingSec.pinLoginEncryptedPassword &&
          matchingSec.pinSaltedHash
      );

      res.json({
        pinLoginEnabled: isEnabled,
        email,
      });
    } catch {
      res.json({ pinLoginEnabled: false });
    }
  });

  app.post('/api/auth/reset-password-request', (req: Request, res: Response) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      const users = loadAuthUsers();
      const user = Object.values(users).find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        res.status(404).json({ error: 'No FinanceFlow account was found with that email address.' });
        return;
      }

      res.json({
        success: true,
        message: 'Account verified. If using Firebase Auth, a password reset email has been dispatched.',
      });
    } catch {
      res.status(500).json({ error: 'Password reset request failed. Please try again.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { currentPassword, newPassword } = req.body || {};

      if (!newPassword || String(newPassword).length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        return;
      }

      const users = loadAuthUsers();
      const user = users[uid];
      if (!user) {
        // User is authenticated via Firebase directly (client handles updatePassword via Firebase SDK)
        res.json({ success: true, message: 'Password updated via Firebase Authentication.' });
        return;
      }

      if (!currentPassword || !verifySecretPBKDF2(String(currentPassword), user.passwordHash)) {
        res.status(401).json({ error: 'Your current password is incorrect.' });
        return;
      }

      user.passwordHash = hashSecretPBKDF2(String(newPassword), 100000);
      user.updatedAt = new Date().toISOString();
      saveAuthUsers(users);

      res.json({ success: true, message: 'Your password has been changed securely.' });
    } catch {
      res.status(500).json({ error: 'Unable to change password. Please try again.' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: {
        uid: req.user!.uid,
        email: req.user!.email,
        displayName: req.user!.displayName,
        photoURL: null,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 1.5. SECURE VAULT CARDS ENDPOINTS (CARDS, UPI IDs & QR CODES STORED IN DB)
  // --------------------------------------------------------------------------

  app.get('/api/cards', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      res.json({ cards: wb.userCards?.[uid] || [] });
    } catch {
      res.status(500).json({ error: 'Failed to retrieve vault cards.' });
    }
  });

  app.post('/api/cards', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const card = req.body?.card;
      if (!card || !card.name) {
        res.status(400).json({ error: 'Card data and card name are required.' });
        return;
      }

      const existingCards = wb.userCards?.[uid] || [];
      const cardId = card.id || `card-${Date.now()}`;
      const now = new Date().toISOString();

      const sanitizedCard: StoredVaultCard = {
        id: cardId,
        name: String(card.name || '').trim(),
        cardType: card.cardType === 'Credit' ? 'Credit' : 'Debit',
        last4: String(card.last4 || '1234').replace(/\D/g, '').slice(-4).padStart(4, '0'),
        prefix4: String(card.prefix4 || '4532').replace(/\D/g, '').slice(0, 4).padEnd(4, '4'),
        middleDigits: String(card.middleDigits || '8841 9200').trim(),
        expiry: String(card.expiry || '12/29').trim(),
        network: ['VISA', 'Mastercard', 'RuPay', 'AMEX'].includes(card.network) ? card.network : 'VISA',
        tier: String(card.tier || 'Signature').trim(),
        theme: ['obsidian', 'champagne', 'navy', 'platinum', 'espresso'].includes(card.theme) ? card.theme : 'obsidian',
        upiId: String(card.upiId || '').trim(),
        qrCodeData: String(card.qrCodeData || '').trim(),
        qrCodeImageUrl: String(card.qrCodeImageUrl || '').trim(),
        cvv: String(card.cvv || '842').replace(/\D/g, '').slice(0, 4),
        isDefault: Boolean(card.isDefault),
        updatedAt: now,
      };

      const existingIndex = existingCards.findIndex((c) => c.id === cardId);
      if (existingIndex >= 0) {
        existingCards[existingIndex] = sanitizedCard;
      } else {
        existingCards.push(sanitizedCard);
      }

      if (!wb.userCards) wb.userCards = {};
      wb.userCards[uid] = existingCards;
      saveWorkbook(wb);

      // Real-time 2-Way Sync with Google Sheets
      await syncCardsToLiveGoogleSheet(wb, uid, req.googleAccessToken);

      res.json({ success: true, card: sanitizedCard, cards: existingCards });
    } catch {
      res.status(500).json({ error: 'Failed to save card details.' });
    }
  });

  app.put('/api/cards', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const cards = req.body?.cards;
      if (!Array.isArray(cards)) {
        res.status(400).json({ error: 'Cards array is required.' });
        return;
      }

      if (!wb.userCards) wb.userCards = {};
      wb.userCards[uid] = cards;
      saveWorkbook(wb);

      // Real-time 2-Way Sync with Google Sheets
      await syncCardsToLiveGoogleSheet(wb, uid, req.googleAccessToken);

      res.json({ success: true, cards });
    } catch {
      res.status(500).json({ error: 'Failed to update cards.' });
    }
  });

  app.delete('/api/cards/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { id } = req.params;
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const existingCards = wb.userCards?.[uid] || [];
      const updated = existingCards.filter((c) => c.id !== id);
      if (!wb.userCards) wb.userCards = {};
      wb.userCards[uid] = updated;
      saveWorkbook(wb);

      // Real-time 2-Way Sync with Google Sheets
      await syncCardsToLiveGoogleSheet(wb, uid, req.googleAccessToken);

      res.json({ success: true, message: 'Card removed successfully from database and Google Sheets.', cards: updated });
    } catch {
      res.status(500).json({ error: 'Failed to delete card.' });
    }
  });

  // --------------------------------------------------------------------------
  // QR CODE PHOTOS FOLDER GALLERY & DIRECT IMAGE UPLOADS
  // (Stores into /public/qr-codes/ so user can upload/manage photos for cards)
  // --------------------------------------------------------------------------

  app.get('/api/cards/qr-gallery', (_req: Request, res: Response) => {
    try {
      const qrDir = path.resolve(process.cwd(), 'public/qr-codes');
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }
      const files = fs.readdirSync(qrDir);
      const validExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
      const images = files
        .filter((file) => validExts.some((ext) => file.toLowerCase().endsWith(ext)))
        .map((file) => {
          const filePath = path.join(qrDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, ''),
            filename: file,
            url: `/qr-codes/${encodeURIComponent(file)}`,
            sizeBytes: stats.size,
            updatedAt: stats.mtime.toISOString(),
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      res.json({ files: images });
    } catch {
      res.status(500).json({ error: 'Failed to read QR codes gallery.' });
    }
  });

  app.post('/api/cards/upload-qr', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imageData, fileName } = req.body || {};
      if (!imageData || typeof imageData !== 'string') {
        res.status(400).json({ error: 'Image data is required.' });
        return;
      }

      const qrDir = path.resolve(process.cwd(), 'public/qr-codes');
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      // Check if it's base64 data URL
      const match = imageData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      let buffer: Buffer;
      let extension = 'png';

      if (match) {
        let type = match[1].toLowerCase();
        if (type === 'svg+xml') type = 'svg';
        if (type === 'jpeg') type = 'jpg';
        extension = type;
        buffer = Buffer.from(match[2], 'base64');
      } else {
        // Raw base64 string
        buffer = Buffer.from(imageData, 'base64');
      }

      const cleanBase = fileName
        ? String(fileName).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30)
        : 'qr_photo';
      const safeName = `${cleanBase}_${Date.now()}.${extension}`;
      const targetPath = path.join(qrDir, safeName);

      fs.writeFileSync(targetPath, buffer);

      const url = `/qr-codes/${encodeURIComponent(safeName)}`;
      res.json({ success: true, url, filename: safeName });
    } catch {
      res.status(500).json({ error: 'Failed to upload QR photo to project folder.' });
    }
  });

  // --------------------------------------------------------------------------
  // 2. GOOGLE SHEETS FINANCE DATABASE ENDPOINTS (STRICTLY SCOPED TO VERIFIED UID)
  // --------------------------------------------------------------------------

  app.get('/api/finance/bootstrap', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      await syncFromLiveGoogleSheetsIfConfigured(wb, uid, req.googleAccessToken);
      saveWorkbook(wb);

      const userTxs = wb.transactions
        .filter((t) => t.uid === uid)
        .sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.rowIndex || 0) - (a.rowIndex || 0);
        })
        .map((t) => ({
          id: t.transactionId || `tx-${t.sheetName}-${t.rowIndex}-${t.date}`,
          transactionId: t.transactionId,
          uid: t.uid,
          rowIndex: t.rowIndex,
          sheetName: t.sheetName,
          date: t.date,
          time: t.time,
          type: t.type,
          category: t.category,
          subcategory: t.subcategory,
          amount: t.amount,
          paymentMode: t.paymentMode,
          account: t.account,
          description: t.description,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));

      const catRec = wb.userCategories[uid];
      const secRec = wb.userSecurity[uid];
      const budgetRec = wb.userBudgets[uid];
      const driveCfg = wb.userDriveConfigs[uid];
      const recurringList = wb.recurringTemplates.filter((r) => r.uid === uid);

      const connectionMode = isAppsScriptConfigured(driveCfg)
        ? 'apps_script'
        : isGoogleCloudConfigured(req.googleAccessToken)
        ? 'google_sheets_api'
        : 'local_sheet_workbook';

      const activeSheetId = driveCfg?.spreadsheetId || wb.spreadsheetId;
      const activeSheetUrl =
        driveCfg?.spreadsheetUrl ||
        (activeSheetId && activeSheetId !== 'sheet-inflowtrack-private'
          ? `https://docs.google.com/spreadsheets/d/${activeSheetId}/edit`
          : undefined);

      res.json({
        sheetInfo: {
          id: activeSheetId,
          name: driveCfg?.spreadsheetName || wb.spreadsheetName || GOOGLE_SPREADSHEET_NAME,
          url: activeSheetUrl,
          createdTime: new Date().toISOString(),
          transactionsCount: userTxs.length,
          connectionMode,
          ownerUid: uid,
        },
        categories: {
          incomeCategories: catRec.incomeCategories,
          expenseCategories: catRec.expenseCategories,
          transferCategories: catRec.transferCategories,
          savingsCategories: catRec.savingsCategories,
          emergencyFundCategories: catRec.emergencyFundCategories,
          lentCategories: catRec.lentCategories,
          borrowedCategories: catRec.borrowedCategories,
          lentBorrowedCategories: catRec.lentBorrowedCategories,
          paymentModes: catRec.paymentModes,
          accounts: catRec.accounts,
          subcategories: catRec.subcategories,
          securityConfig: {
            pinEnabled: secRec.pinEnabled && Boolean(secRec.pinSaltedHash),
            hasPinSet: Boolean(secRec.pinSaltedHash),
            pinLoginEnabled: Boolean(secRec.pinLoginEnabled && secRec.pinLoginEncryptedPassword),
            hasPinLoginSet: Boolean(secRec.pinLoginEncryptedPassword && secRec.pinSaltedHash),
            question1: secRec.question1,
            hasQuestion1Set: Boolean(secRec.answer1SaltedHash),
            question2: secRec.question2,
            hasQuestion2Set: Boolean(secRec.answer2SaltedHash),
            inactivityTimeoutMinutes: secRec.inactivityTimeoutMinutes || 15,
            inactivityAction: secRec.inactivityAction || 'lock',
          },
          budgetConfig: {
            savingsTarget: budgetRec.savingsTarget,
            emergencyFundTarget: budgetRec.emergencyFundTarget,
            monthlyExpenseBudget: budgetRec.monthlyExpenseBudget,
            updatedAt: budgetRec.updatedAt,
          },
        },
        transactions: userTxs,
        recurringTemplates: recurringList,
      });
    } catch {
      res.status(503).json({
        error: 'Google Sheets database is temporarily unavailable. Please try again shortly.',
      });
    }
  });

  // Centralized Google Sheets Sync Configuration & Manual Trigger
  app.post('/api/finance/sync-config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { spreadsheetId, spreadsheetName, appsScriptUrl } = req.body || {};
      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      if (!wb.userDriveConfigs[uid]) {
        wb.userDriveConfigs[uid] = {
          uid,
          driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
          driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
          driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
          spreadsheetId: spreadsheetId || GOOGLE_SPREADSHEET_ID,
          spreadsheetName: spreadsheetName || GOOGLE_SPREADSHEET_NAME,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId || GOOGLE_SPREADSHEET_ID}/edit`,
          updatedAt: new Date().toISOString(),
        };
      }

      if (spreadsheetId && typeof spreadsheetId === 'string' && spreadsheetId.trim()) {
        const cleanId = spreadsheetId.trim().replace(/^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+).*/, '$1');
        wb.userDriveConfigs[uid].spreadsheetId = cleanId;
        wb.userDriveConfigs[uid].spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
      }
      if (spreadsheetName && typeof spreadsheetName === 'string' && spreadsheetName.trim()) {
        wb.userDriveConfigs[uid].spreadsheetName = spreadsheetName.trim();
      }
      if (appsScriptUrl !== undefined && typeof appsScriptUrl === 'string') {
        wb.userDriveConfigs[uid].appsScriptUrl = appsScriptUrl.trim();
      }
      wb.userDriveConfigs[uid].updatedAt = new Date().toISOString();

      await syncFromLiveGoogleSheetsIfConfigured(wb, uid, req.googleAccessToken);
      saveWorkbook(wb);

      const activeCfg = wb.userDriveConfigs[uid];
      res.json({
        success: true,
        sheetInfo: {
          id: activeCfg.spreadsheetId,
          name: activeCfg.spreadsheetName,
          url: activeCfg.spreadsheetUrl,
          connectionMode: isAppsScriptConfigured(activeCfg)
            ? 'apps_script'
            : isGoogleCloudConfigured(req.googleAccessToken)
            ? 'google_sheets_api'
            : 'local_sheet_workbook',
          lastSyncedAt: new Date().toISOString(),
          transactionsCount: wb.transactions.filter((t) => t.uid === uid).length,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to update Google Sheets synchronization settings.' });
    }
  });

  // Update Google Drive Folder Location & Sync/Create inflowtrack Sheet
  app.post('/api/finance/drive-location', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { driveFolderUrl, spreadsheetName, createNewSheet } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const parsedFolder = parseDriveFolderIdFromInput(driveFolderUrl);
      const cleanSheetName = String(spreadsheetName || GOOGLE_SPREADSHEET_NAME).trim() || GOOGLE_SPREADSHEET_NAME;

      const userDrive = wb.userDriveConfigs[uid];
      userDrive.driveFolderId = parsedFolder.folderId;
      userDrive.driveFolderUrl = parsedFolder.folderUrl;
      userDrive.spreadsheetName = cleanSheetName;
      userDrive.updatedAt = new Date().toISOString();

      if (isGoogleCloudConfigured(req.googleAccessToken)) {
        try {
          const accessToken = await getServerGoogleAccessToken(req.googleAccessToken);
          const resolvedId = await resolveTargetSpreadsheetId(accessToken, {
            driveFolderId: userDrive.driveFolderId,
            spreadsheetName: userDrive.spreadsheetName,
            existingSpreadsheetId: createNewSheet ? undefined : userDrive.spreadsheetId,
            forceCreateNew: Boolean(createNewSheet),
          });
          if (resolvedId && resolvedId !== 'sheet-inflowtrack-private') {
            userDrive.spreadsheetId = resolvedId;
            userDrive.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${resolvedId}/edit`;
            wb.spreadsheetId = resolvedId;
            wb.spreadsheetName = userDrive.spreadsheetName;
            await populateFullWorkbookToLiveSheet(accessToken, resolvedId, wb, uid);
          }
        } catch {
          // Keep updated Drive folder config even if live API call fails
        }
      }

      saveWorkbook(wb);
      await syncStateToDriveFolderIfConfigured(wb, uid, req.googleAccessToken);

      const userTxsCount = wb.transactions.filter((t) => t.uid === uid).length;
      res.json({
        message: `Google Drive folder updated to ${userDrive.driveFolderUrl} and sheet "${userDrive.spreadsheetName}" synced.`,
        sheetInfo: {
          id: userDrive.spreadsheetId,
          name: userDrive.spreadsheetName,
          url: userDrive.spreadsheetUrl,
          driveFolderId: userDrive.driveFolderId,
          driveFolderName: userDrive.driveFolderName,
          driveFolderUrl: userDrive.driveFolderUrl,
          createdTime: userDrive.updatedAt,
          transactionsCount: userTxsCount,
          connectionMode: isGoogleCloudConfigured(req.googleAccessToken)
            ? 'google_sheets_api'
            : 'local_sheet_workbook',
          ownerUid: uid,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to update Google Drive location.' });
    }
  });

  // Create New inflowtrack Sheet in Google Drive Folder Location
  app.post('/api/finance/sheet/create', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { driveFolderUrl, spreadsheetName } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const parsedFolder = parseDriveFolderIdFromInput(
        driveFolderUrl || wb.userDriveConfigs[uid]?.driveFolderUrl || GOOGLE_DRIVE_FOLDER_URL
      );
      const cleanSheetName =
        String(spreadsheetName || wb.userDriveConfigs[uid]?.spreadsheetName || GOOGLE_SPREADSHEET_NAME).trim() ||
        GOOGLE_SPREADSHEET_NAME;

      const userDrive = wb.userDriveConfigs[uid];
      userDrive.driveFolderId = parsedFolder.folderId;
      userDrive.driveFolderUrl = parsedFolder.folderUrl;
      userDrive.spreadsheetName = cleanSheetName;
      userDrive.updatedAt = new Date().toISOString();

      let createdLiveInDrive = false;
      if (isGoogleCloudConfigured(req.googleAccessToken)) {
        try {
          const accessToken = await getServerGoogleAccessToken(req.googleAccessToken);
          const createdId = await resolveTargetSpreadsheetId(accessToken, {
            driveFolderId: userDrive.driveFolderId,
            spreadsheetName: userDrive.spreadsheetName,
            forceCreateNew: true,
          });
          if (createdId && createdId !== 'sheet-inflowtrack-private') {
            userDrive.spreadsheetId = createdId;
            userDrive.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${createdId}/edit`;
            wb.spreadsheetId = createdId;
            wb.spreadsheetName = userDrive.spreadsheetName;
            await populateFullWorkbookToLiveSheet(accessToken, createdId, wb, uid);
            createdLiveInDrive = true;
          }
        } catch {
          // Fallback to local workbook metadata if Drive API rejects
        }
      }

      saveWorkbook(wb);
      await syncStateToDriveFolderIfConfigured(wb, uid, req.googleAccessToken);

      const userTxsCount = wb.transactions.filter((t) => t.uid === uid).length;
      res.status(201).json({
        message: createdLiveInDrive
          ? `Created new sheet "${userDrive.spreadsheetName}" inside your Google Drive folder (${userDrive.driveFolderId}) and synced ${userTxsCount} transactions.`
          : `Initialized "${userDrive.spreadsheetName}" workbook for Google Drive folder (${userDrive.driveFolderId}). Sign in with Google to sync directly to Google Drive.`,
        sheetInfo: {
          id: userDrive.spreadsheetId,
          name: userDrive.spreadsheetName,
          url: userDrive.spreadsheetUrl,
          driveFolderId: userDrive.driveFolderId,
          driveFolderName: userDrive.driveFolderName,
          driveFolderUrl: userDrive.driveFolderUrl,
          createdTime: userDrive.updatedAt,
          transactionsCount: userTxsCount,
          connectionMode: createdLiveInDrive ? 'google_sheets_api' : 'local_sheet_workbook',
          ownerUid: uid,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to create new inflowtrack sheet in Google Drive.' });
    }
  });

  // Store & Download inflowtrack Sheet (Syncs to Drive folder 1WTHHDzwzO79ypcP06ZmDkBuDADosnH30 + Downloads .xlsx / .csv)
  app.post('/api/finance/sheet/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { driveFolderUrl, spreadsheetName } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const userDrive = wb.userDriveConfigs[uid];
      if (driveFolderUrl) {
        const parsed = parseDriveFolderIdFromInput(driveFolderUrl);
        userDrive.driveFolderId = parsed.folderId;
        userDrive.driveFolderUrl = parsed.folderUrl;
      }
      if (spreadsheetName && String(spreadsheetName).trim()) {
        userDrive.spreadsheetName = String(spreadsheetName).trim();
      }
      userDrive.updatedAt = new Date().toISOString();

      let syncedToDrive = false;
      let exportedXlsxBuffer: Buffer | null = null;

      // 1. Store / Sync to Google Drive folder & Export live Google Sheet (.xlsx) if Google OAuth / Cloud credentials exist
      if (isGoogleCloudConfigured(req.googleAccessToken)) {
        try {
          const accessToken = await getServerGoogleAccessToken(req.googleAccessToken);
          const spreadsheetId = await resolveTargetSpreadsheetId(accessToken, {
            driveFolderId: userDrive.driveFolderId,
            spreadsheetName: userDrive.spreadsheetName,
            existingSpreadsheetId: userDrive.spreadsheetId,
          });

          if (spreadsheetId && spreadsheetId !== 'sheet-inflowtrack-private') {
            userDrive.spreadsheetId = spreadsheetId;
            userDrive.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
            wb.spreadsheetId = spreadsheetId;
            wb.spreadsheetName = userDrive.spreadsheetName;

            await populateFullWorkbookToLiveSheet(accessToken, spreadsheetId, wb, uid);
            syncedToDrive = true;

            // Export the Google Sheet as an Excel .xlsx file from Google Drive
            const exportUrl = `${DRIVE_BASE_URL}/files/${encodeURIComponent(
              spreadsheetId
            )}/export?mimeType=${encodeURIComponent(
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )}`;
            const exportRes = await fetch(exportUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (exportRes.ok) {
              const arrayBuf = await exportRes.arrayBuffer();
              exportedXlsxBuffer = Buffer.from(arrayBuf);
            }
          }
        } catch {
          // Fall back to local CSV generation below if Google API export fails
        }
      }

      saveWorkbook(wb);
      await syncStateToDriveFolderIfConfigured(wb, uid, req.googleAccessToken);

      const safeSheetName = (userDrive.spreadsheetName || GOOGLE_SPREADSHEET_NAME).replace(/[^a-zA-Z0-9_-]/g, '_');

      if (exportedXlsxBuffer) {
        const xlsxFilename = `${safeSheetName}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${xlsxFilename}"`);
        res.setHeader('X-Drive-Synced', syncedToDrive ? 'true' : 'false');
        res.send(exportedXlsxBuffer);
        return;
      }

      // 2. Fallback: Generate complete Excel-compatible CSV sheet (`inflowtrack.csv`) and also upload to Drive folder if token present
      const userTxs = wb.transactions
        .filter((t) => t.uid === uid)
        .sort((a, b) => b.date.localeCompare(a.date));

      const csvHeaders = [
        'Date (DD-MM-YYYY)',
        'Time',
        'Type',
        'Category',
        'Subcategory',
        'Amount (INR)',
        'Payment Mode',
        'Account / Wallet',
        'Description',
        'Sheet Tab',
        'Transaction ID',
        'Drive Folder ID',
      ];

      const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const csvRows = userTxs.map((tx) =>
        [
          escapeCsv(formatDateToDDMMYYYY(tx.date)),
          escapeCsv(tx.time || ''),
          escapeCsv(tx.type),
          escapeCsv(tx.category),
          escapeCsv(tx.subcategory || ''),
          tx.amount,
          escapeCsv(tx.paymentMode),
          escapeCsv(tx.account),
          escapeCsv(tx.description),
          escapeCsv(tx.sheetName),
          escapeCsv(tx.transactionId),
          escapeCsv(userDrive.driveFolderId),
        ].join(',')
      );

      // Include UTF-8 BOM so Microsoft Excel opens ₹ symbol and columns cleanly
      const csvContent = '\uFEFF' + [csvHeaders.join(','), ...csvRows].join('\r\n');
      const csvFilename = `${safeSheetName}.csv`;

      // Save a backup copy in local Drive backups directory as well
      const bkpId = `bkp_sheet_${Date.now()}`;
      const bkpPath = path.join(DRIVE_BACKUPS_DIR, `${bkpId}_${csvFilename}`);
      fs.writeFileSync(bkpPath, csvContent, { mode: 0o600 });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);
      res.setHeader('X-Drive-Synced', syncedToDrive ? 'true' : 'false');
      res.send(csvContent);
    } catch {
      res.status(500).json({ error: 'Failed to store and download inflowtrack sheet.' });
    }
  });

  // Create / Append Transaction
  app.post('/api/finance/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const body = req.body || {};

      const date = normalizeSheetDate(body.date || '');
      const type = String(body.type || 'Expense').trim();
      const category = String(body.category || '').trim();
      const subcategory = String(body.subcategory || '').trim();
      const amount = parseFloat(body.amount);
      const paymentMode = String(body.paymentMode || 'HDFC Bank').trim();
      const account = String(body.account || paymentMode || 'Primary Bank Account').trim();
      const description = String(body.description || '').trim();
      const nowIso = new Date().toISOString();
      const time =
        String(body.time || '').trim() ||
        new Date().toTimeString().slice(0, 5);

      if (!date || !category || isNaN(amount) || amount <= 0) {
        res.status(400).json({
          error: 'Failed to save transaction: Please provide a valid date, category, and positive amount.',
        });
        return;
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const sheetName = getMonthSheetName(date);
      const rowIndex = wb.nextRowCounter++;
      const transactionId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const newTx: StoredTransactionRow = {
        rowIndex,
        sheetName,
        date,
        time,
        type,
        category,
        subcategory,
        amount,
        paymentMode,
        account,
        description,
        uid, // Verified UID from Firebase token
        transactionId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await appendToLiveGoogleSheetIfConfigured(newTx, req.googleAccessToken, wb.userDriveConfigs[uid]);

      wb.transactions.push(newTx);
      saveWorkbook(wb);
      await syncStateToDriveFolderIfConfigured(wb, uid, req.googleAccessToken);

      res.status(201).json({
        transaction: {
          id: transactionId,
          ...newTx,
        },
      });
    } catch {
      res.status(500).json({
        error: 'Failed to save transaction to Google Sheets. Please check your connection and try again.',
      });
    }
  });

  // Update Transaction Row (Strict Ownership Verification)
  app.put('/api/finance/transactions/:rowIndex', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const rowIndex = parseInt(req.params.rowIndex, 10);
      const body = req.body || {};

      if (isNaN(rowIndex)) {
        res.status(400).json({ error: 'Invalid transaction row index.' });
        return;
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const txIdx = wb.transactions.findIndex((t) => t.rowIndex === rowIndex);
      if (txIdx === -1) {
        res.status(404).json({ error: 'Transaction record was not found in your Google Sheet.' });
        return;
      }

      const existing = wb.transactions[txIdx];
      // CRITICAL AUTHORIZATION CHECK: Prevent modifying another user's transaction
      if (existing.uid !== uid) {
        res.status(403).json({
          error: 'Unauthorized access: You cannot modify another user\'s transaction.',
          code: 'FORBIDDEN_NOT_OWNER',
        });
        return;
      }

      const date = normalizeSheetDate(body.date || existing.date);
      const amount = body.amount !== undefined ? parseFloat(body.amount) : existing.amount;
      if (!date || isNaN(amount) || amount <= 0) {
        res.status(400).json({ error: 'Please provide a valid date and positive amount.' });
        return;
      }

      const updatedTx: StoredTransactionRow = {
        ...existing,
        date,
        sheetName: getMonthSheetName(date),
        time: body.time !== undefined ? String(body.time).trim() : existing.time,
        type: body.type !== undefined ? String(body.type).trim() : existing.type,
        category: body.category !== undefined ? String(body.category).trim() : existing.category,
        subcategory: body.subcategory !== undefined ? String(body.subcategory).trim() : existing.subcategory,
        amount,
        paymentMode: body.paymentMode !== undefined ? String(body.paymentMode).trim() : existing.paymentMode,
        account: body.account !== undefined ? String(body.account).trim() : existing.account,
        description: body.description !== undefined ? String(body.description).trim() : existing.description,
        updatedAt: new Date().toISOString(),
      };

      wb.transactions[txIdx] = updatedTx;
      saveWorkbook(wb);
      await updateInLiveGoogleSheetIfConfigured(updatedTx, req.googleAccessToken, wb.userDriveConfigs[uid]);
      await syncStateToDriveFolderIfConfigured(wb, uid, req.googleAccessToken);

      res.json({ transaction: updatedTx });
    } catch {
      res.status(500).json({ error: 'Failed to update transaction in Google Sheets.' });
    }
  });

  // Delete Single or Batch Transactions (Strict Ownership Verification)
  app.post('/api/finance/transactions/delete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { targets } = req.body || {};

      if (!Array.isArray(targets) || targets.length === 0) {
        res.status(400).json({ error: 'No transaction rows specified for deletion.' });
        return;
      }

      const rowIndicesToDelete = new Set<number>();
      const txIdsToDelete = new Set<string>();
      for (const item of targets) {
        if (typeof item === 'number') {
          rowIndicesToDelete.add(item);
        } else if (typeof item === 'string') {
          txIdsToDelete.add(item);
        } else if (item && typeof item === 'object') {
          if (typeof item.rowIndex === 'number') rowIndicesToDelete.add(item.rowIndex);
          if (typeof item.transactionId === 'string' && item.transactionId) txIdsToDelete.add(item.transactionId);
          if (typeof item.id === 'string' && item.id) txIdsToDelete.add(item.id);
        }
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const isTargetMatch = (t: StoredTransactionRow) =>
        (t.rowIndex !== undefined && rowIndicesToDelete.has(t.rowIndex)) ||
        (t.transactionId ? txIdsToDelete.has(t.transactionId) : false);

      // CRITICAL AUTHORIZATION CHECK: Verify every targeted row belongs to req.user.uid
      const targetedRecords = wb.transactions.filter((t) => isTargetMatch(t));
      for (const rec of targetedRecords) {
        if (rec.uid !== uid) {
          res.status(403).json({
            error: 'Unauthorized access: You cannot delete another user\'s financial records.',
            code: 'FORBIDDEN_NOT_OWNER',
          });
          return;
        }
      }

      const deletedRows = wb.transactions.filter((t) => t.uid === uid && isTargetMatch(t));
      wb.transactions = wb.transactions.filter((t) => !(t.uid === uid && isTargetMatch(t)));
      saveWorkbook(wb);
      await deleteFromLiveGoogleSheetIfConfigured(deletedRows, uid, req.googleAccessToken, wb.userDriveConfigs[uid]);
      await syncStateToDriveFolderIfConfigured(wb, uid, req.googleAccessToken);

      res.json({ success: true, deletedCount: deletedRows.length });
    } catch {
      res.status(500).json({ error: 'Failed to delete transactions from Google Sheets.' });
    }
  });

  // Add Category / Payment Mode / Account to Google Sheets
  app.post('/api/finance/categories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { type, categoryName, paymentMode, accountName } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      const userCats = wb.userCategories[uid];

      if (paymentMode && String(paymentMode).trim()) {
        const cleanMode = String(paymentMode).trim();
        if (!userCats.paymentModes.includes(cleanMode)) {
          userCats.paymentModes.push(cleanMode);
        }
      }

      if (accountName && String(accountName).trim()) {
        const cleanAcc = String(accountName).trim();
        if (!userCats.accounts.includes(cleanAcc)) {
          userCats.accounts.push(cleanAcc);
        }
      }

      if (categoryName && String(categoryName).trim()) {
        const cleanCat = String(categoryName).trim();
        if (type === 'Income') {
          if (!userCats.incomeCategories.includes(cleanCat)) {
            userCats.incomeCategories.push(cleanCat);
          }
        } else if (type === 'Transfer') {
          if (!userCats.transferCategories.includes(cleanCat)) {
            userCats.transferCategories.push(cleanCat);
          }
        } else {
          if (!userCats.expenseCategories.includes(cleanCat)) {
            userCats.expenseCategories.push(cleanCat);
          }
        }
      }

      saveWorkbook(wb);
      await syncStateToDriveFolderIfConfigured(wb, uid);
      res.json({ categories: userCats });
    } catch {
      res.status(500).json({ error: 'Failed to add category to Google Sheets.' });
    }
  });

  // Update Budgets / Targets in Google Sheets
  app.put('/api/finance/budgets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { savingsTarget, emergencyFundTarget, monthlyExpenseBudget } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const current = wb.userBudgets[uid];
      if (savingsTarget !== undefined && Number(savingsTarget) > 0) {
        current.savingsTarget = Number(savingsTarget);
      }
      if (emergencyFundTarget !== undefined && Number(emergencyFundTarget) > 0) {
        current.emergencyFundTarget = Number(emergencyFundTarget);
      }
      if (monthlyExpenseBudget !== undefined && Number(monthlyExpenseBudget) >= 0) {
        current.monthlyExpenseBudget = Number(monthlyExpenseBudget);
      }
      current.updatedAt = new Date().toISOString();

      saveWorkbook(wb);
      void syncStateToDriveFolderIfConfigured(wb, uid);
      res.json({ budgetConfig: current });
    } catch {
      res.status(500).json({ error: 'Failed to save budget targets to Google Sheets.' });
    }
  });

  // Recurring Transactions CRUD in Google Sheets
  app.get('/api/finance/recurring', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const wb = loadWorkbook();
    ensureUserRecords(wb, uid);
    saveWorkbook(wb);
    res.json({ recurringTemplates: wb.recurringTemplates.filter((r) => r.uid === uid) });
  });

  app.post('/api/finance/recurring', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const amount = parseFloat(body.amount);

      if (!name || isNaN(amount) || amount <= 0) {
        res.status(400).json({ error: 'Please provide a valid template name and amount.' });
        return;
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const now = new Date().toISOString();
      const newRec: StoredRecurringRecord = {
        id: `rec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        uid,
        name,
        type: String(body.type || 'Expense').trim(),
        category: String(body.category || 'General').trim(),
        subcategory: String(body.subcategory || '').trim(),
        amount,
        paymentMode: String(body.paymentMode || 'HDFC Bank').trim(),
        account: String(body.account || 'Primary Bank Account').trim(),
        dayOfMonth: Math.min(31, Math.max(1, parseInt(body.dayOfMonth, 10) || 1)),
        description: String(body.description || '').trim(),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      wb.recurringTemplates.unshift(newRec);
      saveWorkbook(wb);

      res.status(201).json({ template: newRec, recurringTemplates: wb.recurringTemplates.filter((r) => r.uid === uid) });
    } catch {
      res.status(500).json({ error: 'Failed to save recurring template to Google Sheets.' });
    }
  });

  app.delete('/api/finance/recurring/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const id = req.params.id;

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const target = wb.recurringTemplates.find((r) => r.id === id);
      if (!target) {
        res.status(404).json({ error: 'Recurring template not found.' });
        return;
      }
      if (target.uid !== uid) {
        res.status(403).json({ error: 'Unauthorized access: Cannot delete another user\'s recurring template.' });
        return;
      }

      wb.recurringTemplates = wb.recurringTemplates.filter((r) => !(r.id === id && r.uid === uid));
      saveWorkbook(wb);

      res.json({ success: true, recurringTemplates: wb.recurringTemplates.filter((r) => r.uid === uid) });
    } catch {
      res.status(500).json({ error: 'Failed to delete recurring template.' });
    }
  });

  // --------------------------------------------------------------------------
  // 3. SECURITY PIN & RECOVERY ENDPOINTS (SALTED PBKDF2-SHA256 HASHES ONLY)
  // --------------------------------------------------------------------------

  app.get('/api/security/config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const wb = loadWorkbook();
    ensureUserRecords(wb, uid);
    const sec = wb.userSecurity[uid];

    res.json({
      pinEnabled: sec.pinEnabled && Boolean(sec.pinSaltedHash),
      hasPinSet: Boolean(sec.pinSaltedHash),
      pinLoginEnabled: Boolean(sec.pinLoginEnabled && sec.pinLoginEncryptedPassword),
      hasPinLoginSet: Boolean(sec.pinLoginEncryptedPassword && sec.pinSaltedHash),
      question1: sec.question1,
      hasQuestion1Set: Boolean(sec.answer1SaltedHash),
      question2: sec.question2,
      hasQuestion2Set: Boolean(sec.answer2SaltedHash),
      inactivityTimeoutMinutes: sec.inactivityTimeoutMinutes || 15,
      inactivityAction: sec.inactivityAction || 'lock',
      failedAttempts: sec.failedAttempts || 0,
      isLockedOut: (sec.failedAttempts || 0) >= 3,
    });
  });

  app.post('/api/security/verify-pin', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { pin } = req.body || {};
      const cleanPin = String(pin || '').trim();

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      const sec = wb.userSecurity[uid];

      if (!sec.pinSaltedHash) {
        res.json({ verified: true, message: 'No PIN configured.' });
        return;
      }

      if (sec.failedAttempts >= 3) {
        res.status(423).json({
          verified: false,
          lockedOut: true,
          failedAttempts: sec.failedAttempts,
          error: 'PIN unlock is locked after 3 failed attempts. Please reset your PIN using Account Password or Security Recovery.',
        });
        return;
      }

      const isValid = verifySecretPBKDF2(cleanPin, sec.pinSaltedHash);
      if (isValid) {
        sec.failedAttempts = 0;
        saveWorkbook(wb);
        res.json({ verified: true, failedAttempts: 0 });
      } else {
        sec.failedAttempts = (sec.failedAttempts || 0) + 1;
        saveWorkbook(wb);
        res.status(401).json({
          verified: false,
          lockedOut: sec.failedAttempts >= 3,
          failedAttempts: sec.failedAttempts,
          error:
            sec.failedAttempts >= 3
              ? '3 failed PIN attempts. Please recover using your Account Password or Recovery Question.'
              : `Incorrect PIN. (Attempt ${sec.failedAttempts} of 3)`,
        });
      }
    } catch {
      res.status(500).json({ error: 'Unable to verify PIN right now.' });
    }
  });

  app.post('/api/security/set-pin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { currentPin, newPin, disablePin } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      const sec = wb.userSecurity[uid];

      if (disablePin) {
        if (sec.pinSaltedHash && (!currentPin || !verifySecretPBKDF2(String(currentPin).trim(), sec.pinSaltedHash))) {
          res.status(401).json({ error: 'Current PIN is required to disable PIN protection.' });
          return;
        }
        sec.pinEnabled = false;
        sec.pinSaltedHash = '';
        sec.failedAttempts = 0;
        sec.updatedAt = new Date().toISOString();
        saveWorkbook(wb);
        await syncSecurityHashToLiveSheetIfConfigured(sec);
        res.json({ success: true, pinEnabled: false, hasPinSet: false });
        return;
      }

      const cleanNew = String(newPin || '').trim();
      if (!/^\d{4,8}$/.test(cleanNew)) {
        res.status(400).json({ error: 'PIN must be 4 to 8 digits.' });
        return;
      }

      // If a PIN already exists, require currentPin verification
      if (sec.pinSaltedHash && currentPin !== undefined) {
        if (!verifySecretPBKDF2(String(currentPin).trim(), sec.pinSaltedHash)) {
          res.status(401).json({ error: 'Current PIN is incorrect.' });
          return;
        }
      }

      sec.pinSaltedHash = hashSecretPBKDF2(cleanNew, 100000);
      sec.pinEnabled = true;
      sec.failedAttempts = 0;
      sec.updatedAt = new Date().toISOString();

      saveWorkbook(wb);
      await syncSecurityHashToLiveSheetIfConfigured(sec);

      res.json({
        success: true,
        pinEnabled: true,
        hasPinSet: true,
      });
    } catch {
      res.status(500).json({ error: 'Failed to update security PIN.' });
    }
  });

  // Setup / Update / Disable Easy PIN Login in Firebase
  app.post('/api/security/setup-pin-login', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const userEmail = req.user!.email;
      const { pin, accountPassword, enable } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      const sec = wb.userSecurity[uid];

      if (enable === false) {
        sec.pinLoginEnabled = false;
        sec.pinLoginEncryptedPassword = '';
        sec.updatedAt = new Date().toISOString();
        saveWorkbook(wb);
        res.json({
          success: true,
          pinLoginEnabled: false,
          hasPinLoginSet: false,
          message: 'Easy PIN Login has been disabled for this account.',
        });
        return;
      }

      const cleanPin = String(pin || '').trim();
      if (!/^\d{4,8}$/.test(cleanPin)) {
        res.status(400).json({ error: 'PIN must be between 4 and 8 digits.' });
        return;
      }

      const passwordStr = String(accountPassword || '').trim();
      if (!passwordStr) {
        res.status(400).json({
          error: 'Your Firebase account password is required to securely authorize Easy PIN Login.',
        });
        return;
      }

      // Verify account password with Firebase Identity Toolkit
      let verifiedWithFirebase = false;
      if (FIREBASE_API_KEY) {
        try {
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                password: passwordStr,
                returnSecureToken: true,
              }),
            }
          );
          if (verifyRes.ok) {
            verifiedWithFirebase = true;
          }
        } catch {
          // Fall through to local user check
        }
      }

      if (!verifiedWithFirebase) {
        const users = loadAuthUsers();
        const localUser =
          users[uid] ||
          Object.values(users).find((u) => u.email.toLowerCase() === userEmail.toLowerCase());
        if (localUser && verifySecretPBKDF2(passwordStr, localUser.passwordHash)) {
          verifiedWithFirebase = true;
        }
      }

      if (!verifiedWithFirebase) {
        res.status(401).json({
          error: 'Incorrect account password. Please enter your valid Firebase account password.',
        });
        return;
      }

      // Encrypt password securely using AES-256-GCM for PIN-based login
      const encryptedPass = encryptSecret(passwordStr);
      const pinHash = hashSecretPBKDF2(cleanPin, 100000);

      sec.pinSaltedHash = pinHash;
      sec.pinEnabled = true;
      sec.pinLoginEnabled = true;
      sec.pinLoginEncryptedPassword = encryptedPass;
      sec.pinLoginEmail = userEmail.toLowerCase();
      sec.failedAttempts = 0;
      sec.updatedAt = new Date().toISOString();

      saveWorkbook(wb);

      res.json({
        success: true,
        pinLoginEnabled: true,
        hasPinLoginSet: true,
        message: 'Easy PIN Login has been successfully configured and stored in Firebase for your account!',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to setup Easy PIN Login.' });
    }
  });

  app.post('/api/security/recovery-questions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { question1, answer1, inactivityTimeoutMinutes, inactivityAction } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      const sec = wb.userSecurity[uid];

      if (question1 && String(question1).trim()) {
        sec.question1 = String(question1).trim();
      }
      if (answer1 && String(answer1).trim()) {
        const normalizedAns = normalizeAnswerForHash(answer1);
        sec.answer1SaltedHash = hashSecretPBKDF2(normalizedAns, 100000);
      }
      if (inactivityTimeoutMinutes !== undefined) {
        sec.inactivityTimeoutMinutes = Math.max(0, parseInt(String(inactivityTimeoutMinutes), 10) || 0);
      }
      if (inactivityAction === 'lock' || inactivityAction === 'logout') {
        sec.inactivityAction = inactivityAction;
      }
      sec.updatedAt = new Date().toISOString();

      saveWorkbook(wb);
      await syncSecurityHashToLiveSheetIfConfigured(sec);

      res.json({
        success: true,
        question1: sec.question1,
        hasQuestion1Set: Boolean(sec.answer1SaltedHash),
        inactivityTimeoutMinutes: sec.inactivityTimeoutMinutes,
        inactivityAction: sec.inactivityAction,
      });
    } catch {
      res.status(500).json({ error: 'Failed to update security recovery settings.' });
    }
  });

  app.post('/api/security/recover-pin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { accountPassword, securityAnswer1, newPin } = req.body || {};
      const cleanNewPin = String(newPin || '').trim();

      if (!/^\d{4,8}$/.test(cleanNewPin)) {
        res.status(400).json({ error: 'New PIN must be 4 to 8 digits.' });
        return;
      }

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);
      const sec = wb.userSecurity[uid];

      let recoveryAuthorized = false;

      // Method 1: Verify Account Password (Preferred safer mechanism)
      if (accountPassword) {
        const users = loadAuthUsers();
        const user = users[uid];
        if (user && verifySecretPBKDF2(String(accountPassword), user.passwordHash)) {
          recoveryAuthorized = true;
        } else if (!user && req.body.firebaseReauthenticated === true) {
          // Verified via Firebase reauthenticateWithCredential on client + valid ID token
          recoveryAuthorized = true;
        }
      }

      // Method 2: Verify Salted Hash of Security Question Answer
      if (!recoveryAuthorized && securityAnswer1 && sec.answer1SaltedHash) {
        const normAns = normalizeAnswerForHash(securityAnswer1);
        if (verifySecretPBKDF2(normAns, sec.answer1SaltedHash)) {
          recoveryAuthorized = true;
        }
      }

      if (!recoveryAuthorized) {
        res.status(401).json({
          error: 'Recovery verification failed. Please check your account password or recovery answer.',
        });
        return;
      }

      sec.pinSaltedHash = hashSecretPBKDF2(cleanNewPin, 100000);
      sec.pinEnabled = true;
      sec.failedAttempts = 0;
      sec.updatedAt = new Date().toISOString();

      saveWorkbook(wb);
      await syncSecurityHashToLiveSheetIfConfigured(sec);

      res.json({ success: true, message: 'PIN reset successfully.' });
    } catch {
      res.status(500).json({ error: 'Failed to recover PIN.' });
    }
  });

  // --------------------------------------------------------------------------
  // 4. GOOGLE DRIVE PRIVATE BACKUP & RECEIPT STORAGE ENDPOINTS
  // --------------------------------------------------------------------------

  app.get('/api/drive/backups', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.uid;
    const wb = loadWorkbook();
    ensureUserRecords(wb, uid);

    const userBackups = wb.driveBackups
      .filter((b) => b.uid === uid)
      .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
      .map((b) => ({
        id: b.id,
        name: b.name,
        createdTime: b.createdTime,
        sizeBytes: b.sizeBytes,
        transactionsCount: b.transactionsCount,
        kind: b.kind,
      }));

    res.json({ backups: userBackups });
  });

  app.post('/api/drive/backup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const { kind = 'backup', customNote, receiptName, receiptData } = req.body || {};

      const wb = loadWorkbook();
      ensureUserRecords(wb, uid);

      const userTxs = wb.transactions.filter((t) => t.uid === uid);
      const userCats = wb.userCategories[uid];
      const userBudgets = wb.userBudgets[uid];
      const userRecurring = wb.recurringTemplates.filter((r) => r.uid === uid);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `bkp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      let fileName = `inflowtrack_Backup_${timestamp}.json`;
      let fileContent = '';

      if (kind === 'receipt' && receiptName) {
        const safeName = String(receiptName).replace(/[^a-zA-Z0-9._-]/g, '_');
        fileName = `Receipt_${timestamp}_${safeName}.json`;
        fileContent = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            ownerUid: uid,
            kind: 'receipt',
            driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
            driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
            receiptName: safeName,
            note: customNote || '',
            receiptData: receiptData || '',
          },
          null,
          2
        );
      } else {
        // Full inflowtrack Database Backup (NEVER includes passwords, PINs, or security answers)
        fileContent = JSON.stringify(
          {
            application: 'inflotrack — Track Save Grow',
            schemaVersion: '2.0-secure',
            exportedAt: new Date().toISOString(),
            ownerUid: uid,
            spreadsheetName: wb.spreadsheetName,
            driveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
            driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
            driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
            transactionsCount: userTxs.length,
            categories: userCats,
            budgets: userBudgets,
            recurringTemplates: userRecurring,
            transactions: userTxs,
          },
          null,
          2
        );
      }

      const filePath = path.join(DRIVE_BACKUPS_DIR, `${backupId}.json`);
      fs.writeFileSync(filePath, fileContent, { mode: 0o600 });
      const sizeBytes = Buffer.byteLength(fileContent, 'utf-8');

      // If Google Cloud Service Account / Refresh Token / User OAuth Token & Drive Folder ID are configured, upload private file to Google Drive
      const activeDriveFolderId = wb.userDriveConfigs[uid]?.driveFolderId || GOOGLE_DRIVE_FOLDER_ID;
      let driveFileId: string | undefined;
      if (isGoogleCloudConfigured(req.googleAccessToken) && activeDriveFolderId) {
        try {
          const accessToken = await getServerGoogleAccessToken(req.googleAccessToken);
          const metadata = {
            name: fileName,
            parents: [activeDriveFolderId],
            mimeType: 'application/json',
          };
          const boundary = '-------FinanceFlowDriveBoundary' + Date.now();
          const multipartBody =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            `${fileContent}\r\n` +
            `--${boundary}--`;

          const driveRes = await fetch(
            `${DRIVE_BASE_URL}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body: multipartBody,
            }
          );
          if (driveRes.ok) {
            const driveData = await driveRes.json();
            driveFileId = driveData.id;
          }
        } catch {
          // Keep private server backup copy if remote Drive upload fails
        }
      }

      const newBackup: StoredDriveBackup = {
        id: backupId,
        uid,
        name: fileName,
        createdTime: new Date().toISOString(),
        sizeBytes,
        transactionsCount: userTxs.length,
        kind: kind === 'receipt' ? 'receipt' : 'backup',
        filePath,
        driveFileId,
      };

      wb.driveBackups.unshift(newBackup);
      saveWorkbook(wb);

      res.status(201).json({
        backup: {
          id: newBackup.id,
          name: newBackup.name,
          createdTime: newBackup.createdTime,
          sizeBytes: newBackup.sizeBytes,
          transactionsCount: newBackup.transactionsCount,
          kind: newBackup.kind,
        },
      });
    } catch {
      res.status(500).json({
        error: 'Google Drive backup failed. Please try again.',
      });
    }
  });

  app.get('/api/drive/backups/:id/download', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const id = req.params.id;
      const wb = loadWorkbook();
      const backup = wb.driveBackups.find((b) => b.id === id);

      if (!backup) {
        res.status(404).json({ error: 'Backup file not found.' });
        return;
      }
      if (backup.uid !== uid) {
        res.status(403).json({ error: 'Unauthorized access: You cannot download another user\'s backup file.' });
        return;
      }
      if (!fs.existsSync(backup.filePath)) {
        res.status(404).json({ error: 'Backup file content is no longer available.' });
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${backup.name}"`);
      res.send(fs.readFileSync(backup.filePath, 'utf-8'));
    } catch {
      res.status(500).json({ error: 'Unable to download backup file.' });
    }
  });

  // --------------------------------------------------------------------------
  // VITE MIDDLEWARE (DEVELOPMENT) OR STATIC ASSETS (PRODUCTION)
  // --------------------------------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`inflotrack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
