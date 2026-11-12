import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { currentMonthLabel, formatDate } from '../lib/money'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { MonthPicker } from '../components/MonthPicker'
import { Skeleton } from '../components/Skeleton'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

type Dashboard = {
  month: string
  income: string
  expense: string
  invested: string
  netSavings: string
  netWorth: string
  byCategory: { name: string; color: string; amount: string }[]
  monthly: { month: string; income: string; expense: string }[]
  recent: {
    id: string
    type: string
    amount: string
    date: string
    note: string
    categoryName: string
  }[]
  budgets: {
    categoryName: string
    color: string
    amount: string
    spent: string
    ratio: number
    warning: string
  }[]
}

export function Home() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonthLabel())
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    void apiFetch<Dashboard>(`/dashboard?month=${encodeURIComponent(month)}`)
      .then((payload) => {
        if (alive) setData(payload)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [month])

  const donut = useMemo(() => {
    if (!data?.byCategory.length) return null
    return {
      labels: data.byCategory.map((c) => c.name),
      datasets: [
        {
          data: data.byCategory.map((c) => Number(c.amount) / 100),
          backgroundColor: data.byCategory.map((c) => c.color),
          borderWidth: 0,
        },
      ],
    }
  }, [data])

  const bar = useMemo(() => {
    if (!data) return null
    return {
      labels: data.monthly.map((m) => m.month),
      datasets: [
        {
          label: 'Income',
          data: data.monthly.map((m) => Number(m.income) / 100),
          backgroundColor: 'var(--income)',
          borderRadius: 6,
        },
        {
          label: 'Expense',
          data: data.monthly.map((m) => Number(m.expense) / 100),
          backgroundColor: 'var(--expense)',
          borderRadius: 6,
        },
      ],
    }
  }, [data])

  const greeting = user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Hello'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title={greeting} />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      {loading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Income" paise={data.income} type="income" />
          <StatCard label="Expense" paise={data.expense} type="expense" />
          <StatCard label="Invested" paise={data.invested} type="investment" />
          <StatCard label="Net savings" paise={data.netSavings} type="neutral" />
          <Card className="sm:col-span-2">
            <p className="text-sm text-[var(--muted)]">Net worth</p>
            <Amount paise={data.netWorth} className="text-2xl" />
          </Card>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Spending by category</h2>
          {loading || !donut ? (
            <Skeleton className="mx-auto h-48 w-48 rounded-full" />
          ) : (
            <div className="mx-auto max-w-[220px]">
              <Doughnut data={donut} options={{ plugins: { legend: { display: false } }, cutout: '62%' }} />
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Income vs expense</h2>
          {loading || !bar ? <Skeleton className="h-48" /> : <Bar data={bar} options={{ responsive: true, scales: { x: { stacked: false }, y: { beginAtZero: true } } }} />}
        </Card>
      </div>
      {data?.budgets.length ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Budgets</h2>
          <ul className="flex flex-col gap-3">
            {data.budgets.map((b) => (
              <li key={b.categoryName}>
                <div className="mb-1 flex justify-between text-sm">
                  <span style={{ color: b.color }}>{b.categoryName}</span>
                  <span className="text-[var(--muted)]">
                    <Amount paise={b.spent} type="expense" /> / <Amount paise={b.amount} />
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className={`h-full rounded-full ${b.warning === 'over' ? 'bg-[var(--expense)]' : b.warning === 'near' ? 'bg-[var(--primary)]' : 'bg-[var(--income)]'}`}
                    style={{ width: `${Math.min(100, Math.round(b.ratio * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Recent</h2>
          <Link to="/transactions" className="text-sm text-[var(--primary)]">
            View all
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-32" />
        ) : data?.recent.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {data.recent.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{tx.note || tx.categoryName || tx.type}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {user ? formatDate(tx.date, user.dateFormat) : tx.date}
                  </p>
                </div>
                <Amount paise={tx.amount} type={tx.type as 'expense' | 'income' | 'investment'} showSign />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No transactions yet.</p>
        )}
      </Card>
    </div>
  )
}

function StatCard({ label, paise, type }: { label: string; paise: string; type: 'income' | 'expense' | 'investment' | 'neutral' }) {
  return (
    <Card>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <Amount paise={paise} type={type} className="text-xl" showSign={type !== 'neutral'} />
    </Card>
  )
}

function PageTitle({ title }: { title: string }) {
  return <h1 className="text-xl font-semibold text-[var(--text)]">{title}</h1>
}
