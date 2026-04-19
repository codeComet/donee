'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import * as Tabs from '@radix-ui/react-tabs'
import UsersTab from '@/components/admin/UsersTab'
import ProjectsTab from '@/components/admin/ProjectsTab'
import { Users, Folder } from 'lucide-react'

async function fetchUsers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export default function AdminClient({ currentProfile, initialUsers, initialProjects }) {
  const [tab, setTab] = useState('users')

  // Shared users query — both tabs share this cache key.
  // When UsersTab invalidates ['admin-users'], this re-fetches and
  // the fresh list flows to ProjectsTab's PM dropdown automatically.
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    initialData: initialUsers,
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Panel</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage users, roles, and projects.</p>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          {[
            { value: 'users', label: 'Users', icon: Users },
            { value: 'projects', label: 'Projects', icon: Folder },
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
          <UsersTab users={users} currentProfile={currentProfile} />
        </Tabs.Content>

        <Tabs.Content value="projects" className="mt-6">
          <ProjectsTab initialProjects={initialProjects} users={users} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
