import { useEffect, useState } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { isStaff } from '../lib/version'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

export type ChangeRequest = {
  id: string
  entity: string
  action: string
  summary: string
  status: string
  createdAt: string
  reviewedAt: string | null
  ownerName: string
  ownerEmail: string
  requestedByName: string
  reviewedByName: string | null
}

export function Requests() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const staff = isStaff(user?.role)

  function load() {
    setLoading(true)
    void apiFetch<ChangeRequest[]>('/requests')
      .then(setRows)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function decide(id: string, status: 'approve' | 'reject') {
    setError('')
    try {
      await apiFetch(`/requests/${id}/${status}`, { method: 'POST' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not review')
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{staff ? 'Requests' : 'My requests'}</h1>
      <p className="text-sm text-[var(--muted)]">
        {staff ? 'Approve or reject an edit or delete. Your name is stored as the reviewer.' : 'Edits and deletes wait here until an admin approves them.'}
      </p>
      {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
      {loading ? (
        <Skeleton className="h-32" />
      ) : rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize">{row.action} {row.entity}</p>
                    <p className="text-sm text-[var(--text)]">{row.summary}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.ownerName} · {row.ownerEmail}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-[var(--muted)]">{row.status}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Asked by {row.requestedByName} · {new Date(row.createdAt).toLocaleString()}
                  {row.reviewedByName ? ` · Reviewed by ${row.reviewedByName}` : ''}
                </p>
                {staff && row.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void decide(row.id, 'approve')} className="min-h-10 rounded-xl bg-[var(--btn)] px-3 text-sm text-[var(--surface)]">
                      Approve
                    </button>
                    <button type="button" onClick={() => void decide(row.id, 'reject')} className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-sm text-[var(--expense)]">
                      Reject
                    </button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)]">No requests yet.</p>
        </Card>
      )}
    </div>
  )
}
