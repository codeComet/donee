'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { canEditTask, canDeleteTask } from '@/lib/permissions'
import { cn, truncate } from '@/lib/utils'
import ProjectBadge from '@/components/ui/Badge'
import PriorityTag from '@/components/ui/PriorityTag'
import StatusTag, { statusConfig } from '@/components/ui/StatusTag'
import Avatar from '@/components/ui/Avatar'
import { TableRowSkeleton } from '@/components/ui/SkeletonLoader'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { formatDistanceToNow, format } from 'date-fns'
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Pencil, Trash2, ExternalLink } from 'lucide-react'

const STATUS_OPTIONS = Object.entries(statusConfig).map(([value, { label }]) => ({ value, label }))

function SortHeader({ label, column, sortState, onSort }) {
  const isActive = sortState.column === column
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
      onClick={() => onSort(column)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-slate-400">
          {isActive ? (
            sortState.direction === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
            )
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5" />
          )}
        </span>
      </span>
    </th>
  )
}

function RelativeDate({ date }) {
  if (!date) return <span className="text-slate-400">—</span>
  const d = new Date(date)
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="text-slate-500 dark:text-slate-400 text-xs cursor-default">
            {formatDistanceToNow(d, { addSuffix: true })}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-slate-800 text-white text-xs px-2 py-1 rounded-lg z-50"
            sideOffset={4}
          >
            {format(d, 'PPpp')}
            <Tooltip.Arrow className="fill-slate-800" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

function InlineStatusSelect({ task, profile, workspaceMember }) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (newStatus) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
      if (error) throw error
    },
    onMutate: async (newStatus) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const prev = qc.getQueriesData({ queryKey: ['tasks'] })
      qc.setQueriesData({ queryKey: ['tasks'] }, (old) =>
        Array.isArray(old) ? old.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)) : old
      )
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) ctx.prev.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const canEdit = canEditTask(profile, task, workspaceMember)

  if (!canEdit) return <StatusTag status={task.status} />

  return (
    <select
      value={task.status}
      onChange={(e) => {
        e.stopPropagation()
        mutation.mutate(e.target.value)
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'text-xs rounded-full border px-2 py-0.5 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors',
        statusConfig[task.status]?.className ?? 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export default function TaskTable({ tasks, profile, workspaceMember, onRowClick, selectedTaskId, loading }) {
  const [sort, setSort] = useState({ column: 'updated_at', direction: 'desc' })
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (taskId) => {
      const supabase = createClient()
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  function handleSort(column) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    )
  }

  const sorted = [...(tasks ?? [])].sort((a, b) => {
    const { column, direction } = sort
    let va = a[column] ?? ''
    let vb = b[column] ?? ''
    if (column === 'updated_at' || column === 'created_at') {
      va = new Date(va).getTime()
      vb = new Date(vb).getTime()
    } else {
      va = String(va).toLowerCase()
      vb = String(vb).toLowerCase()
    }
    if (va < vb) return direction === 'asc' ? -1 : 1
    if (va > vb) return direction === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <SortHeader label="Project" column="project_id" sortState={sort} onSort={handleSort} />
              <SortHeader label="Title" column="title" sortState={sort} onSort={handleSort} />
              <SortHeader label="Priority" column="priority" sortState={sort} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                Status
              </th>
              <SortHeader label="Assignee" column="assigned_to" sortState={sort} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Est.
              </th>
              <SortHeader label="Updated" column="updated_at" sortState={sort} onSort={handleSort} />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                  No tasks found.
                </td>
              </tr>
            )}

            {!loading &&
              sorted.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onRowClick(task)}
                  className={cn(
                    'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
                    selectedTaskId === task.id && 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                  )}
                >
                  {/* Project */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.project ? (
                      <ProjectBadge project={task.project} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[240px]">
                        {task.title}
                      </span>
                      {task.url && (
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityTag priority={task.priority} />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <InlineStatusSelect task={task} profile={profile} workspaceMember={workspaceMember} />
                  </td>

                  {/* Assignee */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar user={task.assignee} size="xs" />
                        <span className="text-slate-600 dark:text-slate-300 text-xs max-w-[100px] truncate">
                          {task.assignee.full_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">Unassigned</span>
                    )}
                  </td>

                  {/* Estimation */}
                  <td className="px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">{task.estimation ?? '—'}</span>
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-3">
                    <RelativeDate date={task.updated_at} />
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    {canEditTask(profile, task, workspaceMember) && (
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors outline-none">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            sideOffset={4}
                            className="min-w-[130px] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1.5 z-50 animate-fade-in"
                          >
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer outline-none"
                              onSelect={() => onRowClick(task)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-400" />
                              Edit
                            </DropdownMenu.Item>
                            {canDeleteTask(profile, workspaceMember) && (
                              <>
                                <DropdownMenu.Separator className="my-1 border-t border-slate-100 dark:border-slate-700" />
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer outline-none"
                                  onSelect={() => {
                                    if (confirm('Delete this task?')) deleteMutation.mutate(task.id)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenu.Item>
                              </>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && sorted.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
          {sorted.length} task{sorted.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
