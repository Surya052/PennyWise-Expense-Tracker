import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Account = {
  id: string
  name: string
  type: string
  currentBalance: string
  color: string
  isArchived: boolean
}

export function Accounts() {
  const [rows, setRows] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [error, setError] = useState('')

  function load() {
    void apiFetch<Account[]>('/accounts').then(setRows).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiFetch('/accounts', { method: 'POST', body: JSON.stringify({ name, type, openingBalance: '0' }) })
      setName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Accounts</h1>
      <Card>
        <form onSubmit={create} className="flex flex-col gap-3">
          <label className="text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <label className="text-sm">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3">
              {['cash', 'bank', 'credit_card', 'upi', 'demat'].map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
            Add account
          </button>
        </form>
      </Card>
      {loading ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium" style={{ color: a.color }}>
                    {a.name}
                  </p>
                  <p className="text-xs capitalize text-[var(--muted)]">{a.type.replace('_', ' ')}</p>
                </div>
                <Amount paise={a.currentBalance} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
