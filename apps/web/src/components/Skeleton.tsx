export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--border)]/60 ${className}`} aria-hidden />
}
