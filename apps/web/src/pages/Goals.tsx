import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Goal = {
  id: string
  name: string
  targetAmount: string
  savedAmount: string
  targetDate: string | null
}

export function Goals() {
  const [rows, setRows] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [targetAmount, setTarget] = useState('')
  const [savedAmount, setSaved] = useState('')
  const [targetDate, setDate] = useState('')
  const [error, setError] = useState('')

  function load() {
    void apiFetch<Goal[]>('/goals').then(setRows).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiFetch('/goals', {
        method: 'POST',
        body: JSON.stringify({
          name,
          targetAmount,
          savedAmount: savedAmount || '0',
          targetDate: targetDate || null,
        }),
      })
      setName('')
      setTarget('')
      setSaved('')
      setDate('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed')
    }
  }

  async function remove(id: string) {
    await apiFetch(`/goals/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Goals</h1>
      <Card>
        <form onSubmit={create} className="flex flex-col gap-3">
          <label className="text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <label className="text-sm">
            Target
            <input value={targetAmount} onChange={(e) => setTarget(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <label className="text-sm">
            Saved so far
            <input value={savedAmount} onChange={(e) => setSaved(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <label className="text-sm">
            Target date
            <input type="date" value={targetDate} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
            Add goal
          </button>
        </form>
      </Card>
      {loading ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => {
            const target = BigInt(g.targetAmount || '0')
            const saved = BigInt(g.savedAmount || '0')
            const ratio = target > 0n ? Number(saved) / Number(target) : 0
            return (
              <li key={g.id}>
                <Card>
                  <GoalHead name={g.name} targetDate={g.targetDate} onRemove={() => void remove(g.id)} />
                  <div className="mb-2 flex justify-between text-sm">
                    <Amount paise={g.savedAmount} type="income" />
                    <Amount paise={g.targetAmount} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                    <div className="h-full rounded-full bg-[var(--income)]" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function GoalHead({ name, targetDate, onRemove }: { name: string; targetDate: string | null; onRemove: () => void }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <p className="font-medium">{name}</p>
        {targetDate ? <p className="text-xs text-[var(--muted)]">By {targetDate}</p> : null}
      </div>
      <button type="button" onClick={onRemove} className="text-sm text-[var(--expense)]">
        Delete
      </button>
    </div>
  )
}
