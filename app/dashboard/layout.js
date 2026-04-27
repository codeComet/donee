import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import { getWorkspaceId } from '@/lib/workspace'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const workspaceId = getWorkspaceId(cookieStore)
  if (!workspaceId) redirect('/workspace')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch user's workspace membership (role only — separate workspace query avoids RLS recursion)
  const { data: workspaceMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  // Validate membership — if not a member, redirect
  if (!workspaceMember) {
    redirect('/workspace')
  }

  // Fetch current workspace details separately
  const { data: workspaceData } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single()

  // Fetch all user workspaces for the switcher (two queries to avoid RLS recursion)
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const wsIds = (memberships ?? []).map((m) => m.workspace_id)
  const { data: wsRows } = wsIds.length > 0
    ? await supabase.from('workspaces').select('id, name').in('id', wsIds)
    : { data: [] }

  const workspaces = (memberships ?? [])
    .map((m) => {
      const ws = (wsRows ?? []).find((w) => w.id === m.workspace_id)
      return ws ? { ...ws, role: m.role } : null
    })
    .filter(Boolean)

  // Fetch projects scoped to this workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  const workspace = workspaceData

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
        <Topbar user={user} profile={profile} workspace={workspace} workspaceMember={workspaceMember} />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6 dark:bg-slate-900">
          {children}
        </main>
      </div>
    </div>
  )
}
