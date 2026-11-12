import { shiftMonthLabel } from '../lib/money'

type Props = {
  value: string
  onChange: (next: string) => void
}

function label(ym: string) {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function MonthPicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
        onClick={() => onChange(shiftMonthLabel(value, -1))}
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="min-w-[10rem] text-center text-sm font-medium text-[var(--text)]">{label(value)}</span>
      <button
        type="button"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
        onClick={() => onChange(shiftMonthLabel(value, 1))}
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  )
}
