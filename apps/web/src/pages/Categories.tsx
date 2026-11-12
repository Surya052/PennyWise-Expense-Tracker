import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Category = {
  id: string
  name: string
  type: string
  color: string
  sortOrder: number
}

export function Categories() {
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [error, setError] = useState('')

  function load() {
    void apiFetch<Category[]>('/categories').then(setRows).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name, type }) })
      setName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save')
    }
  }

  async function reorder(id: string, direction: 'up' | 'down') {
    await apiFetch(`/categories/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) })
    load()
  }

  const expense = rows.filter((c) => c.type === 'expense')
  const income = rows.filter((c) => c.type === 'income')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Categories</h1>
      <Card>
        <form onSubmit={create} className="flex flex-col gap-3">
          <label className="text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`min-h-10 flex-1 rounded-full capitalize ${type === t ? 'bg-[var(--btn)] text-[var(--surface)]' : 'border border-[var(--border)]'}`}
              >
                {t}
              </button>
            ))}
          </div>
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
            Add category
          </button>
        </form>
      </Card>
      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <CategoryList title="Expense" items={expense} onReorder={reorder} />
          <CategoryList title="Income" items={income} onReorder={reorder} />
        </>
      )}
    </div>
  )
}

function CategoryList({
  title,
  items,
  onReorder,
}: {
  title: string
  items: Category[]
  onReorder: (id: string, direction: 'up' | 'down') => void
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((c, index) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span style={{ color: c.color }}>{c.name}</span>
            <ReorderButtons
              disableUp={index === 0}
              disableDown={index === items.length - 1}
              onUp={() => onReorder(c.id, 'up')}
              onDown={() => onReorder(c.id, 'down')}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ReorderButtons({
  disableUp,
  disableDown,
  onUp,
  onDown,
}: {
  disableUp: boolean
  disableDown: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="flex gap-1">
      <button type="button" disabled={disableUp} onClick={onUp} className="min-h-10 min-w-10 rounded-lg border border-[var(--border)] disabled:opacity-30">
        ↑
      </button>
      <button type="button" disabled={disableDown} onClick={onDown} className="min-h-10 min-w-10 rounded-lg border border-[var(--border)] disabled:opacity-30">
        ↓
      </button>
    </div>
  )
}
