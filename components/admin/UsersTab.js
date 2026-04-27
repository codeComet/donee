'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import Avatar from '@/components/ui/Avatar'
import { format } from 'date-fns'
import { Check, Loader2, Trash2 } from 'lucide-react'

const ROLES = ['developer', 'pm', 'super_admin']
const ROLE_LABELS = { developer: 'Developer', pm: 'PM', super_admin: 'Super Admin' }

export default function UsersTab({ users, currentProfile, workspaceId }) {
  const qc = useQueryClient()
  const [savingId, setSavingId] = useState(null)

  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('workspace_members')
        .update({ role })
        .eq('id', memberId)
      if (error) throw error
    },
    onMutate: async ({ memberId }) => {
      setSavingId(memberId)
    },
    onSettled: () => {
      setSavingId(null)
      qc.invalidateQueries({ queryKey: ['admin-users', workspaceId] })
    },
  })

  const removeMember = useMutation({
    mutationFn: async ({ memberId }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-users', workspaceId] })
    },
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workspace Members ({users.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Member</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Workspace Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((user) => {
              const isMe = user.id === currentProfile?.id
              const isSaving = savingId === user.workspace_member_id
              return (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} size="sm" />
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {user.full_name ?? '—'}
                          {isMe && (
                            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
                              You
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{user.email ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={user.workspace_role}
                        onChange={(e) => updateRole.mutate({ memberId: user.workspace_member_id, role: e.target.value })}
                        disabled={isSaving || isMe}
                        className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 capitalize disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      {isSaving && <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />}
                      {!isSaving && savingId === null && user.workspace_member_id === updateRole.variables?.memberId && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    {user.joined_at ? format(new Date(user.joined_at), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {!isMe && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${user.full_name} from this workspace?`)) {
                            removeMember.mutate({ memberId: user.workspace_member_id })
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove from workspace"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
