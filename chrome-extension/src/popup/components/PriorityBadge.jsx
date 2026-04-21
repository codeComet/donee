import { cn } from '../lib/utils'

const config = {
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  lowest: { label: 'Lowest', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default function PriorityBadge({ priority, className }) {
  const c = config[priority]
  if (!c) return null
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', c.cls, className)}>
      {c.label}
    </span>
  )
}
