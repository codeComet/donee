import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import { ArrowRight, FolderOpen } from 'lucide-react'

const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  done: 'Done',
  review: 'Review',
}

export default function ProjectGrid({ projects }) {
  if (!projects?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
        <FolderOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400">No projects yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Projects</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((project) => {
          const { taskCounts, totalTasks } = project
          return (
            <div
              key={project.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex-shrink-0"
                  style={{ backgroundColor: project.color ?? '#6366f1' }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{project.description}</p>
                  )}
                </div>
              </div>

              {/* PM */}
              {project.pm && (
                <div className="flex items-center gap-2">
                  <Avatar user={project.pm} size="xs" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    PM: <span className="font-medium text-slate-700 dark:text-slate-300">{project.pm.full_name}</span>
                  </span>
                </div>
              )}

              {/* Task counts */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_LABELS).map(([status, label]) => {
                  const count = taskCounts?.[status] ?? 0
                  if (count === 0) return null
                  return (
                    <span
                      key={status}
                      className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-2 py-0.5"
                    >
                      {count} {label}
                    </span>
                  )
                })}
                {totalTasks === 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">No tasks yet</span>
                )}
              </div>

              {/* CTA */}
              <Link
                href={`/dashboard/project/${project.id}`}
                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-200 dark:border-slate-600 mt-auto"
              >
                View Tasks
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
