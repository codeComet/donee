import { TaskTableSkeleton } from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="h-8 w-56 skeleton rounded" />
      <div className="h-4 w-80 skeleton rounded" />
      <TaskTableSkeleton />
    </div>
  )
}
