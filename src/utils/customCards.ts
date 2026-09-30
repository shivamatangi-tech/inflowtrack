/**
 * ============================================================================
 * File: src/utils/customCards.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Manages interactive Vault & Payment Cards for the swipeable Cards Showcase
 *   and synchronizes custom cards with the Transaction Composer.
 * ============================================================================
 */

export type CardThemeFinish =
  | 'obsidian'
  | 'champagne'
  | 'navy'
  | 'platinum'
  | 'espresso';

export type CardNetwork = 'VISA' | 'Mastercard' | 'RuPay' | 'AMEX';

export type CardType = 'Debit' | 'Credit';

export interface VaultCardItem {
  id: string;
  name: string;
  cardType?: CardType;
  last4: string;
  prefix4: string;
  middleDigits?: string;
  expiry: string;
  network: CardNetwork;
  tier: string;
  theme: CardThemeFinish;
  upiId?: string;
  qrCodeData?: string;
  cvv?: string;
  isDefault?: boolean;
}

export function getCardType(card: VaultCardItem): CardType {
  if (card.cardType) return card.cardType;
  const lower = (card.name || '').toLowerCase();
  if (lower.includes('credit') || lower.includes(' cc') || lower.includes('magnus') || lower.includes('sapphiro')) {
    return 'Credit';
  }
  return 'Debit';
}

const STORAGE_KEY = 'inflotrack_custom_cards_v1';
const OVERRIDES_STORAGE_KEY = 'inflotrack_card_overrides_v1';
const DELETED_CARDS_STORAGE_KEY = 'inflotrack_deleted_card_ids_v1';

export function getDeletedCardIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markCardDeleted(id: string): void {
  try {
    const deleted = getDeletedCardIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(DELETED_CARDS_STORAGE_KEY, JSON.stringify(deleted));
    }
  } catch {
    // Ignore storage errors
  }
}

export const DEFAULT_VAULT_CARDS: VaultCardItem[] = [
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

export function getStoredCustomCards(): VaultCardItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function getCardOverrides(): Record<string, Partial<VaultCardItem>> {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCardOverrides(overrides: Record<string, Partial<VaultCardItem>>): void {
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors
  }
}

export function getAllVaultCards(): VaultCardItem[] {
  const overrides = getCardOverrides();
  const custom = getStoredCustomCards();
  const deletedIds = getDeletedCardIds();

  const baseCards = DEFAULT_VAULT_CARDS
    .filter((c) => !deletedIds.includes(c.id))
    .map((card) => {
      if (overrides[card.id]) {
        return { ...card, ...overrides[card.id] };
      }
      return card;
    });

  const customCards = custom
    .filter((c) => !deletedIds.includes(c.id))
    .map((card) => {
      if (overrides[card.id]) {
        return { ...card, ...overrides[card.id] };
      }
      return card;
    });

  return [...baseCards, ...customCards];
}

export function addCustomVaultCard(
  card: Omit<VaultCardItem, 'id' | 'isDefault'>
): VaultCardItem[] {
  const existing = getStoredCustomCards();
  const newCard: VaultCardItem = {
    ...card,
    id: `custom-card-${Date.now()}`,
    isDefault: false,
  };
  const updated = [...existing, newCard];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return getAllVaultCards();
}

/**
 * Updates card details (name, last4, prefix4, expiry, network, tier, theme, UPI ID, QR code)
 * and saves instantly to local cache and server.
 */
export function updateVaultCard(
  id: string,
  updates: Partial<Omit<VaultCardItem, 'id'>>
): VaultCardItem[] {
  // If in custom cards, update stored item directly
  const custom = getStoredCustomCards();
  const customIndex = custom.findIndex((c) => c.id === id);
  if (customIndex >= 0) {
    const updatedCustom = [...custom];
    updatedCustom[customIndex] = { ...updatedCustom[customIndex], ...updates };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustom));
    } catch {
      // Ignore storage errors
    }
  }

  // Also record in overrides so default cards and custom cards are smoothly preserved
  const overrides = getCardOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...updates };
  saveCardOverrides(overrides);

  return getAllVaultCards();
}

/**
 * Deletes a card from the vault after successful PIN authentication.
 * Removes from custom cards, removes from overrides, and marks deleted.
 */
