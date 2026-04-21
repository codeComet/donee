import { cn } from '../lib/utils'

const config = {
  backlog: { label: 'Backlog', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  estimation: { label: 'Estimation', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  review: { label: 'Review', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  done_in_staging: { label: 'Done in Staging', cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  waiting_for_confirmation: { label: 'Waiting Confirm.', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  paused: { label: 'Paused', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  done: { label: 'Done', cls: 'bg-green-100 text-green-700 border-green-200' },
}

export const statusConfig = config

export default function StatusBadge({ status, className }) {
  const c = config[status]
  if (!c) return null
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap', c.cls, className)}>
      {c.label}
    </span>
  )
}
