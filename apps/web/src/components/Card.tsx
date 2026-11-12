import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </div>
  )
}
