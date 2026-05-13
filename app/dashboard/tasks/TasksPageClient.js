'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import TaskTable from '@/components/tasks/TaskTable'
import TaskFilters from '@/components/tasks/TaskFilters'
import AddTaskModal from '@/components/tasks/AddTaskModal'
import TaskDrawer from '@/components/tasks/TaskDrawer'
import { Plus, Loader2 } from 'lucide-react'

const PAGE_SIZE = 30

async function fetchTasks(workspaceId, taskFilter) {
  const supabase = createClient()
  let query = supabase
    .from('tasks')
    .select(
      `*,
       project:projects(id, name, color),
       assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
       creator:profiles!tasks_created_by_fkey(id, full_name)`
    )
    .order('updated_at', { ascending: false })
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  if (taskFilter?.type === 'assigned') {
    query = query.eq('assigned_to', taskFilter.userId)
  } else if (taskFilter?.type === 'pm_projects') {
    if (taskFilter.projectIds?.length > 0) {
      query = query.in('project_id', taskFilter.projectIds)
    } else {
      return []
    }
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export default function TasksPageClient({ initialTasks, projects, users, profile, workspaceMember, openTaskId, workspaceId, taskFilter, pageTitle = 'All Tasks' }) {
  const [filters, setFilters] = useState({
    search: '',
    projectIds: [],
    statuses: [],
    priorities: [],
    assigneeIds: [],
    dateFrom: '',
    dateTo: '',
  })
  const [selectedTaskId, setSelectedTaskId] = useState(openTaskId)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [seenTaskIds, setSeenTaskIds] = useState(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(`donee_seen_${profile.id}`)
      return new Set(stored ? JSON.parse(stored) : [])
    } catch { return new Set() }
  })
  const sentinelRef = useRef(null)

  const { data: tasks } = useQuery({
    queryKey: ['tasks', workspaceId, taskFilter],
    queryFn: () => fetchTasks(workspaceId, taskFilter),
    initialData: initialTasks,
    initialDataUpdatedAt: Date.now(),
    staleTime: 30_000,
  })

  // Client-side filtering — always applied to full dataset
  const filtered = tasks.filter((t) => {
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.projectIds.length && !filters.projectIds.includes(t.project_id)) return false
    if (filters.statuses.length && !filters.statuses.includes(t.status)) return false
    if (filters.priorities.length && !filters.priorities.includes(t.priority)) return false
    if (filters.assigneeIds.length && !filters.assigneeIds.includes(t.assigned_to)) return false
    if (filters.dateFrom && new Date(t.created_at) < new Date(filters.dateFrom)) return false
    if (filters.dateTo && new Date(t.created_at) > new Date(filters.dateTo + 'T23:59:59')) return false
    return true
  })

  const hasFilters = !!(
    filters.search ||
    filters.projectIds.length ||
    filters.statuses.length ||
    filters.priorities.length ||
    filters.assigneeIds.length ||
    filters.dateFrom ||
    filters.dateTo
  )

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filters])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (hasFilters) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((v) => v + PAGE_SIZE)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasFilters, visibleCount, filtered.length])

  // When filters active: show all matches; otherwise paginate
  const displayedTasks = hasFilters ? filtered : filtered.slice(0, visibleCount)
  const hasMore = !hasFilters && visibleCount < filtered.length

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

  // Fetch task by ID when not in the current list (e.g., opened via notification)
  const { data: externalTask, isLoading: externalTaskLoading } = useQuery({
    queryKey: ['task-by-id', selectedTaskId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('tasks')
        .select(`*, project:projects(id, name, color), assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url), creator:profiles!tasks_created_by_fkey(id, full_name)`)
        .eq('id', selectedTaskId)
        .maybeSingle()
      return data ?? null
    },
    enabled: !!selectedTaskId && !selectedTask,
    retry: false,
    staleTime: 30_000,
  })

  const drawerTask = selectedTask ?? externalTask ?? null
  const taskNotFound = !!selectedTaskId && !selectedTask && !externalTaskLoading && externalTask === null

  function handleRowClick(task) {
    setSelectedTaskId(task.id)
    setSeenTaskIds((prev) => {
      if (prev.has(task.id)) return prev
      const next = new Set(prev)
      next.add(task.id)
      try {
        localStorage.setItem(`donee_seen_${profile.id}`, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  // Projects with unseen task activity in the last 24h assigned to the current user
  const activeProjectIds = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const ids = new Set()
    tasks.forEach((t) => {
      if (
        t.assigned_to === profile.id &&
        !seenTaskIds.has(t.id) &&
        (new Date(t.updated_at).getTime() > cutoff || new Date(t.created_at).getTime() > cutoff)
      ) {
        ids.add(t.project_id)
      }
    })
    return ids
  }, [tasks, profile.id, seenTaskIds])

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      <TaskFilters
        filters={filters}
        onChange={setFilters}
        projects={projects}
        users={users}
      />

      <TaskTable
        tasks={displayedTasks}
        profile={profile}
        workspaceMember={workspaceMember}
        onRowClick={handleRowClick}
        selectedTaskId={selectedTaskId}
        activeProjectIds={activeProjectIds}
      />

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}

      {!!selectedTaskId && (
        <TaskDrawer
          task={drawerTask}
          taskNotFound={taskNotFound}
          profile={profile}
          workspaceMember={workspaceMember}
          projects={projects}
          users={users}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      <AddTaskModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        projects={projects}
        users={users}
        profile={profile}
        workspaceId={workspaceId}
      />
    </div>
  )
}
