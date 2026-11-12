export const ACCOUNT_TYPES = ['cash', 'bank', 'credit_card', 'upi', 'demat'] as const;
export const TX_TYPES = ['expense', 'income', 'investment', 'transfer'] as const;
export const ACTIONS = ['buy', 'sell', 'dividend', 'interest'] as const;
export const ASSET_TYPES = [
  'stocks',
  'mutual_funds',
  'sip',
  'fixed_deposit',
  'recurring_deposit',
  'ppf_epf',
  'gold',
  'crypto',
  'real_estate',
  'other',
] as const;
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export const DEFAULT_CATEGORIES: { type: 'expense' | 'income'; name: string; icon: string; color: string }[] = [
  { type: 'expense', name: 'Food', icon: 'utensils', color: '#D4846F' },
  { type: 'expense', name: 'Rent', icon: 'home', color: '#C4A574' },
  { type: 'expense', name: 'Transport', icon: 'car', color: '#5B8DB8' },
  { type: 'expense', name: 'Bills', icon: 'zap', color: '#8F7CC0' },
  { type: 'expense', name: 'Shopping', icon: 'bag', color: '#D4A0B0' },
  { type: 'expense', name: 'Health', icon: 'heart', color: '#6BA58A' },
  { type: 'expense', name: 'Education', icon: 'book', color: '#7FA6CC' },
  { type: 'expense', name: 'Entertainment', icon: 'film', color: '#A596D1' },
  { type: 'expense', name: 'Other', icon: 'more', color: '#8A8478' },
  { type: 'income', name: 'Salary', icon: 'briefcase', color: '#6BA58A' },
  { type: 'income', name: 'Freelance', icon: 'laptop', color: '#5B8DB8' },
  { type: 'income', name: 'Interest', icon: 'percent', color: '#8F7CC0' },
  { type: 'income', name: 'Gifts', icon: 'gift', color: '#D4846F' },
  { type: 'income', name: 'Other', icon: 'more', color: '#8A8478' },
];

export function includesOne(list: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && list.includes(value);
}
