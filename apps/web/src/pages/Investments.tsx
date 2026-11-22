import { useEffect, useMemo, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { apiFetch, ApiError } from '../lib/api'
import { isPending } from '../lib/pending'
import { Amount } from '../components/Amount'
import { BottomSheet } from '../components/BottomSheet'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

ChartJS.register(ArcElement, Tooltip, Legend)

type Holding = {
  id: string
  assetType: string
  name: string
  symbol: string | null
  investedAmount: string
  currentValue: string
  gain: string
  gainPct: number | null
}

type HoldingsResponse = {
  holdings: Holding[]
  netWorth: string
}

export function Investments() {
  const isAdmin = true
  const [data, setData] = useState<HoldingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState<Holding | null>(null)
  const [valueInput, setValueInput] = useState('')
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')

  function load() {
    setLoading(true)
    void apiFetch<HoldingsResponse>('/holdings')
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const allocation = useMemo(() => {
    if (!data?.holdings.length) return null
    const buckets = new Map<string, bigint>()
    for (const h of data.holdings) {
      const prev = buckets.get(h.assetType) ?? 0n
      buckets.set(h.assetType, prev + BigInt(h.currentValue || '0'))
    }
    const labels = [...buckets.keys()]
    const values = labels.map((l) => Number(buckets.get(l) ?? 0n) / 100)
    return { labels, datasets: [{ data: values, backgroundColor: labels.map(() => 'var(--invest)'), borderWidth: 0 }] }
  }, [data])

  async function createHolding() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    try {
      await apiFetch('/holdings', { method: 'POST', body: JSON.stringify({ name, assetType: 'other' }) })
      setNewName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add holding')
    } finally {
      setCreating(false)
    }
  }

  async function saveName(h: Holding) {
    setError('')
    try {
      const result = await apiFetch(`/holdings/${h.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, assetType: h.assetType, symbol: h.symbol }),
      })
      setEditingId('')
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update')
    }
  }

  async function removeHolding(id: string) {
    setError('')
    try {
      const result = await apiFetch(`/holdings/${id}`, { method: 'DELETE' })
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete')
    }
  }

  async function saveValue() {
    if (!picker) return
    setError('')
    try {
      const result = await apiFetch(`/holdings/${picker.id}/value`, {
        method: 'POST',
        body: JSON.stringify({ currentValue: valueInput }),
      })
      setPicker(null)
      setValueInput('')
      if (isPending(result)) setError('Waiting for admin approval')
      else load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">Investments</h1>
      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)]">Portfolio net worth context</p>
          <Amount paise={data?.netWorth ?? '0'} className="text-2xl" />
        </Card>
      )}
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Allocation</h2>
        {loading || !allocation ? (
          <Skeleton className="mx-auto h-44 w-44 rounded-full" />
        ) : (
          <AllocationDonut data={allocation} />
        )}
      </Card>
      {loading ? (
        <Skeleton className="h-48" />
      ) : data?.holdings.length ? (
        <ul className="flex flex-col gap-2">
          {data.holdings.map((h) => (
            <li key={h.id}>
              <Card className="p-3">
                <HoldingRow
                  h={h}
                  isAdmin={isAdmin}
                  editing={editingId === h.id}
                  editName={editName}
                  onEditName={setEditName}
                  onStartEdit={() => { setEditingId(h.id); setEditName(h.name); setError('') }}
                  onSave={() => void saveName(h)}
                  onDelete={() => void removeHolding(h.id)}
                  onSetValue={() => { setPicker(h); setValueInput(''); setError('') }}
                />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">Add a holding, then record an investment against it.</p>
          <label className="flex flex-col gap-1 text-sm">
            Holding name
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Mutual fund, gold, FD"
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
            />
          </label>
          {error && !picker ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="button" disabled={creating || !newName.trim()} onClick={() => void createHolding()} className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)] disabled:opacity-60">
            {creating ? 'Adding…' : 'Add holding'}
          </button>
        </Card>
      )}
      <BottomSheet open={Boolean(picker)} title="Update current value" onClose={() => setPicker(null)}>
        <label className="mb-3 flex flex-col gap-1 text-sm">
          Amount
          <input
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            placeholder="125000.50"
            className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
          />
        </label>
        {error ? <p className="mb-2 text-sm text-[var(--expense)]">{error}</p> : null}
        <button type="button" onClick={() => void saveValue()} className="min-h-11 w-full rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
          Save value
        </button>
      </BottomSheet>
    </div>
  )
}

function AllocationDonut({ data }: { data: { labels: string[]; datasets: { data: number[]; backgroundColor: string[]; borderWidth: number }[] } }) {
  return (
    <div className="mx-auto max-w-[200px]">
      <Doughnut data={data} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '55%' }} />
    </div>
  )
}

function HoldingRow({
  h,
  isAdmin,
  editing,
  editName,
  onEditName,
  onStartEdit,
  onSave,
  onDelete,
  onSetValue,
}: {
  h: Holding
  isAdmin: boolean
  editing: boolean
  editName: string
  onEditName: (value: string) => void
  onStartEdit: () => void
  onSave: () => void
  onDelete: () => void
  onSetValue: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {editing ? (
          <input value={editName} onChange={(e) => onEditName(e.target.value)} className="min-h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
        ) : (
          <p className="font-medium text-[var(--text)]">{h.name}</p>
        )}
        <p className="text-xs capitalize text-[var(--muted)]">
          {h.assetType}
          {h.symbol ? ` · ${h.symbol}` : ''}
        </p>
      </div>
      <div className="text-right">
        <Amount paise={h.currentValue} type="investment" />
        <p className="text-xs text-[var(--muted)]">
          Invested <Amount paise={h.investedAmount} className="text-xs" />
        </p>
        {h.gainPct != null ? (
          <p className={`text-xs tabular-nums ${BigInt(h.gain) >= 0n ? 'text-[var(--income)]' : 'text-[var(--expense)]'}`}>
            {(h.gainPct * 100).toFixed(1)}%
          </p>
        ) : null}
      </div>
      <button type="button" onClick={onSetValue} className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-sm text-[var(--primary)]">
        Set value
      </button>
      {isAdmin ? (
        <>
          <button type="button" onClick={editing ? onSave : onStartEdit} className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-sm">
            {editing ? 'Save' : 'Edit'}
          </button>
          <button type="button" onClick={onDelete} className="min-h-11 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]">
            Delete
          </button>
        </>
      ) : null}
    </div>
  )
}
