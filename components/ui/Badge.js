import { cn } from '@/lib/utils'

// Project color badge — shows a colored circle dot + project name
export default function ProjectBadge({ project, className }) {
  if (!project) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        className
      )}
      style={{
        backgroundColor: project.color ? `${project.color}18` : '#6366f118',
        borderColor: project.color ? `${project.color}40` : '#6366f140',
        color: project.color ?? '#6366f1',
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: project.color ?? '#6366f1' }}
      />
      {project.name}
    </span>
  )
}
