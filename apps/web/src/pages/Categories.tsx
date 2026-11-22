import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { isPending } from '../lib/pending'
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
  const isAdmin = true
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')

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

  async function saveName(row: Category) {
    setError('')
    try {
      const result = await apiFetch(`/categories/${row.id}`, { method: 'PATCH', body: JSON.stringify({ name: editName, type: row.type, color: row.color }) })
      setEditingId('')
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update')
    }
  }

  async function remove(id: string) {
    setError('')
    try {
      const result = await apiFetch(`/categories/${id}`, { method: 'DELETE' })
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete')
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
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <CategoryList
            title="Expense"
            items={expense}
            onReorder={reorder}
            isAdmin={isAdmin}
            editingId={editingId}
            editName={editName}
            onEditName={setEditName}
            onStartEdit={(row) => {
              setEditingId(row.id)
              setEditName(row.name)
            }}
            onSave={saveName}
            onDelete={remove}
          />
          <CategoryList
            title="Income"
            items={income}
            onReorder={reorder}
            isAdmin={isAdmin}
            editingId={editingId}
            editName={editName}
            onEditName={setEditName}
            onStartEdit={(row) => {
              setEditingId(row.id)
              setEditName(row.name)
            }}
            onSave={saveName}
            onDelete={remove}
          />
        </>
      )}
    </div>
  )
}

function CategoryList({
  title,
  items,
  onReorder,
  isAdmin,
  editingId,
  editName,
  onEditName,
  onStartEdit,
  onSave,
  onDelete,
}: {
  title: string
  items: Category[]
  onReorder: (id: string, direction: 'up' | 'down') => void
  isAdmin: boolean
  editingId: string
  editName: string
  onEditName: (value: string) => void
  onStartEdit: (row: Category) => void
  onSave: (row: Category) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((c, index) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
            {editingId === c.id ? (
              <input value={editName} onChange={(e) => onEditName(e.target.value)} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
            ) : (
              <span style={{ color: c.color }}>{c.name}</span>
            )}
            {isAdmin ? (
              <div className="flex gap-2">
                {editingId === c.id ? (
                  <button type="button" onClick={() => onSave(c)} className="min-h-10 rounded-xl bg-[var(--btn)] px-3 text-sm text-[var(--surface)]">
                    Save
                  </button>
                ) : (
                  <button type="button" onClick={() => onStartEdit(c)} className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
                    Edit
                  </button>
                )}
                <button type="button" onClick={() => onDelete(c.id)} className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]">
                  Delete
                </button>
              </div>
            ) : null}
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
