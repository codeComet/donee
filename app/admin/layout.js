import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import { getWorkspaceId } from '@/lib/workspace'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export const metadata = { title: 'Admin — Donee' }

export default async function AdminLayout({ children }) {
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

  // Admin requires workspace super_admin role
  const { data: workspaceMember } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!workspaceMember || workspaceMember.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // All workspaces for switcher
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const workspaces = (memberships ?? [])
    .filter((m) => m.workspace)
    .map((m) => ({ ...m.workspace, role: m.role }))

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar
        profile={profile}
        projects={projects ?? []}
        workspaces={workspaces}
        currentWorkspaceId={workspaceId}
        workspaceMember={workspaceMember}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar user={user} profile={profile} workspace={workspaceMember.workspace} workspaceMember={workspaceMember} />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
