'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import TaskTable from '@/components/tasks/TaskTable'
import TaskFilters from '@/components/tasks/TaskFilters'
import AddTaskModal from '@/components/tasks/AddTaskModal'
import TaskDrawer from '@/components/tasks/TaskDrawer'
import { Plus } from 'lucide-react'

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

  const { data: tasks } = useQuery({
    queryKey: ['tasks', workspaceId, taskFilter],
    queryFn: () => fetchTasks(workspaceId, taskFilter),
    initialData: initialTasks,
    initialDataUpdatedAt: Date.now(),
    staleTime: 30_000,
  })

  // Client-side filtering
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

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

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
        tasks={filtered}
        profile={profile}
        workspaceMember={workspaceMember}
        onRowClick={(task) => setSelectedTaskId(task.id)}
        selectedTaskId={selectedTaskId}
      />

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
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
