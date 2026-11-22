import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { isPending } from '../lib/pending'
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
  const isAdmin = true
  const [rows, setRows] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Account | null>(null)
  const [editName, setEditName] = useState('')

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

  async function saveEdit() {
    if (!editing) return
    setError('')
    try {
      const result = await apiFetch(`/accounts/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, type: editing.type, color: editing.color, isArchived: editing.isArchived }),
      })
      setEditing(null)
      if (!isPending(result)) load()
      else setError('Waiting for admin approval')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update')
    }
  }

  async function remove(id: string) {
    setError('')
    try {
      const result = await apiFetch(`/accounts/${id}`, { method: 'DELETE' })
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete')
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
              <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium" style={{ color: a.color }}>
                    {a.name}
                  </p>
                  <p className="text-xs capitalize text-[var(--muted)]">{a.type.replace('_', ' ')}</p>
                </div>
                <Amount paise={a.currentBalance} />
                {isAdmin ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditing(a); setEditName(a.name) }} className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
                        Edit
                      </button>
                      <button type="button" onClick={() => void remove(a.id)} className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]">
                        Delete
                      </button>
                    </div>
                    {editing?.id === a.id ? (
                      <div className="flex gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
                        <button type="button" onClick={() => void saveEdit()} className="min-h-10 rounded-xl bg-[var(--btn)] px-3 text-sm text-[var(--surface)]">
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
      )}
    </div>
  )
}
