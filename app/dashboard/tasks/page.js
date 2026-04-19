import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import TasksPageClient from './TasksPageClient'

export const metadata = { title: 'All Tasks — Donee' }

export default async function TasksPage({ searchParams }) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Initial tasks with full joins
  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      `*,
       project:projects(id, name, color),
       assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
       creator:profiles!tasks_created_by_fkey(id, full_name)`
    )
    .order('updated_at', { ascending: false })

  // Projects for filter dropdown
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('is_archived', false)
    .order('name')

  // Users for assignee filter
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .order('full_name')

  return (
    <TasksPageClient
      initialTasks={tasks ?? []}
      projects={projects ?? []}
      users={users ?? []}
      profile={profile}
      openTaskId={(await searchParams)?.task ?? null}
    />
  )
}
