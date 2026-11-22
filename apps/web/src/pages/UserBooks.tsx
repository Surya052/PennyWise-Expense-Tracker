import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { paiseToRupeeInput, rupeeAmount } from '../lib/money'
import { isPending, ownerQuery } from '../lib/pending'
import { isStaff } from '../lib/version'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Person = { id: string; name: string; email: string; role: string }

type Books = {
  user: { id: string; name: string; email: string; role: string; isActive: boolean; modules: string[]; lastLoginAt: string | null }
  accounts: { id: string; name: string; type: string; color: string; isArchived: boolean; currentBalance: string }[]
  categories: { id: string; name: string; type: string; color: string }[]
  transactions: {
    id: string
    type: string
    action: string | null
    amount: string
    units: string
    date: string
    note: string
    paymentMethod: string
    tags: string[]
    account: { id: string; name: string }
    toAccount: { id: string } | null
    category: { id: string; name: string } | null
    holding: { id: string } | null
  }[]
  holdings: { id: string; name: string; assetType: string; symbol: string | null; currentValue: string; investedAmount: string }[]
  goals: { id: string; name: string; targetAmount: string; savedAmount: string; targetDate: string | null }[]
  recurring: {
    id: string
    type: string
    amount: string
    note: string
    frequency: string
    nextRunDate: string
    isActive: boolean
    paymentMethod: string
    accountId: string
    toAccountId: string | null
    categoryId: string | null
    holdingId: string | null
    action: string | null
    units: string
    tags: string[]
  }[]
  budgets: { id: string; categoryId: string; categoryName: string; amount: string }[]
  month: string
}