export function removeCustomVaultCard(id: string): VaultCardItem[] {
  markCardDeleted(id);

  // Remove from custom cards if stored there
  const custom = getStoredCustomCards();
  const filteredCustom = custom.filter((c) => c.id !== id);
  if (filteredCustom.length !== custom.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredCustom));
    } catch {
      // Ignore
    }
  }

  // Remove from overrides
  const overrides = getCardOverrides();
  if (overrides[id]) {
    delete overrides[id];
    saveCardOverrides(overrides);
  }

  return getAllVaultCards();
}

/**
 * Asynchronously synchronizes vault cards with the server-side database.
 */
export async function fetchServerCards(authToken?: string): Promise<VaultCardItem[]> {
  if (!authToken) return getAllVaultCards();
  try {
    const res = await fetch('/api/cards', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return getAllVaultCards();
    const data = await res.json();
    if (Array.isArray(data.cards) && data.cards.length > 0) {
      // Merge server cards into local custom cards / overrides
      const overrides = getCardOverrides();
      data.cards.forEach((c: VaultCardItem) => {
        overrides[c.id] = c;
      });
      saveCardOverrides(overrides);
      return getAllVaultCards();
    }
  } catch {
    // Offline or network error
  }
  return getAllVaultCards();
}

/**
 * Persists a created or updated card to the backend database.
 */
export async function saveCardToServer(
  card: VaultCardItem,
  authToken?: string
): Promise<VaultCardItem[]> {
  // Update locally first for instant snappy response
  const updatedLocal = updateVaultCard(card.id, card);

  if (authToken) {
    try {
      await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ card }),
      });
    } catch {
      // Background retry or offline
    }
  }
  return updatedLocal;
}

/**
 * Permanently deletes a card from the backend database and local cache.
 */
export async function deleteCardFromServer(
  cardId: string,
  authToken?: string
): Promise<VaultCardItem[]> {
  const updatedLocal = removeCustomVaultCard(cardId);

  if (authToken) {
    try {
      await fetch(`/api/cards/${encodeURIComponent(cardId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {
      // Background sync
    }
  }
  return updatedLocal;
}

export function getCardThemeClasses(theme: CardThemeFinish): {
  bg: string;
  text: string;
  subtext: string;
  border: string;
  chip: string;
  label: string;
} {
  switch (theme) {
    case 'champagne':
      return {
        bg: 'bg-gradient-to-br from-[#C5A059] via-[#9E7B3B] to-[#6B5121]',
        text: 'text-[#111110]',
        subtext: 'text-[#111110]/70',
        border: 'border-[#E6C98A]/60',
        chip: 'from-[#F6F5F0] via-[#DFDBD0] to-[#B8B2A6]',
        label: 'Champagne Gold',
      };
    case 'navy':
      return {
        bg: 'bg-gradient-to-br from-[#1E293B] via-[#131C2E] to-[#0B101B]',
        text: 'text-[#F6F5F0]',
        subtext: 'text-[#F6F5F0]/65',
        border: 'border-[#C5A059]/30',
        chip: 'from-[#E5C88D] via-[#C5A059] to-[#947335]',
        label: 'Sovereign Navy',
      };
    case 'platinum':
      return {
        bg: 'bg-gradient-to-br from-[#E5E2DC] via-[#CFCBC2] to-[#B2ADA2]',
        text: 'text-[#141412]',
        subtext: 'text-[#141412]/65',
        border: 'border-white/70',
        chip: 'from-[#323330] via-[#1E1F1D] to-[#111210]',
        label: 'Warm Platinum',
      };
    case 'espresso':
      return {
        bg: 'bg-gradient-to-br from-[#3B2A22] via-[#261B16] to-[#140E0C]',
        text: 'text-[#F6F5F0]',
        subtext: 'text-[#C5A059]/80',
        border: 'border-[#C5A059]/35',
        chip: 'from-[#E5C88D] via-[#C5A059] to-[#947335]',
        label: 'Deep Espresso',
      };
    case 'obsidian':
    default:
      return {
        bg: 'bg-gradient-to-br from-[#2B2B28] via-[#191917] to-[#0E0E0D]',
        text: 'text-[#F6F5F0]',
        subtext: 'text-[#F6F5F0]/65',
        border: 'border-[#C5A059]/35',
        chip: 'from-[#E5C88D] via-[#C5A059] to-[#947335]',
        label: 'Obsidian Black',
      };
  }
}
