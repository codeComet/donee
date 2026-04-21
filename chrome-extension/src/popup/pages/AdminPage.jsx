import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'

const ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'pm', label: 'PM' },
  { value: 'super_admin', label: 'Super Admin' },
]

export default function AdminPage({ profile: currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  async function updateRole(userId, role) {
    setSavingId(userId)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    setSavingId(null)
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      setSavedId(userId)
      setTimeout(() => setSavedId(null), 1500)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
        <p className="text-xs font-semibold text-slate-700">{users.length} team members</p>
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
          users.map(user => (
            <div key={user.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50">
              <Avatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">
                  {user.full_name}
                  {user.id === currentUser.id && <span className="ml-1 text-[10px] text-slate-400">(you)</span>}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {savingId === user.id ? (
                  <Spinner size="sm" />
                ) : savedId === user.id ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : null}
                <select
                  value={user.role}
                  onChange={e => updateRole(user.id, e.target.value)}
                  disabled={savingId === user.id}
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
