import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import { getWorkspaceId } from '@/lib/workspace'
import TasksPageClient from './TasksPageClient'

export const metadata = { title: 'All Tasks — Donee' }

export default async function TasksPage({ searchParams }) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const workspaceId = getWorkspaceId(cookieStore)
  if (!workspaceId) redirect('/workspace')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: workspaceMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  // Tasks scoped to workspace
  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      `*,
       project:projects(id, name, color),
       assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
       creator:profiles!tasks_created_by_fkey(id, full_name)`
    )
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  // Projects in this workspace for filter dropdown
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('name')

  // Workspace members for assignee filter
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user:profiles(id, full_name, avatar_url)')
    .eq('workspace_id', workspaceId)

  const users = (members ?? []).map((m) => m.user).filter(Boolean)

  return (
    <TasksPageClient
      initialTasks={tasks ?? []}
      projects={projects ?? []}
      users={users}
      profile={profile}
      workspaceMember={workspaceMember}
      workspaceId={workspaceId}
      openTaskId={(await searchParams)?.task ?? null}
    />
  )
}
