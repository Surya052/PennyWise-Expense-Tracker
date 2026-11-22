import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { currentMonthLabel, paiseToRupeeInput } from '../lib/money'
import { isPending } from '../lib/pending'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { MonthPicker } from '../components/MonthPicker'
import { Skeleton } from '../components/Skeleton'

type Budget = {
  id: string
  categoryId: string
  categoryName: string
  amount: string
  color: string
}

type Category = { id: string; name: string; type: string }

export function Budgets() {
  const [month, setMonth] = useState(currentMonthLabel())
  const [rows, setRows] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    void Promise.all([
      apiFetch<Budget[]>(`/budgets?month=${encodeURIComponent(month)}`),
      apiFetch<Category[]>('/categories'),
    ])
      .then(([b, c]) => {
        setRows(b)
        const expense = c.filter((x) => x.type === 'expense')
        setCategories(expense)
        if (!categoryId && expense[0]) setCategoryId(expense[0].id)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const result = await apiFetch('/budgets', {
        method: 'POST',
        body: JSON.stringify({ month, categoryId, amount }),
      })
      setAmount('')
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed')
    }
  }

  async function remove(id: string) {
    const result = await apiFetch(`/budgets/${id}`, { method: 'DELETE' })
    if (isPending(result)) setError('Waiting for admin approval')
    else load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Budgets</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <Card>
        <form onSubmit={save} className="flex flex-col gap-3">
          <label className="text-sm">
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
            Save budget
          </button>
        </form>
      </Card>
      {loading ? (
        <Skeleton className="h-32" />
      ) : rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((b) => (
            <li key={b.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium" style={{ color: b.color }}>
                    {b.categoryName}
                  </p>
                  <Amount paise={b.amount} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryId(b.categoryId)
                      setAmount(paiseToRupeeInput(b.amount))
                    }}
                    className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => void remove(b.id)} className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]">
                    Delete
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)]">No budgets for this month.</p>
        </Card>
      )}
    </div>
  )
}
