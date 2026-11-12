import { formatPaise } from '../lib/money'
import { useAuth } from '../lib/auth'

type Props = {
  paise: string
  type?: 'expense' | 'income' | 'investment' | 'transfer' | 'neutral'
  showSign?: boolean
  className?: string
}

export function Amount({ paise, type = 'neutral', showSign = false, className = '' }: Props) {
  const { user } = useAuth()
  const currency = user?.currency ?? 'INR'
  const formatted = formatPaise(paise, currency)
  let sign = ''
  if (showSign && type === 'income') sign = '+'
  if (showSign && type === 'expense') sign = '−'
  if (showSign && type === 'investment') sign = '→'
  const tone =
    type === 'income'
      ? 'text-[var(--income)]'
      : type === 'expense'
        ? 'text-[var(--expense)]'
        : type === 'investment'
          ? 'text-[var(--invest)]'
          : 'text-[var(--text)]'
  return (
    <span className={`tabular-nums font-medium ${tone} ${className}`}>
      {sign}
      {formatted}
    </span>
  )
}
