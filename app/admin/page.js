import { cookies } from 'next/headers'
import { createServerSideClient } from '@/lib/supabase'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch all profiles (admins can see all)
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch all projects with PM info
  const { data: projects } = await supabase
    .from('projects')
    .select(`*, pm:profiles!projects_pm_id_fkey(id, full_name, avatar_url)`)
    .order('created_at', { ascending: false })

  return (
    <AdminClient
      currentProfile={profile}
      initialUsers={users ?? []}
      initialProjects={projects ?? []}
    />
  )
}
