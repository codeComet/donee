import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: project, error } = await supabase
    .from('projects')
    .select(
      `*,
       pm:profiles!projects_pm_id_fkey(id, full_name, avatar_url),
       members:project_members(user:profiles(id, full_name, avatar_url))`
    )
    .eq('id', id)
    .single()

  if (error || !project) notFound()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      `*,
       project:projects(id, name, color),
       assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
       creator:profiles!tasks_created_by_fkey(id, full_name)`
    )
    .eq('project_id', id)
    .order('updated_at', { ascending: false })

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .order('full_name')

  return (
    <ProjectPageClient
      project={project}
      initialTasks={tasks ?? []}
      users={users ?? []}
      profile={profile}
    />
  )
}
