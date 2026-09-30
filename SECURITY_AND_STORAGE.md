# inflotrack — Security Architecture & Data Storage Specification

This document details the storage locations, encryption/hashing standards, and authentication mechanisms for user identities, credentials, quick-unlock PINs, and payment card details in **inflotrack (Money In Out Tracker)**.

---

## 1. Storage Location Matrix

| Data Category | Primary Storage Location | Format / Encryption Standard | Plaintext Exposure |
|---|---|---|---|
| **Usernames** | `.data/auth_users.json` (Server Database) & `WorkbookStore.userSecurity[uid].username` | Normalized lowercase alphanumeric string (e.g., `shiva_06`), unique index | Public identifier |
| **Authentication Credentials (Passwords)** | `.data/auth_users.json` (Server Database) & Firebase Authentication | Salted `PBKDF2-HMAC-SHA256` (100,000 iterations, unique 16-byte cryptographically secure random salt per user). Format: `pbkdf2_sha256$100000$salt$hash`. Also encrypted with AES-256-GCM via `SESSION_SECRET` for secure server-side session generation. | **NEVER stored or logged in plain text** |
| **PIN-Related Data (Quick Unlock & Login)** | `.data/financeflow_workbook.json` -> `WorkbookStore.userSecurity[uid].pinSaltedHash` | Salted `PBKDF2-HMAC-SHA256` (100,000 iterations, unique 16-byte salt). Format: `pbkdf2_sha256$100000$salt$hash`. Rate limited: Max 3 failed attempts before lockout. | **NEVER stored or logged in plain text** in Firebase, database, or client storage |
| **Card Information (Card Details)** | `.data/financeflow_workbook.json` -> `WorkbookStore.userCards[uid]` & Private Google Sheet database (`Categories` & metadata) | JSON records strictly isolated by verified user UID (`uid`). Indexed by card ID (e.g., `card-hdfc-debit`). Client offline cache in `localStorage` under `inflotrack_custom_cards_v1` and `inflotrack_card_overrides_v1`. | Scoped strictly to authenticated user session |
| **UPI ID (Back of Card)** | `.data/financeflow_workbook.json` -> `WorkbookStore.userCards[uid][i].upiId` | Associated directly with the specific card ID. Masked on UI when Universal Lock is active; revealed upon PIN unlock. | Scoped to authenticated user session |
| **QR Code Configuration & Payloads** | `.data/financeflow_workbook.json` -> `WorkbookStore.userCards[uid][i].qrCodeData` | Stored as standard NPCI UPI payload (e.g. `upi://pay?pa=...&pn=...&cu=INR`) or custom merchant payload. Rendered dynamically via SVG generator. Masked when locked. | Scoped to authenticated user session |

---

## 2. Authentication & Credential Verification

### Unique Username Architecture
- Users register with a unique, normalized username (3-30 characters: lowercase letters `a-z`, numbers `0-9`, underscores `_`, hyphens `-`).
- The backend checks uniqueness during registration via `GET /api/auth/check-username` and server-side conflict verification.
- Passwords and PINs are **never stored as plain text in Firebase or the database**.

### PBKDF2-HMAC-SHA256 Hashing Standard
- Every PIN and password is mathematically transformed using:
  - Algorithm: `PBKDF2` (Password-Based Key Derivation Function 2)
  - Hash Primitive: `HMAC-SHA256`
  - Iterations: `100,000`
  - Salt: Cryptographically secure 16-byte random buffer (`crypto.randomBytes(16)`)
- Verification uses constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

### Brute-Force Rate Limiting
- Failed PIN attempts are recorded both on the server (`sec.failedAttempts`) and synchronized with client state.
- After 3 consecutive incorrect PIN attempts, PIN unlock is locked (`HTTP 423 Locked`).
- Users must authenticate with their account password or recovery keyword to reset their locked PIN.

---

## 3. Card Management & Protection Policy

### Single "Edit Card" Entry Point
- The entire card section provides **only one dedicated "Edit Card" button** in the card section toolbar (`btn-open-edit-card-modal`), eliminating clutter from redundant edit icons on individual cards.
- **Mandatory PIN Authentication**: Clicking the "Edit Card" button requires entering the user's 4-digit PIN before any options or changes are displayed.
- The entered PIN is validated against the backend `POST /api/security/verify-pin` endpoint.

### Protected Operations in the Edit Card Section
Once authenticated with the user's PIN, the management interface allows:
1. **Editing Card Details**: Name, card type (Debit/Credit), 16-digit card number segments (first 4, middle 8, last 4), expiry date, network, tier, aesthetic theme finish, CVV.
2. **Editing UPI ID**: Modifying the UPI ID printed on the back face of the card (`upiId`).
3. **Adding or Editing QR Code**: Auto-generating NPCI UPI QR code from the UPI ID or configuring a custom QR code payload (`qrCodeData`).
4. **Deleting the Card**: Permanently removing the card, UPI ID, and QR code from the database with double-confirmation dialog protection.
5. **Switching Cards**: Managing any card in the user's vault within the single Edit Card dialog without having to re-authenticate repeatedly.

---

## 4. Database Persistence

All updates are immediately persisted to:
1. **Server Database**: `.data/financeflow_workbook.json` via authenticated endpoints `POST /api/cards`, `PUT /api/cards`, and `DELETE /api/cards/:id`.
2. **Cloud Spreadsheet**: Mirrored to the user's connected private Google Sheet.
3. **Local Cache**: Saved in browser `localStorage` for instant responsive rendering and offline capability.