export function UserBooks() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [people, setPeople] = useState<Person[]>([])
  const [books, setBooks] = useState<Books | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void apiFetch<Person[]>('/admin/users').then(setPeople)
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError('')
    void apiFetch<Books>(`/admin/users/${id}/books`)
      .then(setBooks)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this user'))
      .finally(() => setLoading(false))
  }, [id])

  async function change(path: string, init: RequestInit, ok: string) {
    setError('')
    try {
      const result = await apiFetch(`${path}${ownerQuery(id)}`, init)
      if (isPending(result)) toast.show('Waiting for admin approval')
      else toast.show(ok)
      const next = await apiFetch<Books>(`/admin/users/${id}/books`)
      setBooks(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save')
    }
  }

  if (!isStaff(user?.role)) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">User records</h1>
        <Link to="/admin" className="text-sm text-[var(--primary)]">Back</Link>
      </div>
      <label className="text-sm">
        User
        <select
          value={id}
          onChange={(e) => navigate(`/admin/users/${e.target.value}`)}
          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} · {person.email} · {person.role.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
      {loading || !books ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Card>
            <p className="font-medium">{books.user.name}</p>
            <p className="text-sm text-[var(--muted)]">{books.user.email}</p>
            <p className="text-xs capitalize text-[var(--muted)]">
              {books.user.role.replace('_', ' ')} · {books.user.isActive ? 'Active' : 'Inactive'}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{books.user.modules.join(', ')}</p>
          </Card>
          <Section title="Transactions">
            {books.transactions.map((tx) => (
              <Row key={tx.id} title={tx.note || tx.category?.name || tx.type} detail={`${tx.account.name} · ${tx.date}`} extra={<Amount paise={tx.amount} type={tx.type as 'expense'} showSign />}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const amount = window.prompt('Amount in rupees', paiseToRupeeInput(tx.amount))
                  if (amount == null) return
                  const body: Record<string, unknown> = {
                    type: tx.type,
                    amount: rupeeAmount(amount),
                    date: tx.date.slice(0, 10),
                    accountId: tx.account.id,
                    note: tx.note,
                    paymentMethod: tx.paymentMethod,
                    tags: tx.tags,
                  }
                  if (tx.category) body.categoryId = tx.category.id
                  if (tx.toAccount) body.toAccountId = tx.toAccount.id
                  if (tx.holding) {
                    body.holdingId = tx.holding.id
                    body.action = tx.action || 'buy'
                    body.units = tx.units || '1'
                  }
                  void change(`/transactions/${tx.id}`, { method: 'PATCH', body: JSON.stringify(body) }, 'Transaction updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/transactions/${tx.id}`, { method: 'DELETE' }, 'Transaction deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
          <Section title="Accounts">
            {books.accounts.map((row) => (
              <Row key={row.id} title={row.name} detail={row.type} extra={<Amount paise={row.currentBalance} />}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const name = window.prompt('Account name', row.name)
                  if (!name) return
                  void change(`/accounts/${row.id}`, { method: 'PATCH', body: JSON.stringify({ name, type: row.type, color: row.color, isArchived: row.isArchived }) }, 'Account updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/accounts/${row.id}`, { method: 'DELETE' }, 'Account deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
          <Section title="Categories">
            {books.categories.map((row) => (
              <Row key={row.id} title={row.name} detail={row.type}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const name = window.prompt('Category name', row.name)
                  if (!name) return
                  void change(`/categories/${row.id}`, { method: 'PATCH', body: JSON.stringify({ name, type: row.type, color: row.color }) }, 'Category updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/categories/${row.id}`, { method: 'DELETE' }, 'Category deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
          <Section title="Holdings">
            {books.holdings.map((row) => (
              <Row key={row.id} title={row.name} detail={row.assetType} extra={<Amount paise={row.currentValue} type="investment" />}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const name = window.prompt('Holding name', row.name)
                  if (!name) return
                  void change(`/holdings/${row.id}`, { method: 'PATCH', body: JSON.stringify({ name, assetType: row.assetType, symbol: row.symbol }) }, 'Holding updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/holdings/${row.id}`, { method: 'DELETE' }, 'Holding deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
          <Section title={`Budgets ${books.month}`}>
            {books.budgets.map((row) => (
              <Row key={row.id} title={row.categoryName} extra={<Amount paise={row.amount} />}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const amount = window.prompt('Budget in rupees', paiseToRupeeInput(row.amount))
                  if (amount == null) return
                  void change('/budgets', { method: 'POST', body: JSON.stringify({ month: books.month, categoryId: row.categoryId, amount: rupeeAmount(amount) }) }, 'Budget updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/budgets/${row.id}`, { method: 'DELETE' }, 'Budget deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
          <Section title="Goals">
            {books.goals.map((row) => (
              <Row key={row.id} title={row.name} extra={<Amount paise={row.targetAmount} />}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const name = window.prompt('Goal name', row.name)
                  if (!name) return
                  void change(`/goals/${row.id}`, { method: 'PATCH', body: JSON.stringify({ name, targetAmount: paiseToRupeeInput(row.targetAmount), savedAmount: paiseToRupeeInput(row.savedAmount), targetDate: row.targetDate }) }, 'Goal updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/goals/${row.id}`, { method: 'DELETE' }, 'Goal deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
          <Section title="Recurring">
            {books.recurring.map((row) => (
              <Row key={row.id} title={row.note || row.type} detail={`${row.frequency} · ${row.nextRunDate}`} extra={<Amount paise={row.amount} type={row.type as 'expense'} showSign />}>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm" onClick={() => {
                  const amount = window.prompt('Amount in rupees', paiseToRupeeInput(row.amount))
                  if (amount == null) return
                  void change(`/recurring/${row.id}`, { method: 'PATCH', body: JSON.stringify({ ...row, amount: rupeeAmount(amount), units: row.units || '1' }) }, 'Recurring updated')
                }}>Edit</button>
                <button type="button" className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]" onClick={() => void change(`/recurring/${row.id}`, { method: 'DELETE' }, 'Recurring deleted')}>Delete</button>
              </Row>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </Card>
  )
}

function Row({ title, detail, extra, children }: { title: string; detail?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2 first:border-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {detail ? <p className="text-xs capitalize text-[var(--muted)]">{detail}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {children}
      </div>
    </div>
  )
}
