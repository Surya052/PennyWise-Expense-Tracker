import { useEffect, useState } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { paiseToRupeeInput, rupeeAmount } from '../lib/money'
import { isPending } from '../lib/pending'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Row = {
  id: string
  type: string
  amount: string
  tags: string[]
  frequency: string
  nextRunDate: string
  note: string
  isActive: boolean
  paymentMethod: string
  accountId: string
  toAccountId: string | null
  categoryId: string | null
  holdingId: string | null
  action: string | null
  units: string
}

export function Recurring() {
  const isAdmin = true
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Row | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [nextRunDate, setNextRunDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void apiFetch<Row[]>('/recurring')
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  async function saveEdit() {
    if (!editing) return
    setError('')
    try {
      const result = await apiFetch(`/recurring/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type: editing.type,
          action: editing.action,
          amount: rupeeAmount(amount),
          units: editing.units || '1',
          note,
          paymentMethod: editing.paymentMethod,
          accountId: editing.accountId,
          toAccountId: editing.toAccountId,
          categoryId: editing.categoryId,
          holdingId: editing.holdingId,
          tags: editing.tags,
          frequency: editing.frequency,
          nextRunDate,
          isActive: editing.isActive,
        }),
      })
      setEditing(null)
      if (isPending(result)) {
        setError('Waiting for admin approval')
        return
      }
      const next = await apiFetch<Row[]>('/recurring')
      setRows(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update')
    }
  }

  async function remove(id: string) {
    setError('')
    try {
      const result = await apiFetch(`/recurring/${id}`, { method: 'DELETE' })
      if (isPending(result)) setError('Waiting for admin approval')
      else setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete')
    }
  }

  async function toggle(row: Row) {
    const result = await apiFetch(`/recurring/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...row, units: row.units || '1', isActive: !row.isActive }),
    })
    if (isPending(result)) {
      setError('Waiting for admin approval')
      return
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)))
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Recurring</h1>
      {loading ? (
        <Skeleton className="h-32" />
      ) : rows.length ? (
        <ul className="flex flex-col gap-2">
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{r.note || r.type}</p>
                  <p className="text-xs capitalize text-[var(--muted)]">
                    {r.frequency} · Next {r.nextRunDate}
                  </p>
                </div>
                <Amount paise={r.amount} type={r.type as 'expense'} showSign />
                <button
                  type="button"
                  onClick={() => void toggle(r)}
                  className={`min-h-10 rounded-full px-3 text-sm ${r.isActive ? 'bg-[var(--income)]/20 text-[var(--income)]' : 'border border-[var(--border)] text-[var(--muted)]'}`}
                >
                  {r.isActive ? 'Active' : 'Paused'}
                </button>
                {isAdmin ? (
                  <div className="flex w-full flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r)
                          setAmount(paiseToRupeeInput(r.amount))
                          setNote(r.note)
                          setNextRunDate(r.nextRunDate.slice(0, 10))
                          setError('')
                        }}
                        className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => void remove(r.id)} className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]">
                        Delete
                      </button>
                    </div>
                    {editing?.id === r.id ? (
                      <div className="flex flex-col gap-2">
                        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" aria-label="Amount in rupees" />
                        <input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
                        <input value={note} onChange={(e) => setNote(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" aria-label="Note" />
                        <button type="button" onClick={() => void saveEdit()} className="min-h-11 rounded-2xl bg-[var(--btn)] text-sm font-semibold text-[var(--surface)]">
                          Save
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)]">No recurring templates yet.</p>
        </Card>
      )}
    </div>
  )
}
