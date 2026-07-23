interface SkeletonProps {
  width?: string
  height?: string
  rounded?: string
  className?: string
}

export default function Skeleton({ width = '100%', height = '1rem', rounded = 'md', className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-200 rounded-${rounded} ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-0 rounded-xl border border-surface-200 p-4 space-y-3 ${className}`}>
      <Skeleton width="60%" height="1.25rem" />
      <Skeleton width="100%" height="0.875rem" />
      <Skeleton width="80%" height="0.875rem" />
    </div>
  )
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
