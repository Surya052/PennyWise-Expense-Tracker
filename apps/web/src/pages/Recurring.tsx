import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Row = {
  id: string
  type: string
  amount: string
  frequency: string
  nextRunDate: string
  note: string
  isActive: boolean
}

export function Recurring() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void apiFetch<Row[]>('/recurring')
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  async function toggle(id: string, isActive: boolean) {
    await apiFetch(`/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !isActive }),
    })
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !isActive } : r)))
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Recurring</h1>
      {loading ? (
        <Skeleton className="h-32" />
      ) : rows.length ? (
        <ul className="flex flex-col gap-2">
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
                  onClick={() => void toggle(r.id, r.isActive)}
                  className={`min-h-10 rounded-full px-3 text-sm ${r.isActive ? 'bg-[var(--income)]/20 text-[var(--income)]' : 'border border-[var(--border)] text-[var(--muted)]'}`}
                >
                  {r.isActive ? 'Active' : 'Paused'}
                </button>
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
