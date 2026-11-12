import { BadRequestException } from '@nestjs/common';

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
};

export function fail(message: string): never {
  throw new BadRequestException({ message });
}

export function groupDigits(intStr: string, indian: boolean): string {
  if (intStr.length <= 3) return intStr;
  if (!indian) return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const head = intStr.slice(0, -3);
  const tail = intStr.slice(-3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
}

export function formatPaise(paise: bigint, currency: string = 'INR'): string {
  const code = (CURRENCIES as readonly string[]).includes(currency) ? (currency as CurrencyCode) : 'INR';
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  const grouped = groupDigits(whole.toString(), code === 'INR');
  return `${neg ? '-' : ''}${SYMBOLS[code]}${grouped}.${frac}`;
}

export function formatRs(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}Rs. ${groupDigits(whole.toString(), true)}.${frac}`;
}

export function parsePaise(input: unknown, label = 'Amount'): bigint {
  const s = String(input ?? '').trim().replace(/,/g, '').replace(/^₹/, '').replace(/^Rs\.?\s*/i, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) fail(`${label} is invalid`);
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  const [w, f = ''] = raw.split('.');
  const paise = BigInt(w) * 100n + BigInt((f + '00').slice(0, 2));
  return neg ? -paise : paise;
}

export function parsePositivePaise(input: unknown, label = 'Amount'): bigint {
  const value = parsePaise(input, label);
  if (value <= 0n) fail(`${label} must be greater than zero`);
  return value;
}

export function parseUnitsMicro(input: unknown): bigint {
  const s = String(input ?? '').trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) fail('Units must be a number with up to 6 decimal places');
  const [w, f = ''] = s.split('.');
  const micro = BigInt(w) * 1000000n + BigInt(f.padEnd(6, '0'));
  if (micro <= 0n) fail('Units must be greater than zero');
  return micro;
}

export function formatUnits(micro: bigint | null | undefined): string {
  if (micro == null) return '';
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / 1000000n;
  const frac = (abs % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toString()}${frac ? `.${frac}` : ''}`;
}

export function money(value: bigint): string {
  return value.toString();
}
