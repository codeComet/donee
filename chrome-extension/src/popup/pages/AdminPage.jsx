import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'

const ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'pm', label: 'PM' },
  { value: 'super_admin', label: 'Admin' },
]

export default function AdminPage({ profile: currentUser, workspaceId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)

  useEffect(() => {
    if (workspaceId) fetchMembers()
  }, [workspaceId])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('workspace_members')
      .select('id, user_id, role, user:profiles(id, full_name, email, avatar_url)')
      .eq('workspace_id', workspaceId)
      .order('user_id')
    const sorted = (data || [])
      .filter(m => m.user)
      .sort((a, b) => (a.user.full_name ?? '').localeCompare(b.user.full_name ?? ''))
    setMembers(sorted)
    setLoading(false)
  }

  async function updateRole(memberId, role) {
    setSavingId(memberId)
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)
    setSavingId(null)
    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
      setSavedId(memberId)
      setTimeout(() => setSavedId(null), 1500)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
        <p className="text-xs font-semibold text-slate-700">{members.length} workspace members</p>
      </div>

      <div className="popup-scroll flex-1">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-2/3 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
                <div className="skeleton h-7 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          members.map(member => (
            <div key={member.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50">
              <Avatar name={member.user.full_name} avatarUrl={member.user.avatar_url} size="sm" className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">
                  {member.user.full_name}
                  {member.user_id === currentUser.id && <span className="ml-1 text-[10px] text-slate-400">(you)</span>}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {savingId === member.id ? (
                  <Spinner size="sm" />
                ) : savedId === member.id ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : null}
                <select
                  value={member.role}
                  onChange={e => updateRole(member.id, e.target.value)}
                  disabled={savingId === member.id}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
