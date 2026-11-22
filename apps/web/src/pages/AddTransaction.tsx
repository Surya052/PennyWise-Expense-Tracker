import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { rupeesKeypadToPaise } from '../lib/money'
import { useToast } from '../lib/toast'
import { Card } from '../components/Card'

type Account = { id: string; name: string; isArchived?: boolean }
type Category = { id: string; name: string; type: string; color: string }
type Holding = { id: string; name: string }

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export function AddTransaction() {
  const navigate = useNavigate()
  const toast = useToast()
  const [display, setDisplay] = useState('0')
  const [type, setType] = useState<'expense' | 'income' | 'investment' | 'transfer'>('expense')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [holdingId, setHoldingId] = useState('')
  const [holdingName, setHoldingName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      apiFetch<Account[]>('/accounts'),
      apiFetch<Category[]>('/categories'),
      apiFetch<{ holdings: Holding[] }>('/holdings'),
    ]).then(([a, c, h]) => {
      setAccounts(a.filter((x) => !x.isArchived))
      setCategories(c)
      setHoldings(h.holdings)
      if (a[0]) setAccountId(a[0].id)
      if (h.holdings[0]) setHoldingId(h.holdings[0].id)
    })
  }, [])

  const chips = useMemo(() => {
    const wanted = type === 'transfer' || type === 'investment' ? [] : type === 'income' ? 'income' : 'expense'
    return categories.filter((c) => (wanted ? c.type === wanted : true))
  }, [categories, type])

  function press(key: string) {
    if (key === '⌫') {
      setDisplay((d) => (d.length <= 1 ? '0' : d.slice(0, -1)))
      return
    }
    if (key === '.' && display.includes('.')) return
    setDisplay((d) => (d === '0' && key !== '.' ? key : `${d}${key}`))
  }

  async function save() {
    setError('')
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        type,
        amount: rupeesKeypadToPaise(display),
        date,
        accountId,
        note,
      }
      if (type === 'transfer') body.toAccountId = toAccountId
      if (categoryId && type !== 'transfer') body.categoryId = categoryId
      if (type === 'investment') {
        let id = holdingId
        if (!id) {
          const name = holdingName.trim() || note.trim()
          if (!name) throw new ApiError('Enter a holding name', 400)
          const created = await apiFetch<Holding>('/holdings', {
            method: 'POST',
            body: JSON.stringify({ name, assetType: 'other' }),
          })
          id = created.id
        }
        body.holdingId = id
        body.action = 'buy'
        body.units = '1'
      }
      await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(body) })
      toast.show('Transaction saved')
      navigate('/transactions')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const types = ['expense', 'income', 'investment', 'transfer'] as const

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text)]">Quick add</h1>
        <button type="button" className="min-h-11 text-sm text-[var(--muted)]" onClick={() => navigate(-1)}>
          Close
        </button>
      </div>
      <Card>
        <p className="mb-2 text-center text-3xl font-semibold tabular-nums text-[var(--text)]">₹{display}</p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`min-h-11 rounded-full text-xs capitalize ${
                type === t ? 'bg-[var(--btn)] text-[var(--surface)]' : 'border border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <QuickDates date={date} setDate={setDate} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-lg text-[var(--text)]"
            >
              {k}
            </button>
          ))}
        </div>
      </Card>
      <label className="flex flex-col gap-1 text-sm text-[var(--text)]">
        Account
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {type === 'investment' ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Holding
            <select value={holdingId} onChange={(e) => setHoldingId(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
              <option value="">New holding</option>
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          {holdingId ? null : (
            <label className="flex flex-col gap-1 text-sm">
              Holding name
              <input
                value={holdingName}
                onChange={(e) => setHoldingName(e.target.value)}
                placeholder="Mutual fund, gold, FD"
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </label>
          )}
        </>
      ) : null}
      {type === 'transfer' ? (
        <label className="flex flex-col gap-1 text-sm">
          To account
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
            <option value="">Select</option>
            {accounts.filter((a) => a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {chips.length ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`min-h-11 rounded-full px-3 text-sm ${
                categoryId === c.id ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'border border-[var(--border)] text-[var(--muted)]'
              }`}
              style={categoryId === c.id ? { borderColor: c.color } : undefined}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3" />
      </label>
      {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void save()} className="min-h-12 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
        Save transaction
      </button>
    </div>
  )
}

function QuickDates({ date, setDate }: { date: string; setDate: (v: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-10 rounded-full border border-[var(--border)] px-3 text-xs" onClick={() => setDate(today)}>
        Today
      </button>
      <button type="button" className="min-h-10 rounded-full border border-[var(--border)] px-3 text-xs" onClick={() => setDate(yesterday)}>
        Yesterday
      </button>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-10 rounded-full border border-[var(--border)] bg-transparent px-3 text-xs" />
    </div>
  )
}
