import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { apiBlob } from '../lib/api'
import { Amount } from '../components/Amount'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Report = {
  from: string
  to: string
  income: string
  expense: string
  netSavings: string
  savingsRate: number | null
  byCategory: { name: string; color: string; amount: string }[]
}

export function Reports() {
  const [mode, setMode] = useState<'month' | 'year' | 'custom'>('month')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [csvPreview, setCsvPreview] = useState('')
  const [importResult, setImportResult] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ mode })
    if (mode === 'month') params.set('month', month)
    if (mode === 'custom') {
      params.set('from', from)
      params.set('to', to)
    }
    void apiFetch<Report>(`/reports?${params}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [from, mode, month, to])

  function download(path: string, filename: string) {
    void apiBlob(path).then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const exportQuery = mode === 'month' ? `mode=month&month=${month}` : mode === 'custom' ? `mode=custom&from=${from}&to=${to}` : 'mode=year'

  async function previewImport() {
    const result = await apiFetch<{ sample: unknown[] }>('/reports/import/preview', {
      method: 'POST',
      body: JSON.stringify({ csv: csvPreview }),
    })
    setImportResult(`Previewed ${result.sample?.length ?? 0} sample rows`)
  }

  async function runImport() {
    const result = await apiFetch<{ created: number }>('/reports/import', {
      method: 'POST',
      body: JSON.stringify({ csv: csvPreview }),
    })
    setImportResult(`Imported ${result.created} transactions`)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <div className="flex flex-wrap gap-2">
        {(['month', 'year', 'custom'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`min-h-10 rounded-full px-4 text-sm capitalize ${mode === m ? 'bg-[var(--btn)] text-[var(--surface)]' : 'border border-[var(--border)]'}`}
          >
            {m}
          </button>
        ))}
      </div>
      {mode === 'month' ? (
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3" />
      ) : null}
      {mode === 'custom' ? (
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] px-3" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] px-3" />
        </div>
      ) : null}
      {loading ? (
        <Skeleton className="h-36" />
      ) : data ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            {data.from} → {data.to}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--muted)]">Income</p>
              <Amount paise={data.income} type="income" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Expense</p>
              <Amount paise={data.expense} type="expense" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Savings</p>
              <Amount paise={data.netSavings} />
            </div>
          </div>
          {data.savingsRate != null ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Savings rate {(data.savingsRate * 100).toFixed(1)}%</p>
          ) : null}
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {data.byCategory.map((c) => (
              <li key={c.name} className="flex justify-between py-2 text-sm">
                <span style={{ color: c.color }}>{c.name}</span>
                <Amount paise={c.amount} type="expense" />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="flex flex-wrap gap-2">
        <button type="button" onClick={() => download(`/reports/export.csv?${exportQuery}`, 'pennywise.csv')} className="min-h-11 rounded-2xl border border-[var(--border)] px-4 text-sm text-[var(--primary)]">
          Export CSV
        </button>
        <button type="button" onClick={() => download(`/reports/export.xlsx?${exportQuery}`, 'pennywise.xlsx')} className="min-h-11 rounded-2xl border border-[var(--border)] px-4 text-sm text-[var(--primary)]">
          Export Excel
        </button>
        <button type="button" onClick={() => download(`/reports/export.pdf?${exportQuery}`, 'pennywise.pdf')} className="min-h-11 rounded-2xl border border-[var(--border)] px-4 text-sm text-[var(--primary)]">
          Export PDF
        </button>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Import CSV</h2>
        <textarea
          value={csvPreview}
          onChange={(e) => setCsvPreview(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm"
          placeholder="Paste CSV content"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void previewImport()} className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
            Preview
          </button>
          <button type="button" onClick={() => void runImport()} className="min-h-10 rounded-xl bg-[var(--btn)] px-3 text-sm text-[var(--surface)]">
            Import
          </button>
        </div>
        {importResult ? <p className="mt-2 text-sm text-[var(--muted)]">{importResult}</p> : null}
      </Card>
    </div>
  )
}
