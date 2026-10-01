/**
 * ============================================================================
 * File: src/components/QuickAuthCard.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Quick Authentication & Account Profile card for checking verified session
 *   status, managing password credentials, and safely signing out.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  UserCheck,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Shield,
} from 'lucide-react';
import { changeUserPassword } from '../services/firebase';

interface QuickAuthCardProps {
  userEmail?: string | null;
  userName?: string | null;
  userPhoto?: string | null;
  onSignOut?: () => Promise<void>;
}

export const QuickAuthCard: React.FC<QuickAuthCardProps> = ({
  userEmail,
  userName,
  userPhoto,
  onSignOut,
}) => {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await changeUserPassword(currentPassword, newPassword);
      setSuccessMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOutClick = async () => {
    if (!onSignOut) return;
    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'User');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xs transition-colors space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Quick Authentication
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Verified account credentials and session security
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 w-fit">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Session</span>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Account Info Card */}
      <div className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt={displayName}
              className="w-12 h-12 rounded-full border border-[#E5E0D4] dark:border-[#2C2A25] object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110] flex items-center justify-center font-bold text-lg font-display">
              {initial}
            </div>
          )}
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-[#141412] dark:text-[#F6F5F0]">
              {displayName}
            </div>
            <div className="text-xs font-mono text-[#78746B] dark:text-[#9E9B92]">
              {userEmail || 'Active user'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPasswordForm((prev) => !prev)}
            className="min-h-[40px] px-3.5 py-1.5 bg-white dark:bg-[#161614] hover:bg-[#EFECE4] dark:hover:bg-[#201F1B] border border-[#E5E0D4] dark:border-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>{showPasswordForm ? 'Close' : 'Change Password'}</span>
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={handleSignOutClick}
              disabled={isSigningOut}
              className="min-h-[40px] px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSigningOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Change Password Collapsible Form */}
      {showPasswordForm && (
        <form
          onSubmit={handleChangePassword}
          className="p-4 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
              Update Account Password
            </span>
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-[11px] text-[#8E7952] dark:text-[#C5A059] flex items-center gap-1 cursor-pointer font-medium"
            >
              {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showPasswords ? 'Hide' : 'Show'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="auth-current-password"
                className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
              >
                Current Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                id="auth-current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-new-password"
                className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
              >
                New Password (Min 6)
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                id="auth-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full min-h-[40px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-[10px] font-medium uppercase tracking-wider text-[#5E5B52] dark:text-[#A39F95] mb-1"
              >
                Confirm New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                id="auth-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full min-h-[40px] px-3 bg-white dark:bg-[#161614] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[40px] px-4 py-1.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Save New Password</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
