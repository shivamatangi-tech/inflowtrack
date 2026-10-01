/**
 * ============================================================================
 * File: src/components/GoalsView.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Dedicated Goals & Reserves tracking view for monitoring Savings,
 *   Emergency Fund, Lent (Receivables), Borrowed (Payables), and Combined
 *   Capital Preserved progress against user-configured targets.
 *
 * Key Responsibilities:
 *   1. Supports timeframe switching (Month, Year, All-Time) with period
 *      sub-navigators.
 *   2. Masks sensitive reserve amounts and targets with '••••••' until the
 *      user unlocks the session with their 4-digit PIN (if enabled).
 *   3. Displays visual target fulfillment progress bars and a searchable,
 *      filterable Goals Activity Log table with bulk deletion support.
 * ============================================================================
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Search,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckSquare,
  Square,
  MinusSquare,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Wifi,
  CreditCard,
  X,
  Edit3,
  Check,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  QrCode,
  Copy,
  RotateCw,
  Wallet,
  AlertCircle,
  Camera,
  Upload,
  Image as ImageIcon,
  Maximize2,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Transaction,
  TransactionType,
  GoalsTimeframe,
  GoalsStats,
} from '../types';
import {
  calculateGoalsStats,
  filterGoalsTransactions,
  isBorrowedTransaction,
  isLentTransaction,
} from '../utils/calculations';
import {
  formatINR,
  formatDate,
  formatMonthYear,
  getPreviousMonthKey,
  getNextMonthKey,
  getCurrentMonthKey,
  getCurrentYearKey,
} from '../utils/formatters';
import {
  getSavingsTarget,
  getEmergencyFundTarget,
  calculateTargetProgress,
  calculateCombinedCapitalPreservedProgress,
} from '../utils/targets';
import { ConfirmationDialog } from './ConfirmationDialog';
import { UpiQrCodeSvg } from './UpiQrCodeSvg';
import {
  getAllVaultCards,
  addCustomVaultCard,
  updateVaultCard,
  removeCustomVaultCard,
  saveCardToServer,
  deleteCardFromServer,
  fetchServerCards,
  getCardThemeClasses,
  getCardType,
  VaultCardItem,
  CardThemeFinish,
  CardNetwork,
  CardType,
  removeColorNames,
} from '../utils/customCards';
import {
  hasSecurityPinSet,
  verifySecurityPinWithServer,
  updateSecurityPinWithServer,
} from '../utils/security';
import { getFreshAuthToken } from '../services/firebase';

interface GoalsViewProps {
  transactions: Transaction[];
  userName?: string | null;
  overallNetBalance?: number;
  onOpenAddGoal?: (type: TransactionType, category?: string) => void;
  onDeleteTransaction?: (rowIndex: number) => Promise<void>;
  onDeleteTransactionsBatch?: (rowIndices: number[]) => Promise<void>;
  sheetUrl?: string;
  isUnlocked?: boolean;
  onUnlockSuccess?: () => void;
  onLock?: () => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  transactions,
  userName,
  overallNetBalance = 0,
  onOpenAddGoal,
  onDeleteTransaction,
  onDeleteTransactionsBatch,
  isUnlocked = false,
  onUnlockSuccess,
  onLock,
}) => {
  // Timeframe state: 'month' | 'year' | 'alltime'
  const [timeframe, setTimeframe] = useState<GoalsTimeframe>('alltime');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [selectedYear, setSelectedYear] = useState<string>(getCurrentYearKey());

  // Search & Type filter in Goals table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Configurable Target values (read directly from targets utility configured in Settings)
  const savingsTargetVal = getSavingsTarget();
  const emergencyTargetVal = getEmergencyFundTarget();

  // Selected row indices for bulk deletion
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Dialog state for single and bulk deletion
  const [pendingDeleteIndices, setPendingDeleteIndices] = useState<number[] | null>(null);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate stats for current timeframe
  const goalsStats: GoalsStats = useMemo(() => {
    return calculateGoalsStats(transactions, timeframe, selectedMonth, selectedYear);
  }, [transactions, timeframe, selectedMonth, selectedYear]);

  // Target Progress calculations
  const savingsProgress = useMemo(() => {
    return calculateTargetProgress(goalsStats.savings, savingsTargetVal);
  }, [goalsStats.savings, savingsTargetVal]);

  const emergencyProgress = useMemo(() => {
    return calculateTargetProgress(goalsStats.emergencyFund, emergencyTargetVal);
  }, [goalsStats.emergencyFund, emergencyTargetVal]);

  const capitalPreservedProgress = useMemo(() => {
    return calculateCombinedCapitalPreservedProgress(
      goalsStats.savings,
      goalsStats.emergencyFund,
      savingsTargetVal,
      emergencyTargetVal
    );
  }, [goalsStats.savings, goalsStats.emergencyFund, savingsTargetVal, emergencyTargetVal]);

  // Global / local PIN Unlock state
  const [isCardUnlocked, setIsCardUnlocked] = useState<boolean>(Boolean(isUnlocked));

  useEffect(() => {
    setIsCardUnlocked(Boolean(isUnlocked));
  }, [isUnlocked]);

  const isContentUnlocked = Boolean(isUnlocked || isCardUnlocked);

  // Helper for masking amounts when locked
  const displayAmount = (amount: number): string => {
    if (isContentUnlocked) {
      return formatINR(amount);
    }
    return '••••••';
  };

  const displayTarget = (amount: number): string => {
    if (isContentUnlocked) {
      return formatINR(amount);
    }
    return '••••••';
  };

  // Filter transactions for current timeframe and search
  const filteredGoalsTransactions = useMemo(() => {
    const periodTxs = filterGoalsTransactions(transactions, timeframe, selectedMonth, selectedYear);
    return periodTxs.filter((tx) => {
      const matchesType = (() => {
        if (filterType === 'ALL') return true;
        if (filterType === 'Savings') return tx.type === 'Savings';
        if (filterType === 'Emergency Fund') return tx.type === 'Emergency Fund';
        if (filterType === 'Lent') return tx.type === 'Lent' || (tx.type === 'Lent & Borrowed' && isLentTransaction(tx));
        if (filterType === 'Borrowed') return tx.type === 'Borrowed' || (tx.type === 'Lent & Borrowed' && isBorrowedTransaction(tx));
        if (filterType === 'Lent & Borrowed') return tx.type === 'Lent' || tx.type === 'Borrowed' || tx.type === 'Lent & Borrowed';
        return tx.type === filterType;
      })();

      const matchesSearch =
        searchTerm === '' ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.amount.toString().includes(searchTerm) ||
        tx.date.includes(searchTerm);
      return matchesType && matchesSearch;
    });
  }, [transactions, timeframe, selectedMonth, selectedYear, filterType, searchTerm]);

  // Valid row indices in current filtered view
  const currentFilteredIndices = useMemo(() => {
    return filteredGoalsTransactions
      .map((tx) => tx.rowIndex)
      .filter((idx): idx is number => typeof idx === 'number');
  }, [filteredGoalsTransactions]);

  // Check if all visible transactions are selected
  const isAllSelected = useMemo(() => {
    if (currentFilteredIndices.length === 0) return false;
    return currentFilteredIndices.every((idx) => selectedRowIndices.has(idx));
  }, [currentFilteredIndices, selectedRowIndices]);

  const isSomeSelected = useMemo(() => {
    if (isAllSelected) return false;
    return currentFilteredIndices.some((idx) => selectedRowIndices.has(idx));
  }, [currentFilteredIndices, selectedRowIndices, isAllSelected]);

  // Toggle selection for a single transaction
  const handleToggleSelectRow = (rowIndex: number) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  // Toggle Select All
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIndices((prev) => {
        const next = new Set(prev);
        currentFilteredIndices.forEach((idx) => next.delete(idx));
        return next;
      });
    } else {
      setSelectedRowIndices((prev) => {
        const next = new Set(prev);
        currentFilteredIndices.forEach((idx) => next.add(idx));
        return next;
      });
    }
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedRowIndices(new Set());
  };

  // Trigger bulk delete confirmation
  const handleTriggerBulkDelete = () => {
    const indicesToDelete = Array.from(selectedRowIndices);
    if (indicesToDelete.length === 0) return;
    setPendingDeleteIndices(indicesToDelete);
    setPendingDeleteTx(null);
  };

  // Trigger single delete confirmation
  const handleTriggerSingleDelete = (tx: Transaction) => {
    if (!tx.rowIndex) return;
    setPendingDeleteTx(tx);
    setPendingDeleteIndices([tx.rowIndex]);
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => getPreviousMonthKey(prev));
  };
  const handleNextMonth = () => {
    setSelectedMonth((prev) => getNextMonthKey(prev));
  };

  // Year navigation handlers
  const handlePrevYear = () => {
    setSelectedYear((prev) => String(parseInt(prev, 10) - 1));
  };
  const handleNextYear = () => {
    setSelectedYear((prev) => String(parseInt(prev, 10) + 1));
  };

  // Get type visual badge styling matching website's elegant luxury color palette
  const getTypeStyle = (tx: Transaction) => {
    switch (tx.type) {
      case 'Savings':
        return {
          label: 'Savings',
          textColor: 'text-[#8E7952] dark:text-[#C5A059]',
          badgeBg:
            'bg-[#C5A059]/10 text-[#8E7952] dark:text-[#C5A059] border-[#C5A059]/30',
          icon: <PiggyBank className="w-3.5 h-3.5" />,
        };
      case 'Emergency Fund':
        return {
          label: 'Emergency Fund',
          textColor: 'text-[#141412] dark:text-[#F6F5F0]',
          badgeBg:
            'bg-[#F6F5F0] dark:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0] border-[#E5E0D4] dark:border-[#2C2A25]',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        };
      case 'Lent':
        return {
          label: 'Lent',
          textColor: 'text-[#2E6F40] dark:text-emerald-400',
          badgeBg:
            'bg-emerald-500/10 text-[#2E6F40] dark:text-emerald-400 border-emerald-500/25',
          icon: <ArrowUpRight className="w-3.5 h-3.5" />,
        };
      case 'Borrowed':
        return {
          label: 'Borrowed',
          textColor: 'text-[#8E7952] dark:text-[#C5A059]',
          badgeBg:
            'bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] border-[#E5E0D4] dark:border-[#2C2A25]',
          icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
        };
      case 'Lent & Borrowed':
        if (isBorrowedTransaction(tx)) {
          return {
            label: 'Borrowed',
            textColor: 'text-[#8E7952] dark:text-[#C5A059]',
            badgeBg:
              'bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] border-[#E5E0D4] dark:border-[#2C2A25]',
            icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
          };
        }
        return {
          label: 'Lent',
          textColor: 'text-[#2E6F40] dark:text-emerald-400',
          badgeBg:
            'bg-emerald-500/10 text-[#2E6F40] dark:text-emerald-400 border-emerald-500/25',
          icon: <ArrowUpRight className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: tx.type,
          textColor: 'text-[#141412] dark:text-[#F6F5F0]',
          badgeBg:
            'bg-[#F6F5F0] dark:bg-[#22211D] text-[#141412] dark:text-[#F6F5F0] border-[#E5E0D4] dark:border-[#2C2A25]',
          icon: null,
        };
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteIndices || pendingDeleteIndices.length === 0) return;

    setIsDeleting(true);
    try {
      if (onDeleteTransactionsBatch) {
        await onDeleteTransactionsBatch(pendingDeleteIndices);
      } else if (onDeleteTransaction && pendingDeleteIndices.length === 1) {
        await onDeleteTransaction(pendingDeleteIndices[0]);
      } else if (onDeleteTransaction) {
        for (const idx of [...pendingDeleteIndices].sort((a, b) => b - a)) {
          await onDeleteTransaction(idx);
        }
      }

      setSelectedRowIndices((prev) => {
        const next = new Set(prev);
        pendingDeleteIndices.forEach((idx) => next.delete(idx));
        return next;
      });

      setPendingDeleteIndices(null);
      setPendingDeleteTx(null);
    } catch {
      // Error is handled by parent error banner without logging sensitive info to console
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCount = selectedRowIndices.size;
  const cardHolder = (userName || 'INFLOTRACK MEMBER').toUpperCase();

  // Interactive Swipeable Cards state
  const [vaultCards, setVaultCards] = useState<VaultCardItem[]>(() => getAllVaultCards());
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<number>(1);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [cardFilterType, setCardFilterType] = useState<'ALL' | 'Debit' | 'Credit'>('ALL');

  const handleCopyUpi = (upiId: string) => {
    if (!upiId) return;
    navigator.clipboard?.writeText(upiId).catch(() => {});
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // --------------------------------------------------------------------------
  // MANDATORY SECURITY ARCHITECTURE: PIN Authorization for Card Management
  // 1. Single "Edit Card" button for the entire card section.
  // 2. PIN authentication is strictly required before opening the card editor.
  // 3. Authenticated session unlocks options to:
  //    - Edit card details (numbers, bank, expiry, network, tier, finish).
  //    - Edit the UPI ID displayed on the back of the card.
  //    - Add or edit QR code (with live NPCI preview).
  //    - Delete the card (with double confirmation).
  // --------------------------------------------------------------------------
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [newPinConfirm, setNewPinConfirm] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [isSettingUpPin, setIsSettingUpPin] = useState<boolean>(false);
  const [pendingCardToEdit, setPendingCardToEdit] = useState<VaultCardItem | null>(null);
  const [showPinText, setShowPinText] = useState<boolean>(false);

  // Edit Card Form state (PIN verified first; allows editing details, UPI ID, QR code, and deletion)
  const [isEditCardOpen, setIsEditCardOpen] = useState<boolean>(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardType, setEditCardType] = useState<CardType>('Debit');
  const [editCardPrefix4, setEditCardPrefix4] = useState('4532');
  const [editCardMiddleDigits, setEditCardMiddleDigits] = useState('8841 9200');
  const [editCardLast4, setEditCardLast4] = useState('');
  const [editCardExpiry, setEditCardExpiry] = useState('12/29');
  const [editCardNetwork, setEditCardNetwork] = useState<CardNetwork>('VISA');
  const [editCardTier, setEditCardTier] = useState('Signature');
  const [editCardTheme, setEditCardTheme] = useState<CardThemeFinish>('obsidian');
  const [editCardUpi, setEditCardUpi] = useState('');
  const [editCardQrCodeData, setEditCardQrCodeData] = useState('');
  const [editCardQrCodeImageUrl, setEditCardQrCodeImageUrl] = useState('');
  const [editCardCvv, setEditCardCvv] = useState('842');
  const [editCardError, setEditCardError] = useState<string | null>(null);
  const [editCardSuccess, setEditCardSuccess] = useState<string | null>(null);
  const [isDeleteCardConfirmOpen, setIsDeleteCardConfirmOpen] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);

  // QR Photo Gallery & Folder Management state
  const [isQrGalleryModalOpen, setIsQrGalleryModalOpen] = useState<boolean>(false);
  const [qrGalleryFiles, setQrGalleryFiles] = useState<
    Array<{ name: string; filename: string; url: string; sizeBytes: number; updatedAt: string }>
  >([]);
  const [isLoadingQrGallery, setIsLoadingQrGallery] = useState<boolean>(false);
  const [isUploadingQrPhoto, setIsUploadingQrPhoto] = useState<boolean>(false);
  const [qrUploadError, setQrUploadError] = useState<string | null>(null);
  const [qrUploadSuccess, setQrUploadSuccess] = useState<string | null>(null);
  const [targetCardForQrUpload, setTargetCardForQrUpload] = useState<VaultCardItem | null>(null);
  const [isQrEnlargedModalOpen, setIsQrEnlargedModalOpen] = useState<boolean>(false);
  const [qrModalTab, setQrModalTab] = useState<'upload' | 'folder'>('upload');
  const [stagedPhotoPreview, setStagedPhotoPreview] = useState<{ dataUrl: string; name: string } | null>(null);

  const totalCards = vaultCards.length;
  const safeActiveIndex = totalCards > 0 ? ((activeCardIndex % totalCards) + totalCards) % totalCards : 0;
  const activeCard = vaultCards[safeActiveIndex] || vaultCards[0];
  const prevCardIndex = totalCards > 1 ? (safeActiveIndex - 1 + totalCards) % totalCards : 0;
  const nextCardIndex = totalCards > 1 ? (safeActiveIndex + 1) % totalCards : 0;
  const prevCard = vaultCards[prevCardIndex];
  const nextCard = vaultCards[nextCardIndex];

  const handleNextCard = () => {
    if (totalCards <= 1) return;
    setSwipeDirection(1);
    setActiveCardIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrevCard = () => {
    if (totalCards <= 1) return;
    setSwipeDirection(-1);
    setActiveCardIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const handleSelectCardIndex = (idx: number) => {
    if (idx === safeActiveIndex) return;
    setSwipeDirection(idx > safeActiveIndex ? 1 : -1);
    setActiveCardIndex(idx);
  };

  /**
   * Request to edit card details: requires entering PIN before allowing any changes.
   */
  const handleRequestEditCard = (card?: VaultCardItem) => {
    const target = card || activeCard;
    setPendingCardToEdit(target);
    setPinInput('');
    setNewPinConfirm('');
    setPinError(null);
    setIsSettingUpPin(!hasSecurityPinSet());
    setIsPinModalOpen(true);
  };

  /**
   * Request to toggle lock / unlock without immediately editing.
   */
  const handleRequestUnlockOnly = () => {
    if (isContentUnlocked) {
      setIsCardUnlocked(false);
      if (onLock) {
        onLock();
      }
      return;
    }
    setPendingCardToEdit(null);
    setPinInput('');
    setNewPinConfirm('');
    setPinError(null);
    setIsSettingUpPin(!hasSecurityPinSet());
    setIsPinModalOpen(true);
  };

  const handleVerifyOrSetupPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError(null);

    const clean = pinInput.trim();
    if (clean.length !== 4 || !/^\d{4}$/.test(clean)) {
      setPinError('Please enter a valid 4-digit PIN.');
      return;
    }

    setIsVerifyingPin(true);
    try {
      const token = await getFreshAuthToken();
      if (!token) throw new Error('Session expired. Please sign in again.');

      if (isSettingUpPin) {
        if (clean !== newPinConfirm.trim()) {
          setPinError('PIN confirmation does not match.');
          setIsVerifyingPin(false);
          return;
        }
        const setRes = await updateSecurityPinWithServer(token, { newPin: clean });
        if (!setRes.success) {
          setPinError(setRes.error || 'Failed to setup PIN.');
          setIsVerifyingPin(false);
          return;
        }
      } else {
        const verifyRes = await verifySecurityPinWithServer(token, clean);
        if (!verifyRes.verified) {
          // If server says no PIN configured or failed, check if user should set up PIN
          if (verifyRes.error && verifyRes.error.toLowerCase().includes('no pin')) {
            setIsSettingUpPin(true);
            setPinError('No PIN was found. Please confirm this 4-digit PIN to set it.');
            setIsVerifyingPin(false);
            return;
          }
          setPinError(verifyRes.error || 'Incorrect PIN. Please try again.');
          setIsVerifyingPin(false);
          return;
        }
      }

      // PIN Verified Successfully! Full card details are unlocked
      setIsCardUnlocked(true);
      if (onUnlockSuccess) {
        onUnlockSuccess();
      }
      setIsPinModalOpen(false);
      const targetCard = pendingCardToEdit || activeCard;
      setPendingCardToEdit(null);
      setPinInput('');
      setNewPinConfirm('');

      // If user requested to edit card, open edit card modal
      if (targetCard) {
        handleOpenEditCard(targetCard);
      }
    } catch (err: any) {
      setPinError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleStartAddNewCard = () => {
    setEditingCardId('new');
    setEditCardName('');
    setEditCardType('Debit');
    setEditCardPrefix4('4532');
    setEditCardMiddleDigits('8841 9200');
    setEditCardLast4('');
    setEditCardExpiry('12/29');
    setEditCardNetwork('VISA');
    setEditCardTier('Signature');
    setEditCardTheme('obsidian');
    setEditCardUpi('');
    setEditCardQrCodeData('');
    setEditCardQrCodeImageUrl('');
    setEditCardCvv('842');
    setEditCardError(null);
    setEditCardSuccess(null);
    setIsDeleteCardConfirmOpen(false);
  };

  const handleOpenEditCard = (card: VaultCardItem) => {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardType(card.cardType || getCardType(card));
    setEditCardPrefix4(card.prefix4 || '4532');
    setEditCardMiddleDigits(card.middleDigits || '8841 9200');
    setEditCardLast4(card.last4 || '6789');
    setEditCardExpiry(card.expiry || '12/29');
    setEditCardNetwork(card.network || 'VISA');
    setEditCardTier(card.tier || 'Signature');
    setEditCardTheme(card.theme || 'obsidian');
    setEditCardUpi(card.upiId || '');
    setEditCardQrCodeData(card.qrCodeData || '');
    setEditCardQrCodeImageUrl(card.qrCodeImageUrl || '');
    setEditCardCvv(card.cvv || '842');
    setEditCardError(null);
    setEditCardSuccess(null);
    setIsDeleteCardConfirmOpen(false);
    setIsEditCardOpen(true);
  };

  const handleSaveEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditCardError(null);

    if (!editingCardId) return;

    const cleanName = editCardName.trim();
    if (!cleanName) {
      setEditCardError('Please enter a valid card or bank name.');
      return;
    }

    const cleanLast4 = editCardLast4.replace(/\D/g, '').slice(-4).padStart(4, '0');
    const cleanPrefix4 = editCardPrefix4.replace(/\D/g, '').slice(0, 4).padEnd(4, '4');
    const cleanMiddle = editCardMiddleDigits.trim() || '8841 9200';
    const cleanExpiry = editCardExpiry.trim() || '12/29';
    const cleanUpi = editCardUpi.trim();
    const cleanQr = editCardQrCodeData.trim() || (cleanUpi ? `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(cleanName)}&cu=INR` : '');
    const cleanCvv = editCardCvv.replace(/\D/g, '').slice(0, 4) || '842';

    setIsSavingCard(true);
    try {
      const cardId = editingCardId === 'new' ? `custom-card-${Date.now()}` : editingCardId;
      const updatedCard: VaultCardItem = {
        id: cardId,
        name: cleanName,
        cardType: editCardType,
        last4: cleanLast4,
        prefix4: cleanPrefix4,
        middleDigits: cleanMiddle,
        expiry: cleanExpiry,
        network: editCardNetwork,
        tier: editCardTier.trim() || 'Standard',
        theme: editCardTheme,
        upiId: cleanUpi,
        qrCodeData: cleanQr,
        qrCodeImageUrl: editCardQrCodeImageUrl.trim() || undefined,
        cvv: cleanCvv,
      };

      const token = await getFreshAuthToken();
      const updatedList = await saveCardToServer(updatedCard, token || undefined);
      setVaultCards(updatedList);
      setEditingCardId(cardId);
      setEditCardSuccess('Card details, UPI ID, and QR code saved securely to database and Google Sheets!');
      setTimeout(() => {
        setIsEditCardOpen(false);
        setEditCardSuccess(null);
      }, 850);
    } catch (err: any) {
      setEditCardError(err.message || 'Failed to save card changes.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // --------------------------------------------------------------------------
  // QR PHOTO GALLERY & FOLDER UPLOAD LOGIC
  // --------------------------------------------------------------------------
  const handleFetchQrGallery = async () => {
    setIsLoadingQrGallery(true);
    setQrUploadError(null);
    try {
      const res = await fetch('/api/cards/qr-gallery');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files)) {
          setQrGalleryFiles(data.files);
        }
      }
    } catch {
      // Ignore network error
    } finally {
      setIsLoadingQrGallery(false);
    }
  };

  const handleOpenQrGalleryModal = (card?: VaultCardItem) => {
    setTargetCardForQrUpload(card || activeCard);
    setQrUploadError(null);
    setQrUploadSuccess(null);
    setStagedPhotoPreview(null);
    setQrModalTab('upload');
    setIsQrGalleryModalOpen(true);
    handleFetchQrGallery();
  };

  const handleFileChosenForQr = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setQrUploadError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setQrUploadError('Image file size must be under 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setStagedPhotoPreview({
          dataUrl,
          name: file.name,
        });
        setQrUploadError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyStagedOrFolderQr = async (chosenUrl?: string) => {
    setQrUploadError(null);
    const targetCard = targetCardForQrUpload || activeCard;
    if (!targetCard) return;

    setIsUploadingQrPhoto(true);
    try {
      let finalUrl = chosenUrl;

      // If user uploaded a new photo from device, save to server /public/qr-codes/
      if (!finalUrl && stagedPhotoPreview) {
        const token = await getFreshAuthToken();
        const uploadRes = await fetch('/api/cards/upload-qr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            imageData: stagedPhotoPreview.dataUrl,
            fileName: stagedPhotoPreview.name,
          }),
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to upload QR photo.');
        }
        const data = await uploadRes.json();
        finalUrl = data.url;
      }

      if (!finalUrl) {
        setQrUploadError('Please choose or upload a QR photo first.');
        setIsUploadingQrPhoto(false);
        return;
      }

      // If currently editing card in Edit Card Modal, update form state
      if (isEditCardOpen) {
        setEditCardQrCodeImageUrl(finalUrl);
      }

      // Update card in vault and server
      const token = await getFreshAuthToken();
      const updatedCard: VaultCardItem = {
        ...targetCard,
        qrCodeImageUrl: finalUrl,
      };
      const updatedList = await saveCardToServer(updatedCard, token || undefined);
      setVaultCards(updatedList);
      setQrUploadSuccess('QR Code Photo applied to card back successfully!');
      setTimeout(() => {
        setIsQrGalleryModalOpen(false);
        setQrUploadSuccess(null);
        setStagedPhotoPreview(null);
      }, 700);
    } catch (err: any) {
      setQrUploadError(err.message || 'Failed to save QR photo.');
    } finally {
      setIsUploadingQrPhoto(false);
    }
  };

  const handleClearQrPhoto = async () => {
    const targetCard = targetCardForQrUpload || activeCard;
    if (!targetCard) return;

    if (isEditCardOpen) {
      setEditCardQrCodeImageUrl('');
    }

    try {
      const token = await getFreshAuthToken();
      const updatedCard: VaultCardItem = {
        ...targetCard,
        qrCodeImageUrl: undefined,
      };
      const updatedList = await saveCardToServer(updatedCard, token || undefined);
      setVaultCards(updatedList);
      setQrUploadSuccess('Reset to standard generated vector QR code.');
      setTimeout(() => {
        setIsQrGalleryModalOpen(false);
        setQrUploadSuccess(null);
      }, 600);
    } catch (err: any) {
      setQrUploadError(err.message || 'Failed to reset QR code.');
    }
  };

  const handleDeleteCard = async () => {
    if (!editingCardId || editingCardId === 'new') return;
    setIsSavingCard(true);
    setEditCardError(null);
    try {
      const token = await getFreshAuthToken();
      const updatedList = await deleteCardFromServer(editingCardId, token || undefined);
      setVaultCards(updatedList);
      setIsDeleteCardConfirmOpen(false);
      setEditCardSuccess('Card deleted successfully from database and Google Sheets.');
      setTimeout(() => {
        if (updatedList.length > 0) {
          handleOpenEditCard(updatedList[0]);
          setEditCardSuccess(null);
        } else {
          setIsEditCardOpen(false);
          setEditCardSuccess(null);
        }
      }, 750);
    } catch (err: any) {
      setEditCardError(err.message || 'Failed to delete card.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // Separate Debit Cards and Credit Cards for distinct sections in the selector
  const debitCardsList = useMemo(() => {
    return vaultCards
      .map((c, idx) => ({ card: c, indexInVault: idx }))
      .filter(({ card }) => getCardType(card) === 'Debit');
  }, [vaultCards]);

  const creditCardsList = useMemo(() => {
    return vaultCards
      .map((c, idx) => ({ card: c, indexInVault: idx }))
      .filter(({ card }) => getCardType(card) === 'Credit');
  }, [vaultCards]);

  const activeTheme = getCardThemeClasses(activeCard?.theme || 'obsidian');
  const prevTheme = getCardThemeClasses(prevCard?.theme || 'platinum');
  const nextTheme = getCardThemeClasses(nextCard?.theme || 'navy');

  return (
    <div id="goals-view-container" className="space-y-4 sm:space-y-5">
      {/* 0. Interactive Swipeable Cards Section Hero + Linked Payment Cards Overview */}
      <div
        id="cards-section-showcase"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5"
      >
        {/* Left: Interactive Swipeable 3-Card Deck */}
        <div className="lg:col-span-5 bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] flex flex-col items-center justify-between transition-colors shadow-2xs min-w-0 overflow-hidden">
          {/* Card Deck Top Header Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059] truncate">
                Swipe or tap to switch · {safeActiveIndex + 1} of {totalCards}
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
                My Cards & Vault
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                id="btn-show-card-qr"
                onClick={() => setIsQrEnlargedModalOpen(true)}
                title="Display UPI QR code and payment details for this card"
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <QrCode className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                <span>QR Code</span>
              </button>

              <button
                type="button"
                id="btn-toggle-card-lock"
                onClick={handleRequestUnlockOnly}
                title={isContentUnlocked ? 'Lock sensitive card and payment information' : 'Unlock full card details with PIN'}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] text-[#141412] dark:text-[#F6F5F0] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              >
                {isContentUnlocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span className="hidden sm:inline">Lock</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#8E7952] dark:text-[#C5A059] shrink-0" />
                    <span className="hidden sm:inline">Unlock</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-open-edit-card-modal"
                onClick={() => handleRequestEditCard(activeCard)}
                title="Edit and manage all card details, UPI IDs, QR codes, and deletion (PIN Protected)"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span>Edit Card</span>
              </button>
            </div>
          </div>

          {/* Interactive Swipeable & Flippable 3-Card Stack */}
          <div className="relative w-full max-w-[356px] h-[196px] sm:h-[202px] flex items-center justify-center my-1 select-none overflow-hidden">
            {/* Left Peeking Card (Click to switch to Previous Card) */}
            {totalCards > 1 && prevCard && (
              <div
                onClick={handlePrevCard}
                role="button"
                tabIndex={-1}
                aria-label={`Switch to ${prevCard.name}`}
                className={`absolute left-1 sm:left-2 w-[min(62%,206px)] h-[140px] sm:h-[144px] rounded-2xl ${prevTheme.bg} ${prevTheme.text} p-3.5 sm:p-4 flex flex-col justify-between opacity-75 hover:opacity-95 -rotate-4 shadow-sm border ${prevTheme.border} transition-all cursor-pointer`}
              >
                <div className="text-[10px] font-medium truncate opacity-85">
                  {prevCard.name}
                </div>
                <div className="text-[11px] tracking-widest tabular-nums opacity-85">
                  {isContentUnlocked
                    ? `${prevCard.prefix4} •••• •••• ${prevCard.last4}`
                    : `•••• •••• •••• ${prevCard.last4}`}
                </div>
              </div>
            )}

            {/* Right Peeking Card (Click to switch to Next Card) */}
            {totalCards > 1 && nextCard && (
              <div
                onClick={handleNextCard}
                role="button"
                tabIndex={-1}
                aria-label={`Switch to ${nextCard.name}`}
                className={`absolute right-1 sm:right-2 w-[min(62%,206px)] h-[140px] sm:h-[144px] rounded-2xl ${nextTheme.bg} ${nextTheme.text} p-3.5 sm:p-4 flex flex-col justify-between opacity-80 hover:opacity-95 rotate-4 shadow-sm border ${nextTheme.border} transition-all cursor-pointer`}
              >
                <div className="flex justify-end">
                  <Wifi className="w-3.5 h-3.5 opacity-70 rotate-90" />
                </div>
                <div className="text-right text-xs font-bold italic tracking-wider opacity-85">
                  {nextCard.network}
                </div>
              </div>
            )}

            {/* Center Active Card with Direct QR Option */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeCard.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.45}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -40 || info.velocity.x < -280) {
                    handleNextCard();
                  } else if (info.offset.x > 40 || info.velocity.x > 280) {
                    handlePrevCard();
                  }
                }}
                initial={{ opacity: 0, x: swipeDirection * 42, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: swipeDirection * -42, scale: 0.96 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="relative z-10 w-[min(90%,306px)] h-[184px] sm:h-[192px]"
              >
                <div
                  className={`relative w-full h-full rounded-2xl ${activeTheme.bg} ${activeTheme.text} p-4 sm:p-5 flex flex-col justify-between shadow-xl border ${activeTheme.border} overflow-hidden cursor-grab active:cursor-grabbing touch-pan-y`}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/[0.06] blur-xl"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold tracking-tight truncate">
                        ▲ {activeCard.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Direct QR Option Button on Card */}
                      <button
                        type="button"
                        id="btn-card-qr-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsQrEnlargedModalOpen(true);
                        }}
                        title="Display UPI QR code & payment details"
                        className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-[10.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-white shadow-2xs active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>QR Code</span>
                      </button>
                      <Wifi className="w-4 h-4 opacity-80 rotate-90 shrink-0" />
                    </div>
                  </div>

                  {/* Metallic Chip & Card Number */}
                  <div className="space-y-2 my-auto pt-1">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-8 sm:w-9 h-5.5 sm:h-6 rounded-md bg-gradient-to-br ${activeTheme.chip} border border-white/25 opacity-90`}
                      />
                    </div>

                    {/* Masked when locked, Full 16 digits when unlocked */}
                    <div className="text-[12px] sm:text-[14px] tracking-[0.16em] sm:tracking-[0.18em] font-medium tabular-nums truncate">
                      {isContentUnlocked
                        ? `${activeCard.prefix4 || '4532'} ${activeCard.middleDigits || '8841 9200'} ${activeCard.last4}`
                        : `•••• •••• •••• ${activeCard.last4}`}
                    </div>
                  </div>

                  {/* Expiry, Holder & Network Badge */}
                  <div className="flex items-end justify-between gap-2 pt-1">
                    <div className="min-w-0">
                      <div className={`text-[9px] ${activeTheme.subtext} tracking-wider`}>
                        {isContentUnlocked ? `VALID ${activeCard.expiry}` : 'VALID ••/••'}
                      </div>
                      <div className="text-[10px] font-medium tracking-wider truncate max-w-[135px] sm:max-w-[145px] mt-0.5">
                        {cardHolder}
                      </div>
                    </div>
                    <div className="text-right leading-none shrink-0">
                      <div className="text-sm sm:text-base font-bold italic tracking-wider">
                        {activeCard.network}
                      </div>
                      <div className={`text-[8px] ${activeTheme.subtext} tracking-wide mt-0.5`}>
                        {activeCard.tier}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Interactive Pagination Dots */}
          <div className="flex items-center justify-center gap-1.5 my-2">
            {vaultCards.map((c, idx) => {
              const isCurrent = idx === safeActiveIndex;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    handleSelectCardIndex(idx);
                  }}
                  aria-label={`View ${c.name}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    isCurrent
                      ? 'w-6 bg-[#C5A059]'
                      : 'w-2 bg-[#D5D0C5] dark:bg-[#3A3832] hover:bg-[#8E7952]'
                  }`}
                />
              );
            })}
          </div>

          {/* Clean Card Summary Footer Badge (Removed: Available Vault Balance, ₹1,000, 1 recorded entry, Spend, Pay Bill) */}
          <div className="w-full pt-2.5 border-t border-[#EFECE4] dark:border-[#24231F] flex items-center justify-between text-xs text-[#78746B] dark:text-[#9E9B92]">
            <span className="font-medium text-[#141412] dark:text-[#F6F5F0] truncate">
              {activeCard.name}
            </span>
            <span className="text-[11px] font-medium text-[#8E7952] dark:text-[#C5A059] shrink-0">
              {activeCard.network} · {activeCard.tier || getCardType(activeCard)}
            </span>
          </div>
        </div>

        {/* Right: Redesigned Interactive Card Selector with Distinct Debit & Credit Sections (No card details displayed) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#161614] rounded-2xl p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] flex flex-col justify-between transition-colors shadow-2xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#8E7952] dark:text-[#C5A059]">
                Interactive Card Selector
              </p>
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
                Linked Payment Cards & Modes
              </h3>
              <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
                Select any card to display, view QR code, and manage in the card vault
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#8E7952] dark:text-[#C5A059] px-3 py-1.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25]">
                {vaultCards.length} Cards in Deck
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. DISTINCT SECTION: DEBIT CARDS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#8E7952] dark:text-[#C5A059]" />
                  <h4 className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] uppercase tracking-wider">
                    Debit Cards & Vault Accounts
                  </h4>
                </div>
                <span className="text-[11px] font-medium text-[#78746B] dark:text-[#9E9B92]">
                  {debitCardsList.length} {debitCardsList.length === 1 ? 'card' : 'cards'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {debitCardsList.map(({ card, indexInVault }) => {
                  const isFocusedInDeck = indexInVault === safeActiveIndex;
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        handleSelectCardIndex(indexInVault);
                      }}
                      className={`p-3 rounded-xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                        isFocusedInDeck
                          ? 'bg-[#F6F5F0] dark:bg-[#22211D] border-[#C5A059] ring-1 ring-[#C5A059]/40 shadow-2xs'
                          : 'bg-[#F6F5F0]/60 dark:bg-[#1C1C19] border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isFocusedInDeck
                              ? 'bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110]'
                              : 'bg-[#E5E0D4] dark:bg-[#282622] text-[#141412] dark:text-[#F6F5F0]'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] truncate">
                            {card.name}
                          </div>
                          <div className="text-[10px] text-[#78746B] dark:text-[#9E9B92] truncate">
                            {card.network} · Debit
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isFocusedInDeck ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />
                            Active on Deck
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059]">
                            Tap to focus
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. DISTINCT SECTION: CREDIT CARDS */}
            <div>
              <div className="flex items-center justify-between mb-2 pt-2 border-t border-[#EFECE4] dark:border-[#24231F]">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#8E7952] dark:text-[#C5A059]" />
                  <h4 className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] uppercase tracking-wider">
                    Credit Cards
                  </h4>
                </div>
                <span className="text-[11px] font-medium text-[#78746B] dark:text-[#9E9B92]">
                  {creditCardsList.length} {creditCardsList.length === 1 ? 'card' : 'cards'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {creditCardsList.map(({ card, indexInVault }) => {
                  const isFocusedInDeck = indexInVault === safeActiveIndex;
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        handleSelectCardIndex(indexInVault);
                      }}
                      className={`p-3 rounded-xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                        isFocusedInDeck
                          ? 'bg-[#F6F5F0] dark:bg-[#22211D] border-[#C5A059] ring-1 ring-[#C5A059]/40 shadow-2xs'
                          : 'bg-[#F6F5F0]/60 dark:bg-[#1C1C19] border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isFocusedInDeck
                              ? 'bg-[#141412] dark:bg-[#C5A059] text-[#F6F5F0] dark:text-[#111110]'
                              : 'bg-[#E5E0D4] dark:bg-[#282622] text-[#141412] dark:text-[#F6F5F0]'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] truncate">
                            {card.name}
                          </div>
                          <div className="text-[10px] text-[#78746B] dark:text-[#9E9B92] truncate">
                            {card.network} · {card.tier || 'Credit'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isFocusedInDeck ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />
                            Active on Deck
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[#8E7952] dark:text-[#C5A059]">
                            Tap to focus
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Authenticated Card Management Modal (Protected by PIN) */}
      {isEditCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div
            id="edit-vault-card-modal"
            className="bg-white dark:bg-[#161614] rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => {
                setIsEditCardOpen(false);
                setIsDeleteCardConfirmOpen(false);
                setEditCardError(null);
                setEditCardSuccess(null);
              }}
              className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-[#F6F5F0] dark:bg-[#22211D] text-[#78746B] hover:text-[#141412] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30">
                <Unlock className="w-3 h-3" />
                PIN Authenticated
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F6F5F0] dark:bg-[#22211D] text-[#5E5B52] dark:text-[#A39F95] border border-[#E5E0D4] dark:border-[#2C2A25]">
                <ShieldCheck className="w-3 h-3" />
                Database &amp; Google Sheets 2-Way Sync
              </span>
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] mt-1 mb-1 pr-8">
              {editingCardId === 'new' ? 'Add New Vault Card' : 'Manage Vault Card & Credentials'}
            </h3>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mb-4">
              Authenticated with your 4-digit PIN. Modify card numbers, visual finishes, UPI payment IDs, and QR codes, or permanently delete cards from your database.
            </p>

            {/* Single Card Switcher: Select Any Card or Add New */}
            <div className="mb-4 p-3 rounded-xl bg-[#F6F5F0] dark:bg-[#1E1E1B] border border-[#E5E0D4] dark:border-[#2C2A25] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                  Select Card to Manage
                </label>
                <button
                  type="button"
                  onClick={handleStartAddNewCard}
                  className="text-xs font-semibold text-[#8E7952] dark:text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Card</span>
                </button>
              </div>
              <select
                value={editingCardId || ''}
                onChange={(e) => {
                  const targetId = e.target.value;
                  if (targetId === 'new') {
                    handleStartAddNewCard();
                  } else {
                    const found = vaultCards.find((c) => c.id === targetId);
                    if (found) handleOpenEditCard(found);
                  }
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#141412] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
              >
                {editingCardId === 'new' && <option value="new">★ [New Unsaved Card]</option>}
                {vaultCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.network} · {c.cardType || getCardType(c)}) — •••• {c.last4}
                  </option>
                ))}
              </select>
            </div>

            {editCardError && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {editCardError}
              </div>
            )}

            {editCardSuccess && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#C5A059]/50 text-xs text-[#8E7952] dark:text-[#C5A059] flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4" />
                <span>{editCardSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditCard} className="space-y-4">
              {/* 1. Card Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Card / Bank Name
                  </label>
                  <input
                    type="text"
                    value={editCardName}
                    onChange={(e) => setEditCardName(e.target.value)}
                    placeholder="e.g. HDFC Salary Debit, SBI Cashback"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Card Type
                  </label>
                  <select
                    value={editCardType}
                    onChange={(e) => setEditCardType(e.target.value as CardType)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
                  >
                    <option value="Debit">Debit Card</option>
                    <option value="Credit">Credit Card</option>
                  </select>
                </div>
              </div>

              {/* 2. 16-Digit Card Numbers */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    First 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editCardPrefix4}
                    onChange={(e) => setEditCardPrefix4(e.target.value.replace(/\D/g, ''))}
                    placeholder="4532"
                    className="w-full min-h-[42px] px-3 py-2 text-center rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-mono font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Middle 8 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={9}
                    value={editCardMiddleDigits}
                    onChange={(e) => setEditCardMiddleDigits(e.target.value)}
                    placeholder="8841 9200"
                    className="w-full min-h-[42px] px-3 py-2 text-center rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-mono font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editCardLast4}
                    onChange={(e) => setEditCardLast4(e.target.value.replace(/\D/g, ''))}
                    placeholder="6789"
                    className="w-full min-h-[42px] px-3 py-2 text-center rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-mono font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* 3. Expiry, Network, Tier, CVV */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Expiry (MM/YY)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={editCardExpiry}
                    onChange={(e) => setEditCardExpiry(e.target.value)}
                    placeholder="12/29"
                    className="w-full min-h-[42px] px-3 py-2 text-center rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-mono font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Network
                  </label>
                  <select
                    value={editCardNetwork}
                    onChange={(e) => setEditCardNetwork(e.target.value as CardNetwork)}
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
                  >
                    <option value="VISA">VISA</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="RuPay">RuPay</option>
                    <option value="AMEX">AMEX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    Card Tier
                  </label>
                  <input
                    type="text"
                    value={editCardTier}
                    onChange={(e) => setEditCardTier(e.target.value)}
                    placeholder="Signature"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1">
                    CVV
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editCardCvv}
                    onChange={(e) => setEditCardCvv(e.target.value.replace(/\D/g, ''))}
                    placeholder="842"
                    className="w-full min-h-[42px] px-3 py-2 text-center rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-mono font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* 4. Visual Card Theme Finish */}
              <div>
                <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5">
                  Card Theme Finish
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'obsidian', label: 'Obsidian', color: 'bg-[#181816]' },
                    { id: 'champagne', label: 'Champagne', color: 'bg-[#C5A059]' },
                    { id: 'navy', label: 'Navy', color: 'bg-[#1E293B]' },
                    { id: 'platinum', label: 'Platinum', color: 'bg-[#DCD8CF]' },
                    { id: 'espresso', label: 'Espresso', color: 'bg-[#2E1E17]' },
                  ].map((thm) => {
                    const isSelected = editCardTheme === thm.id;
                    return (
                      <button
                        key={thm.id}
                        type="button"
                        onClick={() => setEditCardTheme(thm.id as CardThemeFinish)}
                        className={`p-2 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#C5A059] ring-2 ring-[#C5A059]/40 bg-[#F6F5F0] dark:bg-[#22211D]'
                            : 'border-[#E5E0D4] dark:border-[#282622] hover:border-[#C5A059]/40'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-[#141412] dark:text-[#F6F5F0]">
                          {removeColorNames(thm.label)}
                        </span>
                        <span className={`w-3.5 h-3.5 rounded-full ${thm.color} border border-white/20 shrink-0`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. UPI ID (Displayed on Back of Card) */}
              <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#282622]">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                    UPI Payment ID (Back of Card)
                  </label>
                  <span className="text-[10px] text-[#8E7952] dark:text-[#C5A059] font-medium">
                    Displayed on Card Back
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={editCardUpi}
                    onChange={(e) => setEditCardUpi(e.target.value)}
                    placeholder="e.g. salary.hdfc@upi or name.vault@okaxis"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] text-xs font-mono font-medium text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* 6. Custom QR Code Photo (Rendered Big Size on Back of Card) */}
              <div>
                <label className="block text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] mb-1.5">
                  QR Code Photo
                </label>
                <div className="flex items-center gap-3 p-3 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
                  {editCardQrCodeImageUrl ? (
                    <div className="w-14 h-14 p-1 bg-white rounded-lg border border-[#E5E0D4] dark:border-[#2C2A25] shrink-0 overflow-hidden flex items-center justify-center">
                      <img
                        src={editCardQrCodeImageUrl}
                        alt="Card QR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-[#E5E0D4]/50 dark:bg-[#2C2A25] rounded-lg border border-dashed border-[#C5A059]/40 shrink-0 flex items-center justify-center text-[#8E7952] dark:text-[#C5A059]">
                      <Camera className="w-6 h-6 opacity-60" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenQrGalleryModal()}
                        className="px-3 py-1.5 rounded-lg bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{editCardQrCodeImageUrl ? 'Change QR Photo' : 'Upload QR Photo'}</span>
                      </button>

                      {editCardQrCodeImageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditCardQrCodeImageUrl('')}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] font-semibold hover:bg-rose-100 flex items-center gap-1 transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/60"
                        >
                          <X className="w-3 h-3" />
                          <span>Remove Photo</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                      Upload your payment QR image or select from your photo folder.
                    </p>
                  </div>
                </div>
              </div>

              {/* 7. Delete Card Action (Protected by Authentication & Double Confirmation) */}
              {editingCardId !== 'new' && (
                <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#282622]">
                  {!isDeleteCardConfirmOpen ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] block">
                          Delete Card
                        </span>
                        <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                          Permanently remove this card and its linked UPI/QR code
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDeleteCardConfirmOpen(true)}
                        disabled={vaultCards.length <= 1}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={vaultCards.length <= 1 ? 'At least one card must remain in vault' : 'Delete this card'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Card</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 space-y-2">
                      <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Permanently delete "{editCardName}"?</span>
                      </div>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        This card, its numbers, UPI ID, and QR code will be permanently removed from your database and Google Sheets.
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsDeleteCardConfirmOpen(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:bg-white dark:hover:bg-[#22211D] transition-colors cursor-pointer"
                        >
                          Keep Card
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteCard}
                          disabled={isSavingCard}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isSavingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          <span>Confirm Deletion</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Action Buttons */}
              <div className="pt-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-[#E5E0D4] dark:border-[#282622]">
                <span className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
                  Changes are persisted to database &amp; synced to Google Sheets
                </span>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditCardOpen(false);
                      setIsDeleteCardConfirmOpen(false);
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCard}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{editingCardId === 'new' ? 'Save New Card' : 'Save Card Details'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Verification Modal to Unlock and Edit Card Details */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div
            id="card-pin-auth-modal"
            className="bg-white dark:bg-[#161614] rounded-2xl max-w-sm w-full p-5 sm:p-6 border border-[#E5E0D4] dark:border-[#282622] shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => {
                setIsPinModalOpen(false);
                setPinError(null);
                setPendingCardToEdit(null);
              }}
              className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-[#F6F5F0] dark:bg-[#22211D] text-[#78746B] hover:text-[#141412] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6 text-[#C5A059]" />
            </div>

            <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-[#8E7952] dark:text-[#C5A059]">
              Card Security &amp; Access Control
            </p>
            <h3 className="font-display text-xl font-semibold text-[#141412] dark:text-[#F6F5F0] mt-0.5 mb-1.5">
              {isSettingUpPin ? 'Set 4-Digit Security PIN' : 'Enter PIN to Unlock Card'}
            </h3>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mb-4">
              {isSettingUpPin
                ? 'Create a 4-digit PIN to protect and unlock your card details. Once unlocked with your PIN, you can edit card details freely without entering your account password.'
                : 'Enter your 4-digit security PIN to unlock full card details and edit. No account password is required.'}
            </p>

            {pinError && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {pinError}
              </div>
            )}

            <form onSubmit={handleVerifyOrSetupPin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#5E5B52] dark:text-[#A39F95]">
                    {isSettingUpPin ? 'New 4-Digit PIN' : 'Security PIN (4 Digits)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPinText(!showPinText)}
                    className="text-[11px] text-[#8E7952] dark:text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showPinText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPinText ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPinText ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPinInput(val);
                      setPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full h-12 text-center text-xl tracking-[0.4em] font-mono font-bold bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                    autoFocus
                  />
                </div>
              </div>

              {isSettingUpPin && (
                <div>
                  <label className="block text-xs font-medium text-[#5E5B52] dark:text-[#A39F95] mb-1.5">
                    Confirm 4-Digit PIN
                  </label>
                  <input
                    type={showPinText ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={4}
                    value={newPinConfirm}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setNewPinConfirm(val);
                      setPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full h-12 text-center text-xl tracking-[0.4em] font-mono font-bold bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              )}

              {/* On-screen numeric keypad */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (digit === 'C') {
                        setPinInput('');
                        if (isSettingUpPin) setNewPinConfirm('');
                        setPinError(null);
                      } else if (digit === '⌫') {
                        setPinInput((prev) => prev.slice(0, -1));
                        setPinError(null);
                      } else {
                        if (pinInput.length < 4) {
                          const next = (pinInput + digit).slice(0, 4);
                          setPinInput(next);
                          setPinError(null);
                        } else if (isSettingUpPin && newPinConfirm.length < 4) {
                          setNewPinConfirm((prev) => (prev + digit).slice(0, 4));
                          setPinError(null);
                        }
                      }
                    }}
                    className="h-10 rounded-xl bg-[#F6F5F0] hover:bg-[#EFECE4] dark:bg-[#22211D] dark:hover:bg-[#2C2A25] border border-[#E5E0D4] dark:border-[#2C2A25] text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center justify-center transition-colors cursor-pointer select-none"
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-[#E5E0D4] dark:border-[#282622]">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setPinError(null);
                    setPendingCardToEdit(null);
                  }}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPin || pinInput.length !== 4 || (isSettingUpPin && newPinConfirm.length !== 4)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingPin ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isVerifyingPin
                      ? 'Verifying...'
                      : pendingCardToEdit
                      ? 'Unlock & Edit Card'
                      : 'Unlock Card Details'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Header with Timeframe Switcher & PIN Security Lock */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#141412] dark:text-[#F6F5F0] tracking-tight">
              Goals & Reserves
            </h2>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92]">
              Target progress tracking for savings, emergency fund, lent & borrowed
            </p>
          </div>
        </div>

        {/* Timeframe Selector & Mode Sub-navigators */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 pt-0.5 lg:pt-0 w-full lg:w-auto">
          {/* Mode Segmented Control: Month | Year | All-Time */}
          <div className="grid grid-cols-3 sm:flex bg-[#F0EDE5] dark:bg-[#22211D] p-1 rounded-xl text-xs font-medium w-full sm:w-auto">
            <button
              type="button"
              id="btn-goals-timeframe-month"
              onClick={() => setTimeframe('month')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                timeframe === 'month'
                  ? 'bg-white dark:bg-[#141412] shadow-2xs text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              id="btn-goals-timeframe-year"
              onClick={() => setTimeframe('year')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                timeframe === 'year'
                  ? 'bg-white dark:bg-[#141412] shadow-2xs text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              Year
            </button>
            <button
              type="button"
              id="btn-goals-timeframe-alltime"
              onClick={() => setTimeframe('alltime')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                timeframe === 'alltime'
                  ? 'bg-white dark:bg-[#141412] shadow-2xs text-[#141412] dark:text-[#F6F5F0] font-semibold'
                  : 'text-[#6E6A61] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white'
              }`}
            >
              All-Time
            </button>
          </div>

          {/* Sub-Navigator when in Month mode */}
          {timeframe === 'month' && (
            <div className="flex items-center gap-1 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl px-2 py-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1 text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0] rounded-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] px-2 min-w-[90px] text-center">
                {formatMonthYear(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1 text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0] rounded-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Sub-Navigator when in Year mode */}
          {timeframe === 'year' && (
            <div className="flex items-center gap-1 bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl px-2 py-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevYear}
                title="Previous Year"
                className="p-1 text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0] rounded-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] px-2 min-w-[50px] text-center">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={handleNextYear}
                title="Next Year"
                className="p-1 text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0] rounded-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Summary Metric Cards: Savings Target, Emergency Fund Target, Lent, Borrowed, Capital Preserved */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Savings & Investments Target */}
        <div
          id="card-goals-savings"
          className="bg-white dark:bg-[#161614] p-4 sm:p-5 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col justify-between hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
              Total Savings
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl sm:text-2xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight font-display tabular-nums">
                {displayAmount(goalsStats.savings)}
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30 shrink-0">
                {savingsProgress.percentage}%
              </span>
            </div>

            {/* Target Progress Bar */}
            <div className="w-full h-1.5 bg-[#E5E0D4] dark:bg-[#282622] rounded-full mt-3 overflow-hidden">
              <div
                style={{ width: `${savingsProgress.cappedPercentage}%` }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#78746B] dark:text-[#9E9B92] font-medium">
              <span className="truncate">Target: {isContentUnlocked ? formatINR(savingsTargetVal) : '••••••'}</span>
            </div>
          </div>
        </div>

        {/* 2. Emergency Fund Target */}
        <div
          id="card-goals-emergency"
          className="bg-white dark:bg-[#161614] p-4 sm:p-5 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col justify-between hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
              Emergency Fund
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl sm:text-2xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight font-display tabular-nums">
                {displayAmount(goalsStats.emergencyFund)}
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30 shrink-0">
                {emergencyProgress.percentage}%
              </span>
            </div>

            {/* Target Progress Bar */}
            <div className="w-full h-1.5 bg-[#E5E0D4] dark:bg-[#282622] rounded-full mt-3 overflow-hidden">
              <div
                style={{ width: `${emergencyProgress.cappedPercentage}%` }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#78746B] dark:text-[#9E9B92] font-medium">
              <span className="truncate">Target: {isContentUnlocked ? formatINR(emergencyTargetVal) : '••••••'}</span>
            </div>
          </div>
        </div>

        {/* 3. LENT (Receivables) - Clean, prominent, standalone */}
        <div
          id="card-goals-lent"
          className="bg-white dark:bg-[#161614] p-4 sm:p-5 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col justify-between hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
              Lent (Receivable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="text-xl sm:text-2xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight font-display tabular-nums">
              {displayAmount(goalsStats.lent)}
            </div>

            {/* Visual Accent */}
            <div className="w-full h-1.5 bg-[#E5E0D4] dark:bg-[#282622] rounded-full mt-3 overflow-hidden">
              <div
                style={{ width: goalsStats.lent > 0 ? '100%' : '0%' }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>

            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] font-medium mt-2 truncate">
              Money given to others / to collect
            </p>
          </div>
        </div>

        {/* 4. BORROWED (Payables) - Clean, prominent, standalone */}
        <div
          id="card-goals-borrowed"
          className="bg-white dark:bg-[#161614] p-4 sm:p-5 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col justify-between hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
              Borrowed (Payable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="text-xl sm:text-2xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight font-display tabular-nums">
              {displayAmount(goalsStats.borrowed)}
            </div>

            {/* Visual Accent */}
            <div className="w-full h-1.5 bg-[#E5E0D4] dark:bg-[#282622] rounded-full mt-3 overflow-hidden">
              <div
                style={{ width: goalsStats.borrowed > 0 ? '100%' : '0%' }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>

            <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92] font-medium mt-2 truncate">
              Money taken / to repay
            </p>
          </div>
        </div>

        {/* 5. Total Capital Preserved */}
        <div
          id="card-goals-total-allocated"
          className="col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-1 bg-white dark:bg-[#161614] p-4 sm:p-5 rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs flex flex-col justify-between hover:border-[#C5A059]/60 dark:hover:border-[#C5A059]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#78746B] dark:text-[#9E9B92] uppercase tracking-wider">
              Capital Preserved
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] text-[#8E7952] dark:text-[#C5A059] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl sm:text-2xl font-bold text-[#141412] dark:text-[#F6F5F0] tracking-tight font-display tabular-nums">
                {displayAmount(capitalPreservedProgress.combinedAchieved)}
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#8E7952] dark:text-[#C5A059] border border-[#C5A059]/30 shrink-0">
                {capitalPreservedProgress.percentage}%
              </span>
            </div>

            {/* Combined Target Progress Bar */}
            <div className="w-full h-1.5 bg-[#E5E0D4] dark:bg-[#282622] rounded-full mt-3 overflow-hidden">
              <div
                style={{ width: `${capitalPreservedProgress.cappedPercentage}%` }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#78746B] dark:text-[#9E9B92] font-medium">
              <span className="truncate">Combined: {isContentUnlocked ? formatINR(capitalPreservedProgress.combinedTarget) : '••••••'}</span>
              <span className="text-[10px] font-semibold text-[#8E7952] dark:text-[#C5A059] shrink-0 ml-1">
                Savings + Emergency
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Visual Allocation Ratio & Progress Card */}
      <div className="bg-white dark:bg-[#161614] rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs p-4 sm:p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8E7952] dark:text-[#C5A059]" />
            <h3 className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] uppercase tracking-wider">
              Reserves Growth vs Financial Targets
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-[#141412] dark:text-[#F6F5F0]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059]" />
              Savings: {savingsProgress.percentage}% {isContentUnlocked ? `of ${formatINR(savingsTargetVal)}` : 'of ••••••'}
            </span>
            <span className="flex items-center gap-1.5 text-[#141412] dark:text-[#F6F5F0]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8E7952]" />
              Emergency: {emergencyProgress.percentage}% {isContentUnlocked ? `of ${formatINR(emergencyTargetVal)}` : 'of ••••••'}
            </span>
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Savings bar */}
          <div className="p-3.5 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#141412] dark:text-[#F6F5F0]">Savings Target Fulfillment</span>
              <span className="font-bold text-[#8E7952] dark:text-[#C5A059]">{savingsProgress.percentage}%</span>
            </div>
            <div className="w-full h-2 bg-[#E5E0D4] dark:bg-[#2C2A25] rounded-full overflow-hidden">
              <div
                style={{ width: `${savingsProgress.cappedPercentage}%` }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-2 font-medium">
              <span>{isContentUnlocked ? `${formatINR(goalsStats.savings)} achieved` : '•••••• achieved'}</span>
              <span>{isContentUnlocked ? `${formatINR(savingsProgress.remaining)} remaining` : 'Target: ••••••'}</span>
            </div>
          </div>

          {/* Emergency Fund bar */}
          <div className="p-3.5 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#141412] dark:text-[#F6F5F0]">Emergency Fund Fulfillment</span>
              <span className="font-bold text-[#8E7952] dark:text-[#C5A059]">{emergencyProgress.percentage}%</span>
            </div>
            <div className="w-full h-2 bg-[#E5E0D4] dark:bg-[#2C2A25] rounded-full overflow-hidden">
              <div
                style={{ width: `${emergencyProgress.cappedPercentage}%` }}
                className="bg-[#C5A059] h-full rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-2 font-medium">
              <span>{isContentUnlocked ? `${formatINR(goalsStats.emergencyFund)} achieved` : '•••••• achieved'}</span>
              <span>{isContentUnlocked ? `${formatINR(emergencyProgress.remaining)} remaining` : 'Target: ••••••'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Goals Activity Table & List */}
      <div
        id="goals-activity-card"
        className="bg-white dark:bg-[#161614] rounded-2xl border border-[#E5E0D4] dark:border-[#282622] shadow-2xs overflow-hidden flex flex-col transition-colors"
      >
        {/* Header & Controls */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#EFECE4] dark:border-[#24231F] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#F6F5F0]/60 dark:bg-[#1C1C19]">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] uppercase tracking-wider">
              Goals Activity Log
            </h3>
            <span className="text-[11px] font-medium text-[#78746B] dark:text-[#9E9B92]">
              ({filteredGoalsTransactions.length} entries in{' '}
              {timeframe === 'month'
                ? formatMonthYear(selectedMonth)
                : timeframe === 'year'
                ? selectedYear
                : 'All-Time'}
              )
            </span>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Bulk Delete Selected Button */}
            {selectedCount > 0 && (
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <button
                  type="button"
                  id="btn-goals-delete-selected"
                  onClick={handleTriggerBulkDelete}
                  className="min-h-[40px] py-1.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                  <span>Delete Selected ({selectedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="min-h-[40px] py-1.5 px-2 text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0] transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative flex-1 sm:w-48 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#78746B] dark:text-[#9E9B92] absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                id="goals-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search category, note..."
                className="w-full min-h-[40px] pl-8 pr-3 py-1.5 bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs text-[#141412] dark:text-[#F6F5F0] placeholder-[#78746B] dark:placeholder-[#9E9B92] focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            {/* Type Filter (Supports ALL, Savings, Emergency Fund, Lent, Borrowed) */}
            <select
              id="goals-filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full sm:w-auto min-h-[40px] py-1.5 px-2.5 bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] rounded-xl text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="ALL">All Reserves & Goals</option>
              <option value="Savings">Savings Only</option>
              <option value="Emergency Fund">Emergency Fund Only</option>
              <option value="Lent">Lent (Receivables)</option>
              <option value="Borrowed">Borrowed (Payables)</option>
              <option value="Lent & Borrowed">All Lent & Borrowed</option>
            </select>

            {/* Quick Add Goal Trigger */}
            {onOpenAddGoal && (
              <button
                type="button"
                id="btn-goals-add-entry"
                onClick={() => onOpenAddGoal('Savings')}
                className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Add Goal Entry</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Select All Bar */}
        {filteredGoalsTransactions.length > 0 && (
          <div className="md:hidden px-4 py-2 bg-[#F6F5F0]/80 dark:bg-[#1E1E1B] border-b border-[#EFECE4] dark:border-[#24231F] flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] cursor-pointer">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-[#E5E0D4] dark:border-[#2C2A25] accent-[#C5A059] cursor-pointer"
              />
              <span>Select All ({filteredGoalsTransactions.length})</span>
            </label>

            {selectedCount > 0 && (
              <span className="text-[11px] font-semibold text-[#8E7952] dark:text-[#C5A059]">
                {selectedCount} selected
              </span>
            )}
          </div>
        )}

        {/* Table Content */}
        {filteredGoalsTransactions.length === 0 ? (
          <div
            id="empty-goals-transactions"
            className="py-14 flex flex-col items-center justify-center text-center bg-white dark:bg-[#161614] p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-center text-[#8E7952] dark:text-[#C5A059] mb-3">
              <PiggyBank className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0]">No goals activity found</h4>
            <p className="text-xs text-[#78746B] dark:text-[#9E9B92] mt-1 max-w-sm">
              {timeframe === 'month'
                ? `No savings, emergency fund, or lent/borrowed transactions for ${formatMonthYear(
                    selectedMonth
                  )}.`
                : timeframe === 'year'
                ? `No savings or goals entries recorded for year ${selectedYear}.`
                : 'Start recording your savings, investments, and emergency reserves to track your progress.'}
            </p>
            {onOpenAddGoal && (
              <button
                type="button"
                onClick={() => onOpenAddGoal('Savings')}
                className="mt-4 px-4 py-2.5 bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Savings</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#F6F5F0]/60 dark:bg-[#1C1C19] shadow-2xs">
                  <tr className="text-[#78746B] dark:text-[#9E9B92] uppercase font-semibold text-[10px] tracking-wider border-b border-[#EFECE4] dark:border-[#24231F]">
                    <th className="w-10 px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={isAllSelected ? 'Deselect all' : 'Select all'}
                        className="p-1 text-[#78746B] hover:text-[#C5A059] rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#C5A059]" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-4 h-4 text-[#C5A059]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Description / Note</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                      <th className="px-4 py-3 text-center font-semibold">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4] dark:divide-[#24231F]">
                  {filteredGoalsTransactions.map((tx) => {
                    const style = getTypeStyle(tx);
                    const isSelected = tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

                    return (
                      <tr
                        key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-[#C5A059]/10 dark:bg-[#C5A059]/15'
                            : 'hover:bg-[#F6F5F0]/60 dark:hover:bg-[#22211D]'
                        }`}
                      >
                        <td className="w-10 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (tx.rowIndex !== undefined) {
                                handleToggleSelectRow(tx.rowIndex);
                              }
                            }}
                            className="w-4 h-4 rounded border-[#E5E0D4] dark:border-[#2C2A25] accent-[#C5A059] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-[#78746B] dark:text-[#9E9B92] whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#141412] dark:text-[#F6F5F0]">{tx.category}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${style.badgeBg}`}
                          >
                            {style.icon}
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 italic text-[#78746B] dark:text-[#9E9B92] text-[11px] max-w-xs truncate">
                          {tx.description || <span className="not-italic opacity-40">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-xs text-[#141412] dark:text-[#F6F5F0] whitespace-nowrap font-display tabular-nums">
                          {displayAmount(tx.amount)}
                        </td>
                        {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              title="Delete entry from Google Sheet"
                              onClick={() => handleTriggerSingleDelete(tx)}
                              className="p-1.5 text-[#78746B] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[#EFECE4] dark:divide-[#24231F]">
              {filteredGoalsTransactions.map((tx) => {
                const style = getTypeStyle(tx);
                const isSelected = tx.rowIndex !== undefined && selectedRowIndices.has(tx.rowIndex);

                return (
                  <div
                    key={tx.id || `${tx.date}-${tx.amount}-${tx.rowIndex}`}
                    className={`p-3.5 flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-[#C5A059]/10 dark:bg-[#C5A059]/15'
                        : 'hover:bg-[#F6F5F0]/60 dark:hover:bg-[#22211D]'
                    }`}
                  >
                    <div className="shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (tx.rowIndex !== undefined) {
                            handleToggleSelectRow(tx.rowIndex);
                          }
                        }}
                        className="w-4 h-4 rounded border-[#E5E0D4] dark:border-[#2C2A25] accent-[#C5A059] cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${style.badgeBg}`}
                        >
                          {style.icon}
                          {style.label}
                        </span>
                        <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] truncate">
                          {tx.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#78746B] dark:text-[#9E9B92] mt-1 flex items-center gap-2">
                        <span>{formatDate(tx.date)}</span>
                        {tx.description && (
                          <>
                            <span>•</span>
                            <span className="truncate italic">{tx.description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-sm font-semibold text-[#141412] dark:text-[#F6F5F0] font-display tabular-nums">
                        {displayAmount(tx.amount)}
                      </div>

                      {(onDeleteTransaction || onDeleteTransactionsBatch) && (
                        <button
                          type="button"
                          onClick={() => handleTriggerSingleDelete(tx)}
                          className="p-1.5 text-[#78746B] hover:text-rose-600 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Single / Bulk Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={pendingDeleteIndices !== null && pendingDeleteIndices.length > 0}
        title={
          pendingDeleteIndices && pendingDeleteIndices.length > 1
            ? `Delete ${pendingDeleteIndices.length} Goal Entries?`
            : 'Delete Goal Entry?'
        }
        message={
          pendingDeleteTx
            ? `Are you sure you want to permanently delete the entry "${pendingDeleteTx.category}" of ${formatINR(
                pendingDeleteTx.amount
              )}? This will delete row ${pendingDeleteTx.rowIndex} from your Google Sheet.`
            : `Are you sure you want to permanently delete ${
                pendingDeleteIndices?.length || 0
              } selected entries from your Google Sheet?`
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setPendingDeleteIndices(null);
          setPendingDeleteTx(null);
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* ENLARGED FULL-SCREEN QR CODE MODAL FOR QUICK SCANNING        */}
      {/* ------------------------------------------------------------- */}
      {isQrEnlargedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#161614] rounded-3xl max-w-sm w-full p-6 border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xl relative text-center">
            <button
              type="button"
              onClick={() => setIsQrEnlargedModalOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F6F5F0] dark:bg-[#22211D] text-[#78746B] hover:text-[#141412] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8E7952] dark:text-[#C5A059]">
                Scan &amp; Pay
              </span>
              <h3 className="font-display text-xl font-bold text-[#141412] dark:text-[#F6F5F0] mt-0.5">
                {activeCard.name}
              </h3>
              <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
                Compatible with Google Pay, PhonePe, Paytm &amp; BHIM
              </p>
            </div>

            {/* Giant Centered QR Code Box */}
            <div className="w-64 h-64 sm:w-72 sm:h-72 mx-auto p-4 bg-white rounded-2xl shadow-lg border border-black/10 flex items-center justify-center overflow-hidden mb-4">
              {activeCard.qrCodeImageUrl ? (
                <img
                  src={activeCard.qrCodeImageUrl}
                  alt={`QR code for ${activeCard.name}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <UpiQrCodeSvg
                  upiId={activeCard.qrCodeData || activeCard.upiId || 'inflotrack.vault@okaxis'}
                  name={activeCard.name}
                  className="w-full h-full"
                />
              )}
            </div>

            {/* UPI ID Pill & Copy Button */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] mb-4">
              <div className="min-w-0 text-left">
                <div className="text-[9px] font-semibold text-[#8E7952] dark:text-[#C5A059] uppercase">
                  UPI ID
                </div>
                <div className="text-xs font-mono font-bold text-[#141412] dark:text-[#F6F5F0] truncate">
                  {activeCard.upiId || 'inflotrack.vault@okaxis'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyUpi(activeCard.upiId || 'inflotrack.vault@okaxis')}
                className="px-3 py-1.5 rounded-lg bg-[#141412] dark:bg-[#C5A059] text-white dark:text-[#111110] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedUpi ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy UPI</span>
                  </>
                )}
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E5E0D4] dark:border-[#282622]">
              <button
                type="button"
                onClick={() => {
                  setIsQrEnlargedModalOpen(false);
                  handleOpenQrGalleryModal(activeCard);
                }}
                className="text-xs font-semibold text-[#8E7952] dark:text-[#C5A059] hover:underline flex items-center gap-1.5 cursor-pointer py-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Change QR Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQrEnlargedModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F6F5F0] dark:bg-[#22211D] hover:bg-[#EAE7DC] text-[#141412] dark:text-[#F6F5F0] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* QR PHOTO UPLOAD & PROJECT FOLDER GALLERY MODAL                */}
      {/* ------------------------------------------------------------- */}
      {isQrGalleryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#161614] rounded-3xl max-w-md w-full p-5 sm:p-6 border border-[#E5E0D4] dark:border-[#2C2A25] shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D4] dark:border-[#2C2A25] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#F6F5F0] dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-center text-[#8E7952] dark:text-[#C5A059]">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#141412] dark:text-[#F6F5F0]">
                    Card QR Code Photo
                  </h3>
                  <p className="text-[11px] text-[#78746B] dark:text-[#9E9B92]">
                    Back of {targetCardForQrUpload?.name || activeCard.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsQrGalleryModalOpen(false);
                  setStagedPhotoPreview(null);
                  setQrUploadError(null);
                  setQrUploadSuccess(null);
                }}
                className="w-8 h-8 rounded-full bg-[#F6F5F0] dark:bg-[#22211D] text-[#78746B] hover:text-[#141412] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error / Success Banners */}
            {qrUploadError && (
              <div className="my-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{qrUploadError}</span>
              </div>
            )}
            {qrUploadSuccess && (
              <div className="my-2.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{qrUploadSuccess}</span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 my-3 bg-[#F6F5F0] dark:bg-[#22211D] rounded-xl border border-[#E5E0D4] dark:border-[#2C2A25] shrink-0">
              <button
                type="button"
                onClick={() => setQrModalTab('upload')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  qrModalTab === 'upload'
                    ? 'bg-white dark:bg-[#161614] text-[#141412] dark:text-[#F6F5F0] shadow-xs'
                    : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Upload from Device</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQrModalTab('folder');
                  handleFetchQrGallery();
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  qrModalTab === 'folder'
                    ? 'bg-white dark:bg-[#161614] text-[#141412] dark:text-[#F6F5F0] shadow-xs'
                    : 'text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-[#F6F5F0]'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Project Folder ({qrGalleryFiles.length})</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto pr-0.5 space-y-3">
              {qrModalTab === 'upload' ? (
                <div className="space-y-3">
                  {/* File Dropzone */}
                  <label className="border-2 border-dashed border-[#E5E0D4] dark:border-[#2C2A25] hover:border-[#C5A059] rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#F6F5F0]/50 dark:bg-[#1C1C19]/50 group">
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={handleFileChosenForQr}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#22211D] border border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-center text-[#8E7952] dark:text-[#C5A059] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                      Click or drop your QR code photo
                    </span>
                    <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92] mt-0.5">
                      Supports PNG, JPG, JPEG, SVG, WebP (up to 8MB)
                    </span>
                  </label>

                  {/* Staged Image Preview */}
                  {stagedPhotoPreview ? (
                    <div className="p-3 rounded-2xl bg-[#F6F5F0] dark:bg-[#1E1E1B] border border-[#C5A059]/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                          Selected Photo Preview:
                        </span>
                        <button
                          type="button"
                          onClick={() => setStagedPhotoPreview(null)}
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="w-40 h-40 mx-auto p-2 bg-white rounded-xl shadow-md border border-black/10 flex items-center justify-center overflow-hidden">
                        <img
                          src={stagedPhotoPreview.dataUrl}
                          alt="Staged QR Code"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>

                      <p className="text-[10px] text-center text-[#78746B] dark:text-[#9E9B92]">
                        {stagedPhotoPreview.name}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleApplyStagedOrFolderQr()}
                        disabled={isUploadingQrPhoto}
                        className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#141412] hover:bg-[#262521] dark:bg-[#C5A059] dark:hover:bg-[#D1AF6A] text-[#F6F5F0] dark:text-[#111110] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingQrPhoto ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>Save &amp; Apply to Card Back</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Tab 2: Project Folder Gallery */
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-[#F6F5F0] dark:bg-[#1E1E1B] border border-[#E5E0D4] dark:border-[#2C2A25]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0] flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Folder: /public/qr-codes/</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleFetchQrGallery}
                        disabled={isLoadingQrGallery}
                        className="text-[10px] font-semibold text-[#8E7952] dark:text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Re-scan directory"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingQrGallery ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                      You can drop QR code photos directly into the <code>/public/qr-codes/</code> folder in this project, and they appear here instantly.
                    </p>
                  </div>

                  {isLoadingQrGallery ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#C5A059] mb-2" />
                      <span className="text-xs text-[#78746B] dark:text-[#9E9B92]">
                        Scanning /public/qr-codes/...
                      </span>
                    </div>
                  ) : qrGalleryFiles.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center bg-[#F6F5F0]/50 dark:bg-[#1C1C19]/50 rounded-2xl p-4">
                      <ImageIcon className="w-8 h-8 text-[#78746B] dark:text-[#9E9B92] mb-1.5 opacity-60" />
                      <span className="text-xs font-semibold text-[#141412] dark:text-[#F6F5F0]">
                        No images found in /public/qr-codes/
                      </span>
                      <p className="text-[10px] text-[#78746B] dark:text-[#9E9B92] mt-0.5">
                        Switch to "Upload from Device" tab to upload your QR photo!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {qrGalleryFiles.map((file) => {
                        const isCurrentlyActive =
                          (targetCardForQrUpload?.qrCodeImageUrl || activeCard.qrCodeImageUrl) === file.url;
                        return (
                          <div
                            key={file.filename}
                            onClick={() => handleApplyStagedOrFolderQr(file.url)}
                            className={`p-2.5 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer group ${
                              isCurrentlyActive
                                ? 'border-[#C5A059] ring-2 ring-[#C5A059]/40 bg-[#F6F5F0] dark:bg-[#22211D]'
                                : 'border-[#E5E0D4] dark:border-[#2C2A25] bg-white dark:bg-[#1C1C19] hover:border-[#C5A059]/60'
                            }`}
                          >
                            <div className="w-20 h-20 p-1.5 bg-white rounded-xl shadow-xs border border-black/10 flex items-center justify-center overflow-hidden">
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-[#141412] dark:text-[#F6F5F0] truncate max-w-full">
                              {file.name}
                            </span>
                            <span className="text-[9px] text-[#78746B] dark:text-[#9E9B92]">
                              {(file.sizeBytes / 1024).toFixed(0)} KB
                            </span>
                            <span
                              className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-md ${
                                isCurrentlyActive
                                  ? 'bg-[#C5A059] text-[#111110]'
                                  : 'bg-[#F6F5F0] dark:bg-[#2C2A25] text-[#8E7952] dark:text-[#C5A059] group-hover:bg-[#C5A059] group-hover:text-[#111110]'
                              }`}
                            >
                              {isCurrentlyActive ? 'Active on Card' : 'Apply to Card'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#E5E0D4] dark:border-[#2C2A25] flex items-center justify-between gap-2 shrink-0">
              {(targetCardForQrUpload?.qrCodeImageUrl || activeCard.qrCodeImageUrl) ? (
                <button
                  type="button"
                  onClick={handleClearQrPhoto}
                  className="text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Use Standard Vector QR</span>
                </button>
              ) : (
                <span className="text-[10px] text-[#78746B] dark:text-[#9E9B92]">
                  Using auto-generated vector QR
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsQrGalleryModalOpen(false);
                  setStagedPhotoPreview(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#78746B] dark:text-[#9E9B92] hover:text-[#141412] dark:hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
