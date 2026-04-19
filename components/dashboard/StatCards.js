import { FolderKanban, ListTodo, UserCheck, CheckCircle2 } from 'lucide-react'

const cards = [
  {
    key: 'totalProjects',
    label: 'Total Projects',
    icon: FolderKanban,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/30',
    border: 'border-indigo-100 dark:border-indigo-800/50',
  },
  {
    key: 'totalTasks',
    label: 'Total Tasks',
    icon: ListTodo,
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-900/30',
    border: 'border-sky-100 dark:border-sky-800/50',
  },
  {
    key: 'myTasks',
    label: 'Assigned to Me',
    icon: UserCheck,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    border: 'border-violet-100 dark:border-violet-800/50',
  },
  {
    key: 'completedTasks',
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'border-emerald-100 dark:border-emerald-800/50',
  },
]

export default function StatCards({ totalProjects, totalTasks, myTasks, completedTasks }) {
  const values = { totalProjects, totalTasks, myTasks, completedTasks }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ key, label, icon: Icon, color, bg, border }) => (
        <div
          key={key}
          className={`bg-white dark:bg-slate-800 rounded-xl border ${border} p-5 shadow-sm flex items-start gap-4`}
        >
          <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{values[key] ?? 0}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
