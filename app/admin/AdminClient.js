'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import * as Tabs from '@radix-ui/react-tabs'
import UsersTab from '@/components/admin/UsersTab'
import ProjectsTab from '@/components/admin/ProjectsTab'
import InvitationsTab from '@/components/admin/InvitationsTab'
import { Users, Folder, Mail } from 'lucide-react'

async function fetchUsers(workspaceId) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, joined_at, user:profiles(id, full_name, avatar_url, email, created_at)')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((m) => ({
    ...m.user,
    workspace_member_id: m.id,
    workspace_role: m.role,
    joined_at: m.joined_at,
  })).filter((u) => u.id)
}

export default function AdminClient({ currentProfile, initialUsers, initialProjects, initialInvitations, workspaceId }) {
  const [tab, setTab] = useState('users')

  const { data: users } = useQuery({
    queryKey: ['admin-users', workspaceId],
    queryFn: () => fetchUsers(workspaceId),
    initialData: initialUsers,
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Panel</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage workspace members, roles, projects, and invitations.</p>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          {[
            { value: 'users', label: 'Members', icon: Users },
            { value: 'projects', label: 'Projects', icon: Folder },
            { value: 'invitations', label: 'Invitations', icon: Mail },
          ].map(({ value, label, icon: Icon }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm
                data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 dark:data-[state=inactive]:hover:text-slate-200"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="users" className="mt-6">
          <UsersTab users={users} currentProfile={currentProfile} workspaceId={workspaceId} />
        </Tabs.Content>

        <Tabs.Content value="projects" className="mt-6">
          <ProjectsTab initialProjects={initialProjects} users={users} workspaceId={workspaceId} />
        </Tabs.Content>

        <Tabs.Content value="invitations" className="mt-6">
          <InvitationsTab initialInvitations={initialInvitations} workspaceId={workspaceId} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
