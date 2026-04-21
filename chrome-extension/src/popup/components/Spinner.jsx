import { cn } from '../lib/utils'

export default function Spinner({ size = 'md', className }) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={cn('animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600', sizeMap[size], className)} />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

export function SkeletonLine({ className }) {
  return <div className={cn('skeleton rounded h-4 w-full', className)} />
}

export function TaskSkeleton() {
  return (
    <div className="p-3 border-b border-slate-100 space-y-2">
      <SkeletonLine className="w-3/4" />
      <div className="flex gap-2">
        <SkeletonLine className="w-16 h-3" />
        <SkeletonLine className="w-20 h-3" />
      </div>
    </div>
  )
}
