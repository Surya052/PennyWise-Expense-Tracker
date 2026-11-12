const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const

type CurrencyCode = (typeof CURRENCIES)[number]

const SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
}

function groupDigits(intStr: string, indian: boolean): string {
  if (intStr.length <= 3) return intStr
  if (!indian) return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const head = intStr.slice(0, -3)
  const tail = intStr.slice(-3)
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`
}

export function formatPaise(paise: string, currency = 'INR'): string {
  const code = (CURRENCIES as readonly string[]).includes(currency) ? (currency as CurrencyCode) : 'INR'
  let value = BigInt(paise || '0')
  const neg = value < 0n
  if (neg) value = -value
  const whole = value / 100n
  const frac = (value % 100n).toString().padStart(2, '0')
  const grouped = groupDigits(whole.toString(), code === 'INR')
  return `${neg ? '-' : ''}${SYMBOLS[code]}${grouped}.${frac}`
}

export function rupeesKeypadToPaise(input: string): string {
  const s = input.trim() || '0'
  const neg = s.startsWith('-')
  const raw = neg ? s.slice(1) : s
  const [w, f = ''] = raw.split('.')
  const paise = BigInt(w || '0') * 100n + BigInt((f + '00').slice(0, 2))
  return (neg ? -paise : paise).toString()
}

export function formatDate(iso: string, pattern: string): string {
  const [y, m, d] = iso.split('-')
  if (pattern === 'MM/DD/YYYY') return `${m}/${d}/${y}`
  if (pattern === 'YYYY-MM-DD') return iso
  return `${d}/${m}/${y}`
}

export function currentMonthLabel(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function shiftMonthLabel(ym: string, delta: number): string {
  const [ys, ms] = ym.split('-')
  const date = new Date(Number(ys), Number(ms) - 1 + delta, 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
