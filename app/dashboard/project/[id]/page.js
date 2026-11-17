import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import { getWorkspaceId } from '@/lib/workspace'
import ProjectPageClient from './ProjectPageClient'

export async function generateMetadata({ params }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return { title: data ? `${data.name} — Donee` : 'Project — Donee' }
}

export default async function ProjectPage({ params }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const workspaceId = getWorkspaceId(cookieStore)
  if (!workspaceId) redirect('/workspace')

  // Independent queries — run in parallel to cut navigation latency
  const [
    { data: profile },
    { data: workspaceMember },
    { data: project, error },
    { data: tasks },
    { data: members },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('projects')
      .select(
        `*,
         project_managers(user:profiles!project_managers_user_id_fkey(id, full_name, avatar_url)),
         members:project_members(user:profiles(id, full_name, avatar_url))`
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single(),
    supabase
      .from('tasks')
      .select(
        `*,
         project:projects(id, name, color),
         assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
         creator:profiles!tasks_created_by_fkey(id, full_name)`
      )
      .eq('project_id', id)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('workspace_members')
      .select('user:profiles(id, full_name, avatar_url)')
      .eq('workspace_id', workspaceId),
  ])

  if (error || !project) notFound()

  const users = (members ?? []).map((m) => m.user).filter(Boolean)

  return (
    <ProjectPageClient
      project={project}
      initialTasks={tasks ?? []}
      users={users}
      profile={profile}
      workspaceMember={workspaceMember}
    />
  )
}
