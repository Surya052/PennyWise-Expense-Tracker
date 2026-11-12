import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { formatDate } from '../lib/money'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Tx = {
  id: string
  type: string
  amount: string
  date: string
  note: string
  category: { name: string; color: string } | null
  account: { name: string }
}

type ListResponse = {
  items: Tx[]
  page: number
  pageSize: number
  total: number
}

export function Transactions() {
  const { user } = useAuth()
  const toast = useToast()
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Tx[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '40' })
    if (type) params.set('type', type)
    if (q.trim()) params.set('q', q.trim())
    void apiFetch<ListResponse>(`/transactions?${params}`)
      .then((data) => {
        setRows(data.items)
        setTotal(data.total)
      })
      .finally(() => setLoading(false))
  }, [page, q, type])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>()
    for (const tx of rows) {
      const list = map.get(tx.date) ?? []
      list.push(tx)
      map.set(tx.date, list)
    }
    return [...map.entries()]
  }, [rows])

  async function remove(id: string) {
    await apiFetch(`/transactions/${id}`, { method: 'DELETE' })
    setRows((prev) => prev.filter((r) => r.id !== id))
    toast.show('Transaction deleted', () => {
      void apiFetch(`/transactions/${id}/restore`, { method: 'POST' }).then(load)
    })
  }

  const filters = ['', 'expense', 'income', 'investment', 'transfer']

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--text)]">Transactions</h1>
        <Link to="/add" className="hidden min-h-11 items-center rounded-2xl bg-[var(--btn)] px-4 text-sm font-semibold text-[var(--surface)] md:inline-flex">
          Add
        </Link>
      </div>
      <label className="sr-only" htmlFor="tx-search">
        Search
      </label>
      <input
        id="tx-search"
        type="search"
        placeholder="Search notes or categories"
        value={q}
        onChange={(e) => {
          setPage(1)
          setQ(e.target.value)
        }}
        className="min-h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[var(--text)]"
      />
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f || 'all'}
            type="button"
            onClick={() => {
              setType(f)
              setPage(1)
            }}
            className={`min-h-11 rounded-full border px-4 text-sm capitalize ${
              type === f ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : grouped.length ? (
        <div className="flex flex-col gap-4">
          {grouped.map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {user ? formatDate(day, user.dateFormat) : day}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((tx) => (
                  <SwipeRow
                    key={tx.id}
                    open={openId === tx.id}
                    onOpen={() => setOpenId(tx.id)}
                    onClose={() => setOpenId(null)}
                    onDelete={() => remove(tx.id)}
                  >
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text)]">{tx.note || tx.category?.name || tx.type}</p>
                          <p className="text-xs text-[var(--muted)]">{tx.account.name}</p>
                        </div>
                        <Amount paise={tx.amount} type={tx.type as 'expense'} showSign />
                      </div>
                    </Card>
                  </SwipeRow>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)]">No transactions match your filters.</p>
        </Card>
      )}
      {total > 40 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="flex items-center text-sm text-[var(--muted)]">
            Page {page} of {Math.ceil(total / 40)}
          </span>
          <button
            type="button"
            disabled={page * 40 >= total}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SwipeRow({
  children,
  open,
  onOpen,
  onClose,
  onDelete,
}: {
  children: ReactNode
  open: boolean
  onOpen: () => void
  onClose: () => void
  onDelete: () => void
}) {
  let startX = 0
  return (
    <li
      className="relative overflow-hidden rounded-[18px]"
      onTouchStart={(e) => {
        startX = e.touches[0]?.clientX ?? 0
      }}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX ?? 0
        if (startX - end > 50) onOpen()
        if (end - startX > 50) onClose()
      }}
    >
      <div
        className={`absolute inset-y-0 right-0 flex items-stretch transition ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <Link
          to="/add"
          className="flex min-w-[4.5rem] items-center justify-center bg-[var(--primary)] text-sm font-medium text-[var(--surface)]"
          onClick={onClose}
        >
          Edit
        </Link>
        <button
          type="button"
          className="flex min-w-[4.5rem] items-center justify-center bg-[var(--expense)] text-sm font-medium text-[var(--surface)]"
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          Delete
        </button>
      </div>
      <div className={`relative transition ${open ? '-translate-x-[9rem]' : ''}`}>{children}</div>
    </li>
  )
}
