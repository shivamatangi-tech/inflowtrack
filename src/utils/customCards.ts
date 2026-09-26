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

export interface VaultCardItem {
  id: string;
  name: string;
  last4: string;
  prefix4: string;
  expiry: string;
  network: CardNetwork;
  tier: string;
  theme: CardThemeFinish;
  isDefault?: boolean;
}

const STORAGE_KEY = 'inflotrack_custom_cards_v1';

export const DEFAULT_VAULT_CARDS: VaultCardItem[] = [
  {
    id: 'card-vault-primary',
    name: 'inflotrack Sovereign Vault',
    prefix4: '4532',
    last4: '6789',
    expiry: '09/29',
    network: 'VISA',
    tier: 'Infinite',
    theme: 'obsidian',
    isDefault: true,
  },
  {
    id: 'card-hdfc-cc',
    name: 'HDFC Credit Card',
    prefix4: '5412',
    last4: '3904',
    expiry: '11/28',
    network: 'Mastercard',
    tier: 'Signature',
    theme: 'champagne',
    isDefault: true,
  },
  {
    id: 'card-sbi-cc',
    name: 'SBI Credit Card',
    prefix4: '4111',
    last4: '8421',
    expiry: '06/28',
    network: 'VISA',
    tier: 'Platinum',
    theme: 'navy',
    isDefault: true,
  },
  {
    id: 'card-tata-neu',
    name: 'Tata Neu Credit Card',
    prefix4: '6521',
    last4: '7710',
    expiry: '03/29',
    network: 'RuPay',
    tier: 'Select',
    theme: 'espresso',
    isDefault: true,
  },
  {
    id: 'card-amazon-icici',
    name: 'Amazon ICICI',
    prefix4: '4908',
    last4: '1156',
    expiry: '08/28',
    network: 'VISA',
    tier: 'Platinum',
    theme: 'platinum',
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

export function getAllVaultCards(): VaultCardItem[] {
  const custom = getStoredCustomCards();
  return [...DEFAULT_VAULT_CARDS, ...custom];
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
  return [...DEFAULT_VAULT_CARDS, ...updated];
}

export function removeCustomVaultCard(id: string): VaultCardItem[] {
  const existing = getStoredCustomCards();
  const updated = existing.filter((c) => c.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return [...DEFAULT_VAULT_CARDS, ...updated];
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
