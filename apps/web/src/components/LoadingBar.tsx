import { useEffect, useState } from 'react'
import { subscribeBusy } from '../lib/api'

export function LoadingBar() {
  const [count, setCount] = useState(0)
  useEffect(() => subscribeBusy(setCount), [])
  if (count < 1) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80]" role="status" aria-live="polite">
      <div className="h-1 overflow-hidden bg-[var(--border)]">
        <div className="h-full w-1/3 animate-pulse bg-[var(--primary)]" />
      </div>
      <p className="sr-only">Loading</p>
    </div>
  )
}
