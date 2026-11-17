import { TaskTableSkeleton } from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="h-8 w-40 skeleton rounded" />
      <TaskTableSkeleton />
    </div>
  )
}
