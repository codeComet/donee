'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { Plus, Copy, Check, Trash2, Loader2, Mail, Link } from 'lucide-react'
import { cn } from '@/lib/utils'

async function fetchInvitations(workspaceId) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('*, inviter:profiles!workspace_invitations_invited_by_fkey(full_name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export default function InvitationsTab({ initialInvitations, workspaceId }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [emailStatus, setEmailStatus] = useState(null) // { id, state: 'sending'|'sent'|'error', message? }

  const { data: invitations } = useQuery({
    queryKey: ['admin-invitations', workspaceId],
    queryFn: () => fetchInvitations(workspaceId),
    initialData: initialInvitations,
  })

  const createInvite = useMutation({
    mutationFn: async ({ email }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId,
          invited_by: user.id,
          email: email.trim() || null,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async (data, { email: inviteEmail }) => {
      setEmail('')
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['admin-invitations', workspaceId] })

      if (inviteEmail?.trim()) {
        setEmailStatus({ id: data.id, state: 'sending' })
        try {
          const res = await fetch('/api/invitations/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitationId: data.id, workspaceId }),
          })
          const result = await res.json()
          if (!res.ok) throw new Error(result.error ?? 'Failed to send email')
          setEmailStatus({ id: data.id, state: 'sent' })
        } catch (err) {
          setEmailStatus({ id: data.id, state: 'error', message: err.message })
        }
      }
    },
  })

  const deleteInvite = useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      const { error } = await supabase.from('workspace_invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-invitations', workspaceId] })
    },
  })

  async function copyCode(code, id) {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const active = invitations.filter((i) => !i.accepted_at && (!i.expires_at || new Date(i.expires_at) > new Date()))
  const used = invitations.filter((i) => i.accepted_at || (i.expires_at && new Date(i.expires_at) <= new Date()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workspace Invitations</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Invite people by generating a code or via email.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Invite
        </button>
      </div>

      {emailStatus && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm',
          emailStatus.state === 'sending' && 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
          emailStatus.state === 'sent' && 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
          emailStatus.state === 'error' && 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
        )}>
          {emailStatus.state === 'sending' && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
          {emailStatus.state === 'sent' && <Check className="h-4 w-4 shrink-0" />}
          {emailStatus.state === 'sending' && 'Sending invitation email…'}
          {emailStatus.state === 'sent' && 'Invitation email sent.'}
          {emailStatus.state === 'error' && `Email failed: ${emailStatus.message}`}
          <button onClick={() => setEmailStatus(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">Create Invitation</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional: restrict to email address"
              className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              onClick={() => createInvite.mutate({ email })}
              disabled={createInvite.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generate
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Leave email blank to generate an open invite code. Expires in 7 days.</p>
          {createInvite.error && (
            <p className="text-xs text-red-500 mt-2">{createInvite.error.message}</p>
          )}
        </div>
      )}

      {/* Active invitations */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Active ({active.length})</h3>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No active invitations.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {active.map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                      {inv.invite_code}
                    </code>
                    {inv.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail className="h-3 w-3" />
                        {inv.email}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Created by {inv.inviter?.full_name ?? '—'} · Expires {inv.expires_at ? format(new Date(inv.expires_at), 'MMM d, yyyy') : 'never'}
                  </p>
                </div>
                <button
                  onClick={() => copyCode(inv.invite_code, inv.id)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    copiedId === inv.id
                      ? 'text-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                  title="Copy code"
                >
                  {copiedId === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => deleteInvite.mutate(inv.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete invitation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used/expired */}
      {used.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Used / Expired ({used.length})</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {used.map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-4 opacity-60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-slate-400 line-through">
                      {inv.invite_code}
                    </code>
                    <span className="text-xs text-slate-400">
                      {inv.accepted_at ? `Accepted ${format(new Date(inv.accepted_at), 'MMM d, yyyy')}` : 'Expired'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
